using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;

namespace MGT.Portal.Api.Modules.Scheduling;

/// <summary>ผลของคำสั่งในปฏิทิน — Error เป็นข้อความที่ส่งกลับให้ผู้ใช้ได้เลย</summary>
public sealed record CalendarResult(bool Ok, string? Error = null, CalendarEvent? Event = null)
{
    public static CalendarResult Success(CalendarEvent? e = null) => new(true, null, e);
    public static CalendarResult Fail(string error) => new(false, error);
}

/// <summary>ข้อมูลที่ใช้สร้าง/แก้รายการ (เวลาเป็น UTC)</summary>
public sealed record CalendarInput(string Kind, DateTime StartAt, DateTime EndAt, string? Title, string? Note, int? ApplicationId);

/// <summary>
/// กติกาปฏิทิน IT ทั้งหมดอยู่ที่นี่:
///   - IT เปิดช่วงว่าง (Available) และลง Deploy / Meeting / Freeze ได้เอง (Confirmed ทันที)
///   - User ขอจอง Deploy / Meeting ได้เฉพาะในช่วงที่ IT เปิดไว้ (Requested) แล้ว IT ยืนยันหรือปฏิเสธ (ต้องมีเหตุผล)
///   - การจองที่ยังใช้อยู่ (Requested / Confirmed) ชนเวลากันไม่ได้ และ Deploy ลงในช่วง Freeze ไม่ได้
///   - Deploy ต้องผูกกับคำขอแอปที่อนุมัติแล้ว · User จองได้เฉพาะแอปของตัวเอง
/// </summary>
public class CalendarService(PortalDbContext db)
{
    public static readonly TimeSpan MaxBooking = TimeSpan.FromHours(8);
    public static readonly TimeSpan MaxEvent = TimeSpan.FromDays(31);

    private static DateTime Utc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };

    private static string? Clean(string? text, int max)
    {
        var value = text?.Trim();
        if (string.IsNullOrEmpty(value)) return null;
        return value.Length > max ? value[..max] : value;
    }

    private Task<bool> OverlapsBookingAsync(DateTime start, DateTime end, int? exceptId) =>
        db.CalendarEvents.AnyAsync(e => e.Id != exceptId
            && (e.Kind == CalendarKind.Deploy || e.Kind == CalendarKind.Meeting)
            && (e.Status == CalendarStatus.Requested || e.Status == CalendarStatus.Confirmed)
            && e.StartAt < end && start < e.EndAt);

    private Task<bool> OverlapsFreezeAsync(DateTime start, DateTime end, int? exceptId) =>
        db.CalendarEvents.AnyAsync(e => e.Id != exceptId && e.Kind == CalendarKind.Freeze && e.StartAt < end && start < e.EndAt);

    /// <summary>ตรวจรายการก่อนบันทึก — ใช้ทั้งตอน User ขอจอง และตอน IT สร้าง/แก้</summary>
    private async Task<CalendarResult> ValidateAsync(CalendarInput input, int? exceptId, bool booking)
    {
        if (!CalendarKind.IsValid(input.Kind))
            return CalendarResult.Fail("Choose a valid calendar entry type");
        var start = Utc(input.StartAt);
        var end = Utc(input.EndAt);
        if (end <= start)
            return CalendarResult.Fail("The end time must be after the start time");
        if (end - start > (CalendarKind.IsBooking(input.Kind) ? MaxBooking : MaxEvent))
            return CalendarResult.Fail(CalendarKind.IsBooking(input.Kind) ? "A booking can be up to 8 hours" : "An entry can be up to 31 days");
        if (booking && start < DateTime.UtcNow)
            return CalendarResult.Fail("Choose a time in the future");

        if (CalendarKind.IsBooking(input.Kind))
        {
            if (await OverlapsBookingAsync(start, end, exceptId))
                return CalendarResult.Fail("This time is already booked. Choose another time.");
            if (input.Kind == CalendarKind.Deploy && await OverlapsFreezeAsync(start, end, exceptId))
                return CalendarResult.Fail("Deployments can't be scheduled during a freeze");
        }
        if (input.Kind == CalendarKind.Deploy && input.ApplicationId is null)
            return CalendarResult.Fail("Choose the application to deploy");
        if (input.ApplicationId is int appId)
        {
            var app = await db.Applications.AsNoTracking().FirstOrDefaultAsync(a => a.Id == appId);
            if (app is null) return CalendarResult.Fail("Application not found");
            if (input.Kind == CalendarKind.Deploy && app.Status != AppStatus.Active)
                return CalendarResult.Fail("Only approved applications can be scheduled for deployment");
        }
        return CalendarResult.Success();
    }

    private async Task<string> DefaultTitleAsync(string kind, int? applicationId)
    {
        var appName = applicationId is int id ? await db.Applications.Where(a => a.Id == id).Select(a => a.Name).FirstOrDefaultAsync() : null;
        return appName is null ? CalendarKind.Label(kind) : $"{CalendarKind.Label(kind)}: {appName}";
    }

    /// <summary>User ขอจองเวลา IT (Deploy / Meeting) ในช่วงที่ IT เปิดว่างไว้ — รอ IT ยืนยัน</summary>
    public async Task<CalendarResult> RequestBookingAsync(CalendarInput input, int userId, string actor)
    {
        if (!CalendarKind.IsBooking(input.Kind))
            return CalendarResult.Fail("Choose Deploy or Meeting");
        var check = await ValidateAsync(input, null, booking: true);
        if (!check.Ok) return check;
        if (input.ApplicationId is int appId && !await db.Applications.AnyAsync(a => a.Id == appId && a.OwnerUserId == userId))
            return CalendarResult.Fail("You can book only for your own applications");

        var start = Utc(input.StartAt);
        var end = Utc(input.EndAt);
        if (!await db.CalendarEvents.AnyAsync(e => e.Kind == CalendarKind.Available && e.StartAt <= start && end <= e.EndAt))
            return CalendarResult.Fail("Choose a time inside one of IT's available slots");

        var now = DateTime.UtcNow;
        var entry = new CalendarEvent
        {
            Kind = input.Kind, Status = CalendarStatus.Requested, StartAt = start, EndAt = end,
            Title = Clean(input.Title, 200) ?? await DefaultTitleAsync(input.Kind, input.ApplicationId),
            Note = Clean(input.Note, 2000), ApplicationId = input.ApplicationId, RequestedByUserId = userId,
            CreatedBy = actor, CreatedAt = now, UpdatedAt = now,
        };
        db.CalendarEvents.Add(entry);
        await db.SaveChangesAsync();
        return CalendarResult.Success(entry);
    }

    /// <summary>IT ลงรายการเอง — ยืนยันทันที</summary>
    public async Task<CalendarResult> CreateAsync(CalendarInput input, string actor)
    {
        var check = await ValidateAsync(input, null, booking: false);
        if (!check.Ok) return check;
        var now = DateTime.UtcNow;
        var entry = new CalendarEvent
        {
            Kind = input.Kind, Status = CalendarStatus.Confirmed, StartAt = Utc(input.StartAt), EndAt = Utc(input.EndAt),
            Title = Clean(input.Title, 200) ?? await DefaultTitleAsync(input.Kind, input.ApplicationId),
            Note = Clean(input.Note, 2000), ApplicationId = input.ApplicationId,
            CreatedBy = actor, CreatedAt = now, UpdatedAt = now, DecidedBy = actor, DecidedAt = now,
        };
        db.CalendarEvents.Add(entry);
        await db.SaveChangesAsync();
        return CalendarResult.Success(entry);
    }

    /// <summary>IT แก้รายการ (เวลา ชื่อ หมายเหตุ แอป) — การจองของ User ที่ถูกยกเลิก/ปฏิเสธแล้วแก้ไม่ได้</summary>
    public async Task<CalendarResult> UpdateAsync(CalendarEvent entry, CalendarInput input, string actor)
    {
        if (!CalendarStatus.IsActive(entry.Status))
            return CalendarResult.Fail("Cancelled or declined entries can't be edited");
        if (CalendarKind.IsBooking(entry.Kind) != CalendarKind.IsBooking(input.Kind))
            return CalendarResult.Fail("Create a new entry to change the type");
        var check = await ValidateAsync(input, entry.Id, booking: false);
        if (!check.Ok) return check;

        entry.Kind = input.Kind;
        entry.StartAt = Utc(input.StartAt);
        entry.EndAt = Utc(input.EndAt);
        entry.Title = Clean(input.Title, 200) ?? await DefaultTitleAsync(input.Kind, input.ApplicationId);
        entry.Note = Clean(input.Note, 2000);
        entry.ApplicationId = input.ApplicationId;
        entry.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return CalendarResult.Success(entry);
    }

    /// <summary>IT ยืนยันหรือปฏิเสธคำขอจอง (ปฏิเสธต้องมีเหตุผล)</summary>
    public async Task<CalendarResult> DecideAsync(CalendarEvent entry, bool confirm, string? note, string actor)
    {
        if (entry.Status != CalendarStatus.Requested)
            return CalendarResult.Fail("This booking is not waiting for a decision");
        if (!confirm && string.IsNullOrWhiteSpace(note))
            return CalendarResult.Fail("Enter a reason for declining");
        if (confirm && entry.Kind == CalendarKind.Deploy && await OverlapsFreezeAsync(entry.StartAt, entry.EndAt, entry.Id))
            return CalendarResult.Fail("Deployments can't be scheduled during a freeze");

        var now = DateTime.UtcNow;
        entry.Status = confirm ? CalendarStatus.Confirmed : CalendarStatus.Declined;
        entry.DecidedBy = actor;
        entry.DecidedAt = now;
        entry.DecisionNote = Clean(note, 2000);
        entry.UpdatedAt = now;
        await db.SaveChangesAsync();
        return CalendarResult.Success(entry);
    }

    /// <summary>ยกเลิกการจอง — ผู้ขอยกเลิกของตัวเองได้ IT ยกเลิกได้ทุกรายการ (เก็บไว้เป็นประวัติ)</summary>
    public async Task<CalendarResult> CancelAsync(CalendarEvent entry, int userId, bool isAdmin, string? note, string actor)
    {
        if (!CalendarKind.IsBooking(entry.Kind))
            return CalendarResult.Fail("Only bookings can be cancelled. Delete the entry instead.");
        if (!isAdmin && entry.RequestedByUserId != userId)
            return CalendarResult.Fail("You can cancel only your own bookings");
        if (!CalendarStatus.IsActive(entry.Status))
            return CalendarResult.Fail("This booking is already closed");

        var now = DateTime.UtcNow;
        entry.Status = CalendarStatus.Cancelled;
        entry.DecidedBy = actor;
        entry.DecidedAt = now;
        entry.DecisionNote = Clean(note, 2000);
        entry.UpdatedAt = now;
        await db.SaveChangesAsync();
        return CalendarResult.Success(entry);
    }
}
