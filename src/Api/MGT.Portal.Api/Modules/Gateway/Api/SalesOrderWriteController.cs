using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// สร้าง / แก้ / ยกเลิก Sales Order — เขียนตรงเข้า SAP (API_SALES_ORDER_SRV) ยังไม่เขียน Supabase
/// ตรวจสิทธิ์ด้วย Token ID/Secret ของแอปที่ได้หมวด Sales (GatewayAuth) เหมือน GET
/// Sandbox token → SAP UAT, Production token → SAP Production
/// ทุกคำขอต้องมี Idempotency-Key และถูกบันทึกใน GatewayWriteRecords (audit log)
/// แก้และยกเลิกได้เฉพาะ SO ที่แอปเดียวกันสร้างผ่าน Gateway ใน env เดียวกัน
/// </summary>
[ApiController]
[Route("api/v1/sales/orders")]
[AllowAnonymous]
public partial class SalesOrderWriteController(
    GatewayAuth auth, GatewayIdempotency idempotency, SapSalesOrderClient sap,
    ILogger<SalesOrderWriteController> log) : ControllerBase
{
    private const string Category = "sales";

    /// <summary>สร้าง Sales Order ใหม่ใน SAP</summary>
    [HttpPost]
    public Task<IActionResult> Create([FromBody] CreateSalesOrderRequest body, CancellationToken ct) =>
        RunAsync(GatewayWriteOperation.CreateSalesOrder, null, body, StatusCodes.Status201Created,
            env => sap.CreateAsync(env, body, CancellationToken.None), ct);

    /// <summary>แก้ PO ลูกค้า วันที่ต้องการรับสินค้า หรือจำนวนของแต่ละรายการ</summary>
    [HttpPatch("{salesOrder}")]
    public Task<IActionResult> Update(string salesOrder, [FromBody] UpdateSalesOrderRequest body, CancellationToken ct)
    {
        if (body.IsEmpty)
            return Task.FromResult<IActionResult>(BadRequest(new { message = "ต้องส่งอย่างน้อย 1 ฟิลด์: customerPurchaseOrder, requestedDeliveryDate หรือ items" }));
        return RunAsync(GatewayWriteOperation.UpdateSalesOrder, salesOrder, body, StatusCodes.Status200OK,
            env => sap.UpdateAsync(env, salesOrder, body, CancellationToken.None), ct);
    }

    /// <summary>ยกเลิก Sales Order (ใส่ Rejection Reason ทุกรายการ) — ไม่มี DELETE</summary>
    [HttpPost("{salesOrder}/cancel")]
    public Task<IActionResult> Cancel(
        string salesOrder,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CancelSalesOrderRequest? body,
        CancellationToken ct)
    {
        var request = body ?? new CancelSalesOrderRequest(null);
        return RunAsync(GatewayWriteOperation.CancelSalesOrder, salesOrder, request, StatusCodes.Status200OK,
            env => sap.CancelAsync(env, salesOrder, request.ReasonCode, CancellationToken.None), ct);
    }

    private async Task<IActionResult> RunAsync(
        string operation, string? salesOrder, object body, int successStatus,
        Func<string, Task<SalesOrderResult>> write, CancellationToken ct)
    {
        var who = await auth.AuthenticateAsync(Request, Category, ct);
        if (!who.Ok) return StatusCode(who.StatusCode, new { message = who.Error });
        var caller = who.Caller!;

        if (salesOrder is not null && !SalesOrderNumber().IsMatch(salesOrder))
            return BadRequest(new { message = "เลขที่ Sales Order ต้องเป็นตัวเลขไม่เกิน 10 หลัก" });

        var key = Request.Headers[GatewayIdempotency.Header].ToString().Trim();
        if (key.Length is 0 or > GatewayIdempotency.MaxKeyLength)
            return BadRequest(new { message = $"ต้องส่ง header {GatewayIdempotency.Header} (ไม่เกิน {GatewayIdempotency.MaxKeyLength} ตัวอักษร) เช่น UUID ใหม่ทุกครั้งที่เป็นคำขอใหม่ ส่งซ้ำด้วยค่าเดิมเมื่อ retry" });

        if (salesOrder is not null && !await idempotency.CreatedByAsync(caller, salesOrder, ct))
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = $"แอปนี้แก้หรือยกเลิกได้เฉพาะ Sales Order ที่แอปสร้างผ่าน Gateway ใน {caller.Env} เท่านั้น" });

        var start = await idempotency.BeginAsync(caller, operation, key,
            salesOrder, GatewayIdempotency.Hash(operation, salesOrder, body), ct);
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
            var result = await write(caller.Env);
            var payload = new SalesOrderWriteResponse(result, new GatewayMeta("sap", caller.Env));
            await idempotency.CompleteAsync(record, successStatus, payload, result.SalesOrder);
            log.LogInformation("Gateway {Operation}: app {AppId} ({AppName}, {Env}) SO {SalesOrder}",
                operation, caller.ApplicationId, caller.ApplicationName, caller.Env, result.SalesOrder);
            return StatusCode(successStatus, payload);
        }
        catch (SapException ex) when (!ex.MayHaveChanged)
        {
            // SAP ยังไม่เปลี่ยนอะไร — ไม่เก็บผล ให้แอป retry ด้วย key เดิมได้
            await idempotency.AbandonAsync(record);
            if (ex.NotConfigured) log.LogError("Gateway {Operation} ({Env}): {Message}", operation, caller.Env, ex.Message);
            else log.LogWarning("Gateway {Operation}: app {AppId} ({Env}) SAP ปฏิเสธ {Status}: {Message}",
                operation, caller.ApplicationId, caller.Env, ex.StatusCode, ex.Message);
            return StatusCode(ex.StatusCode, new { message = ex.Message });
        }
        catch (SapException ex)
        {
            var error = new { message = ex.Message };
            await idempotency.CompleteAsync(record, ex.StatusCode, error, salesOrder);
            log.LogError("Gateway {Operation}: app {AppId} ({Env}) ผลไม่แน่นอน {Status}: {Message}",
                operation, caller.ApplicationId, caller.Env, ex.StatusCode, ex.Message);
            return StatusCode(ex.StatusCode, error);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Gateway {Operation}: app {AppId} ({Env}) ผิดพลาดที่ไม่คาดคิด", operation, caller.ApplicationId, caller.Env);
            var error = new { message = "Gateway ผิดพลาดระหว่างเขียนเข้า SAP ตรวจใน SAP ก่อนส่งใหม่ด้วย key ใหม่" };
            await idempotency.CompleteAsync(record, StatusCodes.Status500InternalServerError, error, salesOrder);
            return StatusCode(StatusCodes.Status500InternalServerError, error);
        }
    }

    [GeneratedRegex("^[0-9]{1,10}$")]
    private static partial Regex SalesOrderNumber();
}
