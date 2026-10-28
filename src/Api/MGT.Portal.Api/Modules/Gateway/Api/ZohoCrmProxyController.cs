using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// Zoho CRM (Deals / Quotes / Sales_Orders) ผ่านโดเมนบริษัท — path หลัง /api/v1/sales/zoho เหมือน Zoho CRM API v8
/// เช่น GET /api/v1/sales/zoho/Deals?fields=Deal_Name,Stage · PUT /api/v1/sales/zoho/Quotes/6421337000000123456
/// - ใช้ token หมวด Sales เดิม: Sandbox token → ZohoConfig:sandbox, Production token → ZohoConfig:prod
/// - คำตอบที่สำเร็จเป็น JSON ของ Zoho ตามเดิม ({"data": [...], "info": {...}}); error เป็น {"message", "zoho"}
/// - คำขอเขียนใช้กติกาเดียวกับ SAP: Idempotency-Key + audit log ใน GatewayWriteRecords
///   และแก้ได้เฉพาะระเบียนที่แอปสร้างผ่าน Gateway (ปิดได้ด้วย Gateway:Zoho:RestrictUpdatesToOwnRecords=false)
/// - Sales Order ที่สร้างใน Zoho เข้า Flow อนุมัติและ RPA ส่งต่อ SAP ตามปกติของ Zoho
/// </summary>
[ApiController]
[Route(RoutePrefix)]
[AllowAnonymous]
public class ZohoCrmProxyController(
    GatewayAuth auth, GatewayIdempotency idempotency, ZohoCrmClient zoho, IConfiguration config,
    ILogger<ZohoCrmProxyController> log) : ControllerBase
{
    public const string RoutePrefix = "api/v1/sales/zoho";
    private const string Category = "sales";

    [AcceptVerbs("GET", "POST", "PUT", "DELETE", Route = "{**zohoPath}")]
    public async Task<IActionResult> Handle(CancellationToken ct)
    {
        var who = await auth.AuthenticateAsync(Request, Category, ct);
        if (!who.Ok) return StatusCode(who.StatusCode, new { message = who.Error });
        var caller = who.Caller!;

        var resolved = ZohoOperations.Resolve(Request.Method, ZohoPath(), Request.QueryString.Value);
        if (resolved.Operation is not { } op) return StatusCode(resolved.Status, new { message = resolved.Error });

        var (query, queryError) = ZohoOperations.BuildQuery(op, Request.QueryString.Value);
        if (queryError is not null) return BadRequest(new { message = queryError });

        return op.IsWrite
            ? await WriteAsync(caller, op, query!, ct)
            : await ReadAsync(caller, op, query!, ct);
    }

    private async Task<IActionResult> ReadAsync(GatewayCaller caller, ZohoOperation op, string query, CancellationToken ct)
    {
        try
        {
            var res = await zoho.SendAsync(caller.Env, HttpMethod.Get, op.ZohoPath + query, null, isWrite: false, ct);
            log.LogInformation("Gateway zoho {Scope} {Operation}: app {AppId} ({AppName}, {Env}) → {Status}",
                op.Scope, op.AuditName, caller.ApplicationId, caller.ApplicationName, caller.Env, res.StatusCode);
            if (res.StatusCode == StatusCodes.Status204NoContent)
                return Json(op, caller.Env, 200, """{"data":[],"info":{"count":0,"more_records":false}}""");
            if (res.StatusCode is >= 200 and < 300) return Json(op, caller.Env, res.StatusCode, res.Body);
            throw ToException(res, isWrite: false);
        }
        catch (ZohoException ex)
        {
            if (ex.NotConfigured) log.LogError("Gateway zoho ({Env}): {Message}", caller.Env, ex.Message);
            return Error(ex);
        }
    }

    private async Task<IActionResult> WriteAsync(GatewayCaller caller, ZohoOperation op, string query, CancellationToken ct)
    {
        JsonObject? body;
        try
        {
            using var reader = new StreamReader(Request.Body);
            var text = await reader.ReadToEndAsync(ct);
            body = string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text) as JsonObject;
        }
        catch (JsonException)
        {
            body = null;
        }
        if (body?["data"] is not JsonArray data || data.Count == 0 || data.Any(d => d is not JsonObject))
            return BadRequest(new { message = "body ต้องเป็น {\"data\": [ { ...field ของ Zoho... } ]}" });
        if (body.Select(p => p.Key).FirstOrDefault(k => k is not ("data" or "trigger")) is { } extra)
            return BadRequest(new { message = $"ไม่รองรับ '{extra}' ใน body — ใช้ได้เฉพาะ data และ trigger" });
        if (op.Action == ZohoAction.Update && data.Count != 1)
            return BadRequest(new { message = "PUT แก้ได้ครั้งละ 1 ระเบียน" });
        if (data.Count > ZohoOperations.MaxRecordsPerWrite)
            return BadRequest(new { message = $"สร้างได้ครั้งละไม่เกิน {ZohoOperations.MaxRecordsPerWrite} ระเบียน" });

        if (op.Action == ZohoAction.Update && config.GetValue("Gateway:Zoho:RestrictUpdatesToOwnRecords", true) &&
            !await idempotency.CreatedZohoRecordAsync(caller, CreateAuditName(op.Module), op.RecordId!, ct))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = $"แอปนี้แก้ได้เฉพาะ {op.Module} ที่แอปสร้างผ่าน Gateway ใน {caller.Env} เท่านั้น" });

        var key = Request.Headers[GatewayIdempotency.Header].ToString().Trim();
        if (key.Length is 0 or > GatewayIdempotency.MaxKeyLength)
            return BadRequest(new { message = $"ต้องส่ง header {GatewayIdempotency.Header} (ไม่เกิน {GatewayIdempotency.MaxKeyLength} ตัวอักษร) เช่น UUID ใหม่ทุกครั้งที่เป็นคำขอใหม่ ส่งซ้ำด้วยค่าเดิมเมื่อ retry" });

        var start = await idempotency.BeginAsync(caller, op.AuditName, key, null,
            GatewayIdempotency.Hash(op.AuditName, null, new { path = op.ZohoPath, query, body }), ct);
        switch (start.Kind)
        {
            case WriteStartKind.Replay:
                Response.Headers["Idempotent-Replayed"] = "true";
                return new ContentResult { StatusCode = start.Record.StatusCode, Content = start.Record.ResponseJson, ContentType = "application/json; charset=utf-8" };
            case WriteStartKind.InProgress:
                return Conflict(new { message = $"คำขอที่ใช้ {GatewayIdempotency.Header} นี้ยังทำไม่เสร็จ (หรือค้างจากครั้งก่อน) ตรวจใน Zoho ก่อน ถ้าจะส่งใหม่ให้ใช้ key ใหม่" });
            case WriteStartKind.KeyReused:
                return UnprocessableEntity(new { message = $"{GatewayIdempotency.Header} นี้เคยใช้กับคำขออื่นแล้ว คำขอใหม่ต้องใช้ key ใหม่" });
        }

        // เริ่มเขียนแล้วห้ามยกเลิกกลางทาง — Zoho อาจบันทึกไปแล้ว ผลต้องอยู่ใน audit log เสมอ
        var record = start.Record;
        var method = op.Action == ZohoAction.Create ? HttpMethod.Post : HttpMethod.Put;
        try
        {
            var res = await zoho.SendAsync(caller.Env, method, op.ZohoPath + query, body.ToJsonString(), isWrite: true, CancellationToken.None);
            if (res.StatusCode is < 200 or >= 300) throw ToException(res, isWrite: true);

            // เก็บแบบ compact เพื่อให้หา id ของระเบียนที่แอปสร้างได้ (ใช้ตรวจสิทธิ์แก้)
            var compact = Compact(res.Body);
            await idempotency.CompleteRawAsync(record, res.StatusCode, compact, null);
            log.LogInformation("Gateway zoho {Scope} {Operation}: app {AppId} ({AppName}, {Env}) → {Status}",
                op.Scope, op.AuditName, caller.ApplicationId, caller.ApplicationName, caller.Env, res.StatusCode);
            return Json(op, caller.Env, res.StatusCode, compact);
        }
        catch (ZohoException ex) when (!ex.MayHaveChanged)
        {
            // Zoho ยังไม่บันทึกอะไร — ไม่เก็บผล ให้แอป retry ด้วย key เดิมได้
            await idempotency.AbandonAsync(record);
            if (ex.NotConfigured) log.LogError("Gateway zoho ({Env}): {Message}", caller.Env, ex.Message);
            else log.LogWarning("Gateway zoho {Operation}: app {AppId} ({Env}) Zoho ปฏิเสธ {Status}: {Message}",
                op.AuditName, caller.ApplicationId, caller.Env, ex.StatusCode, ex.Message);
            return Error(ex);
        }
        catch (ZohoException ex)
        {
            var error = new { message = ex.Message, zoho = ex.Details };
            await idempotency.CompleteAsync(record, ex.StatusCode, error, null);
            log.LogError("Gateway zoho {Operation}: app {AppId} ({Env}) ผลไม่แน่นอน {Status}: {Message}",
                op.AuditName, caller.ApplicationId, caller.Env, ex.StatusCode, ex.Message);
            return StatusCode(ex.StatusCode, error);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Gateway zoho {Operation}: app {AppId} ({Env}) ผิดพลาดที่ไม่คาดคิด", op.AuditName, caller.ApplicationId, caller.Env);
            var error = new { message = "Gateway ผิดพลาดระหว่างเขียนเข้า Zoho ตรวจใน Zoho ก่อนส่งใหม่ด้วย key ใหม่" };
            await idempotency.CompleteAsync(record, StatusCodes.Status500InternalServerError, error, null);
            return StatusCode(StatusCodes.Status500InternalServerError, error);
        }
    }

    public static string CreateAuditName(string module) => $"POST Zoho {module}";

    /// <summary>
    /// แปลง error ของ Zoho เป็น status ของ Gateway — 400/404/429 ส่งต่อตามจริง,
    /// 401/403 คือ credential / scope ของ Gateway เอง (502), 5xx คือ Zoho ล้ม (502)
    /// </summary>
    public static ZohoException ToException(ZohoResponse res, bool isWrite)
    {
        JsonNode? details = null;
        string? message = null;
        try
        {
            details = JsonNode.Parse(res.Body);
            var err = details?["data"] is JsonArray arr && arr.Count > 0 ? arr[0] : details;
            var code = err?["code"]?.GetValue<string>();
            var text = err?["message"]?.GetValue<string>();
            var field = err?["details"]?["api_name"]?.GetValue<string>();
            message = string.Join(" ", new[] { code, text, field is null ? null : $"(field {field})" }.Where(s => !string.IsNullOrEmpty(s)));
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { }

        message = string.IsNullOrWhiteSpace(message) ? $"Zoho ตอบ {res.StatusCode}" : message;
        return res.StatusCode switch
        {
            400 or 404 or 405 or 409 => new ZohoException(res.StatusCode, message, false, false, details),
            413 => new ZohoException(400, message, false, false, details),
            429 => new ZohoException(429, "เรียก Zoho ถี่เกินกำหนด (API limit) รอสักครู่แล้วลองใหม่: " + message, false, false, details),
            401 or 403 => new ZohoException(502, "Zoho ปฏิเสธ credential ของ Gateway (ตรวจ ZohoConfig และ scope ของ Self Client): " + message, false, false, details),
            _ => new ZohoException(502, $"Zoho ตอบ {res.StatusCode}: {message}", isWrite && res.StatusCode >= 500, false, details),
        };
    }

    private IActionResult Error(ZohoException ex) =>
        ex.Details is null ? StatusCode(ex.StatusCode, new { message = ex.Message }) : StatusCode(ex.StatusCode, new { message = ex.Message, zoho = ex.Details });

    private ContentResult Json(ZohoOperation op, string env, int status, string body)
    {
        Response.Headers[SapSalesOrderProxyController.ScopeHeader] = op.Scope;
        Response.Headers["X-Gateway-Source"] = "zoho";
        Response.Headers["X-Gateway-Env"] = env;
        return new ContentResult { StatusCode = status, Content = body, ContentType = "application/json; charset=utf-8" };
    }

    private static string Compact(string body)
    {
        try { return JsonNode.Parse(body)?.ToJsonString() ?? body; }
        catch (JsonException) { return body; }
    }

    private string ZohoPath()
    {
        var full = Request.Path.Value ?? "";
        var prefix = "/" + RoutePrefix;
        var rest = full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? full[prefix.Length..] : full;
        return rest.Replace("%2F", "/", StringComparison.OrdinalIgnoreCase);
    }
}
