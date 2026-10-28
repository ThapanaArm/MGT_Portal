using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MGT.Portal.Api.Modules.Gateway;

public sealed record GatewayPage<T>(List<T> Data, GatewayPageInfo Page, GatewayMeta Meta);
public sealed record GatewayPageInfo(int Limit, int Offset, long? Total);
public sealed record GatewayMeta(string Source, string Env);

/// <summary>
/// API จริงของหมวด Sales ที่แอปซึ่งอนุมัติแล้วเรียกด้วย Token ID/Secret
/// ไม่ใช้ JWT ของหน้า Portal — ตรวจสิทธิ์ด้วย GatewayAuth แทน
/// </summary>
[ApiController]
[Route("api/v1/sales")]
[AllowAnonymous]
public class SalesGatewayController(
    GatewayAuth auth, SupabaseSaleOrderClient supabase, ILogger<SalesGatewayController> log) : ControllerBase
{
    private const string Category = "sales";
    private const int MaxLimit = 500;

    /// <summary>ดึงรายการขาย (SaleOrder) กรองตามปี ลูกค้า สินค้า หรือหมวดสินค้า</summary>
    [HttpGet("orders")]
    public async Task<IActionResult> ListOrders(
        [FromQuery] int? year,
        [FromQuery] string? customer,
        [FromQuery] string? productCode,
        [FromQuery] string? category,
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0,
        CancellationToken ct = default)
    {
        var who = await auth.AuthenticateAsync(Request, Category, ct);
        if (!who.Ok) return StatusCode(who.StatusCode, new { message = who.Error });

        if (limit is < 1 or > MaxLimit)
            return BadRequest(new { message = $"limit ต้องอยู่ระหว่าง 1 ถึง {MaxLimit}" });
        if (offset < 0)
            return BadRequest(new { message = "offset ต้องไม่ติดลบ" });

        var caller = who.Caller!;
        try
        {
            var (rows, total) = await supabase.ListAsync(caller.Env,
                new SaleOrderQuery(year, customer, productCode, category, limit, offset), ct);

            log.LogInformation("Gateway sales/orders: app {AppId} ({AppName}, {Env}) ได้ {Count} แถว",
                caller.ApplicationId, caller.ApplicationName, caller.Env, rows.Count);

            return Ok(new GatewayPage<SaleOrderDto>(rows, new GatewayPageInfo(limit, offset, total),
                new GatewayMeta("supabase", caller.Env)));
        }
        catch (SupabaseException ex) when (ex.NotConfigured)
        {
            log.LogError("Gateway: {Message}", ex.Message);
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = $"Gateway ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase ของ {caller.Env}" });
        }
        catch (Exception ex) when (ex is SupabaseException or HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            log.LogError(ex, "Gateway: ดึง SaleOrder จาก Supabase ไม่สำเร็จ");
            return StatusCode(StatusCodes.Status502BadGateway,
                new { message = "ดึงข้อมูลจาก Supabase ไม่สำเร็จ ลองใหม่อีกครั้ง" });
        }
    }
}
