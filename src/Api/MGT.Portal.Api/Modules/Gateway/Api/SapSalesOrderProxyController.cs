using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// API_SALES_ORDER_SRV ของ SAP ครบทุก operation ผ่านโดเมนบริษัท — path หลัง /api/v1/sales/sap เหมือน SAP ทุกตัว
/// เช่น GET /api/v1/sales/sap/A_SalesOrder('1000045')/to_Item
/// - ใช้ token หมวด Sales เดิม (GatewayAuth) Sandbox → SAP DEV (ชั่วคราว ต่อไปย้ายเป็น UAT), Production → SAP Production
/// - ทุก operation ติด scope (SapScope) ไว้แล้ว ตอนนี้แอปที่ได้หมวด Sales ใช้ได้ทุก scope ยกเว้น Approve (ปิดไว้จนตั้ง Gateway:Sap:EnableApprove)
/// - ไม่เปิด DELETE และ $batch
/// - คำขอเขียนใช้กติกาเดียวกับ /orders: Idempotency-Key, audit log ใน GatewayWriteRecords,
///   แก้ / ยกเลิกได้เฉพาะ SO ที่แอปเดียวกันสร้างผ่าน Gateway ใน env เดียวกัน
/// - คำตอบเป็น JSON ของ SAP (OData V2 รูปแบบ {"d": ...}) ตามเดิม เพื่อให้ใช้เอกสารของ SAP ได้ตรง ๆ
/// </summary>
[ApiController]
[Route(RoutePrefix)]
[AllowAnonymous]
public partial class SapSalesOrderProxyController(
    GatewayAuth auth, GatewayIdempotency idempotency, SapODataProxy sap, IConfiguration config,
    ILogger<SapSalesOrderProxyController> log) : ControllerBase
{
    public const string RoutePrefix = "api/v1/sales/sap";
    public const string ScopeHeader = "X-Gateway-Scope";
    private const string Category = "sales";

    [AcceptVerbs("GET", "POST", "PATCH", "DELETE", Route = "{**odataPath}")]
    public async Task<IActionResult> Handle(CancellationToken ct)
    {
        var who = await auth.AuthenticateAsync(Request, Category, ct);
        if (!who.Ok) return StatusCode(who.StatusCode, new { message = who.Error });
        var caller = who.Caller!;

        var path = ODataPath();
        var method = Request.Method.ToUpperInvariant();
        var match = SapSalesOrderOperations.Find(method, path);
        if (match is null)
        {
            var methods = SapSalesOrderOperations.MethodsFor(path);
            if (methods.Count > 0)
            {
                Response.Headers.Allow = string.Join(", ", methods);
                return StatusCode(StatusCodes.Status405MethodNotAllowed,
                    new { message = $"{path} ใช้ได้กับ {string.Join(", ", methods)} เท่านั้น" });
            }
            return NotFound(new { message = $"ไม่มี operation '{method} {path}' ใน SAP API_SALES_ORDER_SRV — ดูรายการที่ /api/v1/specs/sales-order-sap.json" });
        }

        var op = match.Operation;
        if (op.IsBlocked)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = op.BlockedReason });

        var (query, queryError) = SapODataProxy.BuildQuery(op, Request.QueryString.Value);
        if (queryError is not null) return BadRequest(new { message = queryError });

        if (method == "GET")
            return await ReadAsync(caller, op, path, query!, ct);

        JsonNode? body;
        try
        {
            using var reader = new StreamReader(Request.Body);
            var text = await reader.ReadToEndAsync(ct);
            body = string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
        }
        catch (JsonException)
        {
            return BadRequest(new { message = "body ต้องเป็น JSON" });
        }
        if (body is not null and not JsonObject)
            return BadRequest(new { message = "body ต้องเป็น JSON object ตาม entity ของ SAP" });

        var scope = op.Scope!;
        if (method == "PATCH" && body is JsonObject patch && SetsRejectionReason(patch)) scope = SapScope.Cancel;
        if (scope == SapScope.Approve && !config.GetValue<bool>("Gateway:Sap:EnableApprove"))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "การอนุมัติ / ปฏิเสธ Sales Order ผ่าน API ยังปิดอยู่ จนกว่าจะผูกกับ Flow อนุมัติของบริษัท" });

        return await WriteAsync(caller, op, scope, match.Keys, path, query!, body as JsonObject, ct);
    }

    private async Task<IActionResult> ReadAsync(GatewayCaller caller, SapOperation op, string path, string query, CancellationToken ct)
    {
        try
        {
            var res = await sap.ReadAsync(caller.Env, path, query, PublicBase(), ct);
            // บันทึกว่าแอปใช้ operation ไหนจริง — ใช้เสนอ scope ตอนขอขึ้น Production
            log.LogInformation("Gateway sap {Scope} {Operation}: app {AppId} ({AppName}, {Env})",
                op.Scope, op.AuditName, caller.ApplicationId, caller.ApplicationName, caller.Env);
            return Passthrough(res, op.Scope!, caller.Env);
        }
        catch (SapException ex)
        {
            if (ex.NotConfigured) log.LogError("Gateway sap ({Env}): {Message}", caller.Env, ex.Message);
            return StatusCode(ex.StatusCode, new { message = ex.Message });
        }
    }

    private async Task<IActionResult> WriteAsync(
        GatewayCaller caller, SapOperation op, string scope, IReadOnlyDictionary<string, string> keys,
        string path, string query, JsonObject? body, CancellationToken ct)
    {
        var isCreate = scope == SapScope.Create;
        if (isCreate)
        {
            if (body is null) return BadRequest(new { message = "ต้องส่ง body ของ Sales Order" });
            try
            {
                if (sap.ApplyOrgDefaults(caller.Env, body) is { } orgError)
                    return UnprocessableEntity(new { message = orgError });
            }
            catch (SapException ex) when (ex.NotConfigured)
            {
                log.LogError("Gateway sap ({Env}): {Message}", caller.Env, ex.Message);
                return StatusCode(ex.StatusCode, new { message = ex.Message });
            }
        }

        string? salesOrder = null;
        if (SapScope.ChangesExistingOrder(scope) || scope == SapScope.Approve)
        {
            salesOrder = SalesOrderOf(keys, body, Request.Query["SalesOrder"].ToString());
            if (salesOrder is null)
                return BadRequest(new { message = "ระบุเลข Sales Order ไม่ได้ — ต้องมีใน path, ฟิลด์ SalesOrder ของ body หรือ query SalesOrder='…' (ตัวเลขไม่เกิน 10 หลัก)" });
            if (SapScope.ChangesExistingOrder(scope) && !await idempotency.CreatedByAsync(caller, salesOrder, ct))
                return StatusCode(StatusCodes.Status403Forbidden,
                    new { message = $"แอปนี้แก้หรือยกเลิกได้เฉพาะ Sales Order ที่แอปสร้างผ่าน Gateway ใน {caller.Env} เท่านั้น" });
        }

        var key = Request.Headers[GatewayIdempotency.Header].ToString().Trim();
        if (key.Length is 0 or > GatewayIdempotency.MaxKeyLength)
            return BadRequest(new { message = $"ต้องส่ง header {GatewayIdempotency.Header} (ไม่เกิน {GatewayIdempotency.MaxKeyLength} ตัวอักษร) เช่น UUID ใหม่ทุกครั้งที่เป็นคำขอใหม่ ส่งซ้ำด้วยค่าเดิมเมื่อ retry" });

        // สร้าง SO ใช้ชื่อเดียวกับ POST /orders เพื่อให้กติกา "แก้ได้เฉพาะ SO ที่แอปสร้าง" ใช้ร่วมกันได้ทั้งสองแบบ
        var operation = isCreate ? GatewayWriteOperation.CreateSalesOrder : op.AuditName;
        var ifMatch = Request.Headers.IfMatch.ToString();
        var start = await idempotency.BeginAsync(caller, operation, key, salesOrder,
            GatewayIdempotency.Hash(operation, salesOrder, new { path, query, body }), ct);
        switch (start.Kind)
        {
            case WriteStartKind.Replay:
                Response.Headers["Idempotent-Replayed"] = "true";
                return new ContentResult
                {
                    StatusCode = start.Record.StatusCode,
                    Content = start.Record.ResponseJson,
                    ContentType = "application/json; charset=utf-8",
                };
            case WriteStartKind.InProgress:
                return Conflict(new { message = $"คำขอที่ใช้ {GatewayIdempotency.Header} นี้ยังทำไม่เสร็จ (หรือค้างจากครั้งก่อน) ตรวจใน SAP ก่อน ถ้าจะส่งใหม่ให้ใช้ key ใหม่" });
            case WriteStartKind.KeyReused:
                return UnprocessableEntity(new { message = $"{GatewayIdempotency.Header} นี้เคยใช้กับคำขออื่นแล้ว คำขอใหม่ต้องใช้ key ใหม่" });
        }

        // เริ่มเขียนแล้วห้ามยกเลิกกลางทางแม้แอปตัดการเชื่อมต่อ — SAP อาจบันทึกไปแล้ว ผลต้องถูกเก็บใน audit log เสมอ
        var record = start.Record;
        try
        {
            var res = await sap.WriteAsync(caller.Env, new HttpMethod(Request.Method.ToUpperInvariant()), path, query, body,
                string.IsNullOrWhiteSpace(ifMatch) ? null : ifMatch, PublicBase(), isCreate, CancellationToken.None);
            await idempotency.CompleteRawAsync(record, res.StatusCode, res.Body, res.CreatedSalesOrder ?? salesOrder);
            log.LogInformation("Gateway sap {Scope} {Operation}: app {AppId} ({AppName}, {Env}) SO {SalesOrder}",
                scope, op.AuditName, caller.ApplicationId, caller.ApplicationName, caller.Env, res.CreatedSalesOrder ?? salesOrder);
            return Passthrough(res, scope, caller.Env);
        }
        catch (SapException ex) when (!ex.MayHaveChanged)
        {
            // SAP ยังไม่เปลี่ยนอะไร — ไม่เก็บผล ให้แอป retry ด้วย key เดิมได้
            await idempotency.AbandonAsync(record);
            if (ex.NotConfigured) log.LogError("Gateway sap ({Env}): {Message}", caller.Env, ex.Message);
            else log.LogWarning("Gateway sap {Operation}: app {AppId} ({Env}) SAP ปฏิเสธ {Status}: {Message}",
                op.AuditName, caller.ApplicationId, caller.Env, ex.StatusCode, ex.Message);
            return StatusCode(ex.StatusCode, new { message = ex.Message });
        }
        catch (SapException ex)
        {
            var error = new { message = ex.Message };
            await idempotency.CompleteAsync(record, ex.StatusCode, error, salesOrder);
            log.LogError("Gateway sap {Operation}: app {AppId} ({Env}) ผลไม่แน่นอน {Status}: {Message}",
                op.AuditName, caller.ApplicationId, caller.Env, ex.StatusCode, ex.Message);
            return StatusCode(ex.StatusCode, error);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Gateway sap {Operation}: app {AppId} ({Env}) ผิดพลาดที่ไม่คาดคิด", op.AuditName, caller.ApplicationId, caller.Env);
            var error = new { message = "Gateway ผิดพลาดระหว่างเขียนเข้า SAP ตรวจใน SAP ก่อนส่งใหม่ด้วย key ใหม่" };
            await idempotency.CompleteAsync(record, StatusCodes.Status500InternalServerError, error, salesOrder);
            return StatusCode(StatusCodes.Status500InternalServerError, error);
        }
    }

    private ContentResult Passthrough(SapProxyResponse res, string scope, string env)
    {
        Response.Headers[ScopeHeader] = scope;
        Response.Headers["X-Gateway-Source"] = "sap";
        Response.Headers["X-Gateway-Env"] = env;
        if (res.ETag is not null) Response.Headers.ETag = res.ETag;
        return new ContentResult
        {
            StatusCode = res.StatusCode,
            Content = res.Body,
            ContentType = res.ContentType + "; charset=utf-8",
        };
    }

    /// <summary>path แบบ OData หลัง prefix เช่น /A_SalesOrder('1')/to_Item (Request.Path ถอดรหัส %27 เป็น ' แล้ว)</summary>
    private string ODataPath()
    {
        var full = Request.Path.Value ?? "";
        var prefix = "/" + RoutePrefix;
        var rest = full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? full[prefix.Length..] : full;
        // Swagger UI ส่ง / ใน {odataPath} มาเป็น %2F ซึ่ง ASP.NET ไม่ถอดให้
        rest = rest.Replace("%2F", "/", StringComparison.OrdinalIgnoreCase);
        return rest.Length == 0 ? "/" : rest;
    }

    private string PublicBase() => $"{Request.Scheme}://{Request.Host}{Request.PathBase}/{RoutePrefix}/";

    public static bool SetsRejectionReason(JsonObject body) =>
        body["SalesDocumentRjcnReason"] is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s);

    /// <summary>เลข SO จาก key ใน path → ฟิลด์ SalesOrder ใน body → query SalesOrder='…' (function import)</summary>
    public static string? SalesOrderOf(IReadOnlyDictionary<string, string> keys, JsonObject? body, string? queryValue)
    {
        string? raw = keys.TryGetValue("SalesOrder", out var k) ? k
            : body?["SalesOrder"] is JsonValue v && v.TryGetValue<string>(out var b) ? b
            : string.IsNullOrWhiteSpace(queryValue) ? null : queryValue.Trim().Trim('\'');
        raw = raw?.Trim();
        return raw is not null && SalesOrderNumber().IsMatch(raw) ? raw : null;
    }

    [GeneratedRegex("^[0-9]{1,10}$")]
    private static partial Regex SalesOrderNumber();
}
