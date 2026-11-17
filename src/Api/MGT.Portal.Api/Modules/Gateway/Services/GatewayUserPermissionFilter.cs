using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>Personal API permission gate, separate from application credentials and workflow approval.</summary>
public class GatewayUserPermissionFilter(PortalDbContext db, GatewayAuth auth, GatewayUserContext users, DataBoundaryResolver boundaries,
    SapODataProxy sap, ZohoCrmClient zoho, IConfiguration config) : IAsyncActionFilter
{
    public const string UserIdItem = "gateway.permission.user-id";

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;
        var path = (request.Path.Value ?? "").Replace("%2F", "/", StringComparison.OrdinalIgnoreCase);
        var isSap = path.StartsWith("/api/v1/sales/sap", StringComparison.OrdinalIgnoreCase);
        var isZoho = path.StartsWith("/api/v1/sales/zoho", StringComparison.OrdinalIgnoreCase);
        var write = !HttpMethods.IsGet(request.Method);
        var resource = "sales.order";
        ZohoOperation? zohoOperation = null;
        SapOperationMatch? sapOperation = null;
        if (isZoho)
        {
            var resolved = ZohoOperations.Resolve(request.Method, path[(ZohoCrmProxyController.RoutePrefix.Length + 1)..], request.QueryString.Value);
            if (resolved.Operation is null) { context.Result = Error(resolved.Status, resolved.Error!); return; }
            zohoOperation = resolved.Operation;
            resource = $"sales.{ZohoOperations.Modules[zohoOperation.Module]}";
        }
        if (isSap)
        {
            sapOperation = SapSalesOrderOperations.Find(request.Method, path[(SapSalesOrderProxyController.RoutePrefix.Length + 1)..]);
            if (sapOperation is null) { context.Result = Error(404, "Unknown SAP API operation"); return; }
            if (sapOperation.Operation.IsBlocked) { context.Result = Error(403, sapOperation.Operation.BlockedReason!); return; }
        }
        var application = await auth.AuthenticateAsync(request, "sales", request.HttpContext.RequestAborted);
        if (!application.Ok) { context.Result = Error(application.StatusCode, application.Error!); return; }
        var person = await users.ResolveAsync(request.Headers[GatewayUserContext.Header].ToString(), isZoho ? "zoho" : "sap",
            request.HttpContext.RequestAborted, resource, forWrite: write);
        if (!person.Ok) { context.Result = Error(person.StatusCode, person.Error!); return; }
        var scope = person.User!;
        context.HttpContext.Items[UserIdItem] = scope.UserId;
        context.HttpContext.Response.Headers["X-Data-Scope"] = scope.Scope;
        var me = await db.Users.AsNoTracking().FirstAsync(u => u.Id == scope.UserId, request.HttpContext.RequestAborted);
        var boundary = await boundaries.ResolveAsync(me, false, scopeOverride: scope.Scope);
        var env = application.Caller!.Env;

        // Schemas contain no business records, but still require the API read permission above.
        var schema = isSap && path.EndsWith("/$metadata", StringComparison.OrdinalIgnoreCase)
            || isZoho && zohoOperation?.Action == ZohoAction.Fields;
        if (schema) { await next(); return; }
        ActionExecutedContext? executedResult = null;
        var parentAuthorized = false;
        try
        {
            if (!write && !scope.SeesAll)
            {
                var ownerField = isZoho ? "Owner" : config["Gateway:Sap:OwnerField"];
                var queryKey = isZoho ? "fields" : "$select";
                if (!string.IsNullOrWhiteSpace(ownerField) && request.Query.TryGetValue(queryKey, out var selection))
                {
                    var query = QueryHelpers.ParseQuery(request.QueryString.Value).ToDictionary(p => p.Key, p => p.Value);
                    query[queryKey] = selection + "," + ownerField;
                    request.QueryString = QueryString.Create(query);
                }
            }
            if (write && !scope.SeesAll && isSap && config["Gateway:Sap:OwnerField"] is { Length: > 0 } sapOwnerField)
            {
                var body = await ReadBodyAsync(request);
                var owner = OwnerId(body, sapOwnerField);
                if (body?.ContainsKey(sapOwnerField) == true && owner is null)
                { context.Result = Error(400, "The SAP owner must be a mapped external ID string"); return; }
                if (sapOperation?.Operation.Scope == SapScope.Create && owner is null)
                {
                    owner = await db.UserPlatformIds.Where(p => p.UserId == scope.UserId && p.Platform == "sap")
                        .Select(p => p.ExternalId).FirstOrDefaultAsync(request.HttpContext.RequestAborted);
                    if (owner is not null && body is not null) body[sapOwnerField] = owner;
                }
                if (owner is not null && !scope.OwnerIds.Contains(owner) || sapOperation?.Operation.Scope == SapScope.Create && owner is null)
                { context.Result = Error(403, "Set a SAP record owner within the user's CUD scope. Map the user in UserPlatformIds first."); return; }
                if (body is not null) ReplaceBody(request, body.ToJsonString());
            }
            if (isSap || !isZoho)
            {
                string? order = null;
                if (isSap && sapOperation is not null)
                    sapOperation.Keys.TryGetValue("SalesOrder", out order);
                else if (context.ActionArguments.TryGetValue("salesOrder", out var value)) order = value as string;
                if (!scope.SeesAll && order is not null && !await AllowsSapOrderAsync(env, order, scope, boundary, request.HttpContext.RequestAborted))
                { context.Result = Error(write ? 403 : 404, write ? "This sales order is outside the user's CUD scope" : "Sales order not found"); return; }
                parentAuthorized = order is not null;
                // Function imports may carry the order in query/body instead of the route.
                if (isSap && write && order is null && sapOperation?.Operation.Scope != SapScope.Create)
                {
                    var body = await ReadBodyAsync(request);
                    order = SapSalesOrderProxyController.SalesOrderOf(sapOperation!.Keys, body, request.Query["SalesOrder"]);
                    if (!scope.SeesAll && (order is null || !await AllowsSapOrderAsync(env, order, scope, boundary, request.HttpContext.RequestAborted)))
                    { context.Result = Error(403, "The target sales order is outside the user's CUD scope"); return; }
                }
            }
            if (isZoho && zohoOperation is not null && !scope.SeesAll)
            {
                if (zohoOperation.RecordId is { } id && !await AllowsZohoRecordAsync(env, zohoOperation.Module, id, scope, request.HttpContext.RequestAborted))
                { context.Result = Error(write ? 403 : 404, write ? "This record is outside the user's CUD scope" : "Record not found"); return; }
                if (write)
                {
                    var body = await ReadBodyAsync(request);
                    if (body?["data"] is JsonArray data)
                    {
                        foreach (var row in data.OfType<JsonObject>())
                        {
                            var owner = OwnerId(row, "Owner.id");
                            if (row.ContainsKey("Owner") && owner is null)
                            { context.Result = Error(400, "Owner must contain a mapped external ID string in Owner.id"); return; }
                            if (owner is null && zohoOperation.Action == ZohoAction.Create)
                            {
                                owner = await db.UserPlatformIds.Where(p => p.UserId == scope.UserId && p.Platform == "zoho")
                                    .Select(p => p.ExternalId).FirstOrDefaultAsync(request.HttpContext.RequestAborted);
                                if (owner is not null) row["Owner"] = new JsonObject { ["id"] = owner };
                            }
                            if (owner is not null && !scope.OwnerIds.Contains(owner) || owner is null && zohoOperation.Action == ZohoAction.Create)
                            { context.Result = Error(403, "Set a Zoho record owner within the user's CUD scope. Map the user in UserPlatformIds first."); return; }
                        }
                        ReplaceBody(request, body!.ToJsonString());
                    }
                }
            }
            var executed = await next();
            executedResult = executed;
            if (!write && !scope.SeesAll && executed.Result is ContentResult result && result.StatusCode is >= 200 and < 300 && result.Content is not null)
            {
                var json = JsonNode.Parse(result.Content);
                if (isZoho && json?["data"] is JsonArray records)
                {
                    Keep(records, row => scope.OwnerIds.Contains(OwnerId(row, "Owner.id") ?? ""));
                    if (json is JsonObject obj) obj["info"] = new JsonObject { ["count"] = records.Count, ["more_records"] = false };
                }
                else if (isSap && !parentAuthorized && json?["d"] is JsonObject d)
                {
                    if (d["results"] is JsonArray recordsSap)
                    {
                        var owned = await OwnedOrdersAsync(env, boundary, request.HttpContext.RequestAborted);
                        var field = config["Gateway:Sap:OwnerField"];
                        Keep(recordsSap, row => (!string.IsNullOrWhiteSpace(field) && scope.OwnerIds.Contains(OwnerId(row, field) ?? ""))
                            || string.IsNullOrWhiteSpace(field) && owned.Contains(OwnerId(row, "SalesOrder") ?? ""));
                        d.Remove("__count"); d.Remove("__next");
                    }
                    else { executed.Result = Error(502, "The source response cannot be checked for record ownership"); return; }
                }
                else if (isZoho || isSap && !parentAuthorized)
                { executed.Result = Error(502, "The source response cannot be checked for record ownership"); return; }
                result.Content = json?.ToJsonString();
            }
        }
        catch (Exception ex) when (ex is SapException or ZohoException or System.Text.Json.JsonException)
        {
            // Never continue with unverified ownership or return unfiltered data after a failed check.
            var error = Error(502, "Unable to verify record ownership in the source system. Try again later.");
            if (executedResult is not null) executedResult.Result = error;
            else context.Result = error;
        }
    }

    private async Task<HashSet<string>> OwnedOrdersAsync(string env, DataBoundary boundary, CancellationToken ct)
    {
        return (await db.GatewayWriteRecords.Where(r => r.Env == env && r.Operation == GatewayWriteOperation.CreateSalesOrder
            && r.StatusCode >= 200 && r.StatusCode < 300 && r.SalesOrder != null && r.RequestUserId != null && boundary.UserIds.Contains(r.RequestUserId.Value))
            .Select(r => r.SalesOrder!).ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
    }

    private async Task<bool> AllowsSapOrderAsync(string env, string order, GatewayUserScope scope, DataBoundary boundary, CancellationToken ct)
    {
        var field = config["Gateway:Sap:OwnerField"];
        if (string.IsNullOrWhiteSpace(field)) return (await OwnedOrdersAsync(env, boundary, ct)).Contains(order);
        if (!System.Text.RegularExpressions.Regex.IsMatch(order, "^[0-9]{1,10}$") || !System.Text.RegularExpressions.Regex.IsMatch(field, "^[A-Za-z_][A-Za-z0-9_]*$")) return false;
        var res = await sap.ReadAsync(env, $"/A_SalesOrder('{order}')", "?%24select=" + Uri.EscapeDataString(field), "", ct);
        return scope.OwnerIds.Contains(OwnerId(JsonNode.Parse(res.Body)?["d"], field) ?? "");
    }

    private async Task<bool> AllowsZohoRecordAsync(string env, string module, string id, GatewayUserScope scope, CancellationToken ct)
    {
        var res = await zoho.SendAsync(env, HttpMethod.Get, $"{module}/{id}?fields=Owner", null, false, ct);
        if (res.StatusCode is < 200 or >= 300) return false;
        return JsonNode.Parse(res.Body)?["data"] is JsonArray data && data.Count == 1 && scope.OwnerIds.Contains(OwnerId(data[0], "Owner.id") ?? "");
    }

    public static string? OwnerId(JsonNode? node, string path)
    {
        foreach (var key in path.Split('.')) { if (node is not JsonObject obj || !obj.TryGetPropertyValue(key, out node)) return null; }
        return node is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;
    }
    private static void Keep(JsonArray records, Func<JsonNode?, bool> allowed)
    { for (var i = records.Count - 1; i >= 0; i--) if (!allowed(records[i])) records.RemoveAt(i); }
    private static ObjectResult Error(int status, string message) => new(new { message }) { StatusCode = status };
    private static async Task<JsonObject?> ReadBodyAsync(HttpRequest request)
    {
        request.EnableBuffering(); request.Body.Position = 0;
        using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
        var text = await reader.ReadToEndAsync(request.HttpContext.RequestAborted); request.Body.Position = 0;
        return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text) as JsonObject;
    }
    private static void ReplaceBody(HttpRequest request, string body)
    { var bytes = Encoding.UTF8.GetBytes(body); request.Body = new MemoryStream(bytes); request.ContentLength = bytes.Length; }
}
