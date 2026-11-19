using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Scheduling;

/// <summary>
/// ปฏิทิน IT: ช่วงว่าง, วัน deploy, นัดคุย และช่วง Freeze — ทุกคนดูได้ User ขอจองได้ IT จัดการ
/// กติกาอยู่ใน CalendarService
/// </summary>
[ApiController]
[Route("api/calendar")]
[Authorize]
public class CalendarController(PortalDbContext db, CalendarService calendar) : ControllerBase
{
    private static readonly TimeSpan MaxRange = TimeSpan.FromDays(120);
    private string Actor => User.Email() ?? "";

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private CalendarEventDto ToDto(CalendarEvent e)
    {
        var me = User.Id();
        var mine = e.RequestedByUserId == me;
        var hidden = CalendarKind.IsBooking(e.Kind) && !mine && !User.IsAdmin();
        return new CalendarEventDto(
            e.Id, e.Kind, e.Status, hidden ? "Booked" : e.Title, hidden ? null : e.Note, AsUtc(e.StartAt), AsUtc(e.EndAt),
            hidden ? null : e.ApplicationId, hidden ? null : e.Application?.Name,
            hidden ? null : e.RequestedBy?.DisplayName, hidden ? null : e.RequestedBy?.Email,
            hidden ? null : e.DecidedBy, e.DecidedAt is DateTime decided ? AsUtc(decided) : null, hidden ? null : e.DecisionNote,
            AsUtc(e.UpdatedAt), mine, hidden);
    }

    private ActionResult Error(CalendarResult r) => BadRequest(new { message = r.Error });

    private Task<CalendarEvent?> FindAsync(int id) =>
        db.CalendarEvents.Include(e => e.Application).Include(e => e.RequestedBy).FirstOrDefaultAsync(e => e.Id == id);

    private static CalendarInput Input(CalendarEventRequest req) =>
        new(req.Kind?.Trim().ToLowerInvariant() ?? "", req.StartAt, req.EndAt, req.Title, req.Note, req.ApplicationId);

    /// <summary>
    /// รายการที่อยู่ในช่วง from–to (ไม่เกิน 120 วัน) — ไม่แสดงการจองที่ถูกยกเลิก/ปฏิเสธ ยกเว้นของตัวเองและสำหรับ IT
    /// applicationId: เฉพาะรายการของแอปนั้น (ใช้ในหน้าคำขอแอป)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<CalendarEventDto>>> List([FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] int? applicationId = null)
    {
        var start = DateTime.SpecifyKind(from.ToUniversalTime(), DateTimeKind.Utc);
        var end = DateTime.SpecifyKind(to.ToUniversalTime(), DateTimeKind.Utc);
        if (end <= start || end - start > MaxRange)
            return BadRequest(new { message = "Choose a range of up to 120 days" });

        var me = User.Id();
        var admin = User.IsAdmin();
        var query = db.CalendarEvents.AsNoTracking().Include(e => e.Application).Include(e => e.RequestedBy)
            .Where(e => e.StartAt < end && start < e.EndAt)
            .Where(e => admin || e.RequestedByUserId == me || e.Status == CalendarStatus.Requested || e.Status == CalendarStatus.Confirmed);
        if (applicationId is int appId)
        {
            if (!admin && !await db.Applications.AnyAsync(a => a.Id == appId && a.OwnerUserId == me)) return Forbid();
            query = query.Where(e => e.ApplicationId == appId);
        }
        var events = await query.OrderBy(e => e.StartAt).ToListAsync();
        return events.Select(ToDto).ToList();
    }

    /// <summary>จำนวนคำขอจองที่รอ IT ยืนยัน (แสดงเป็นตัวเลขที่เมนู)</summary>
    [HttpGet("summary")]
    public async Task<CalendarSummaryDto> Summary() =>
        new(User.IsAdmin() ? await db.CalendarEvents.CountAsync(e => e.Status == CalendarStatus.Requested && e.EndAt > DateTime.UtcNow) : 0);

    /// <summary>User ขอจองเวลา IT (Deploy / Meeting) ในช่วงที่ IT เปิดว่าง</summary>
    [HttpPost("bookings")]
    public async Task<ActionResult<CalendarEventDto>> RequestBooking(CalendarEventRequest req)
    {
        var result = await calendar.RequestBookingAsync(Input(req), User.Id(), Actor);
        if (!result.Ok) return Error(result);
        return ToDto((await FindAsync(result.Event!.Id))!);
    }

    /// <summary>IT ลงรายการเอง (ยืนยันทันที)</summary>
    [HttpPost("events")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<CalendarEventDto>> Create(CalendarEventRequest req)
    {
        var result = await calendar.CreateAsync(Input(req), Actor);
        if (!result.Ok) return Error(result);
        return ToDto((await FindAsync(result.Event!.Id))!);
    }

    [HttpPut("events/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Update(int id, CalendarEventRequest req)
    {
        var entry = await FindAsync(id);
        if (entry is null) return NotFound();
        var result = await calendar.UpdateAsync(entry, Input(req), Actor);
        return result.Ok ? NoContent() : Error(result);
    }

    [HttpPost("events/{id:int}/decision")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Decide(int id, CalendarDecisionRequest req)
    {
        var entry = await FindAsync(id);
        if (entry is null) return NotFound();
        var result = await calendar.DecideAsync(entry, req.Confirm, req.Note, Actor);
        return result.Ok ? NoContent() : Error(result);
    }

    /// <summary>ยกเลิกการจอง — ผู้ขอยกเลิกของตัวเอง หรือ IT</summary>
    [HttpPost("events/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CalendarCancelRequest req)
    {
        var entry = await FindAsync(id);
        if (entry is null) return NotFound();
        var result = await calendar.CancelAsync(entry, User.Id(), User.IsAdmin(), req.Note, Actor);
        return result.Ok ? NoContent() : Error(result);
    }

    /// <summary>IT ลบรายการ (ช่วงว่าง / Freeze / รายการที่ลงผิด)</summary>
    [HttpDelete("events/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var entry = await db.CalendarEvents.FindAsync(id);
        if (entry is null) return NotFound();
        db.CalendarEvents.Remove(entry);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
