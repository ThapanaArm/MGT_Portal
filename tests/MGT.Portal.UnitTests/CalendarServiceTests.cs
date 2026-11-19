using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Modules.Scheduling;

namespace MGT.Portal.UnitTests;

/// <summary>กติกาปฏิทิน IT ใน CalendarService (ช่วงว่าง, การจอง, Freeze, การยืนยัน/ยกเลิก)</summary>
public class CalendarServiceTests
{
    private const string It = "it@megachem.co.th";
    private static readonly DateTime Day = DateTime.UtcNow.Date.AddDays(7);

    private static async Task<(PortalDbContext db, CalendarService calendar, User owner, Application app)> SetupAsync(string status = AppStatus.Active)
    {
        var db = new PortalDbContext(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = new User { Email = "owner@megachem.co.th" };
        var app = new Application { Name = "Leave app", Owner = owner, Status = status };
        db.Applications.Add(app);
        await db.SaveChangesAsync();
        var calendar = new CalendarService(db);
        // IT ว่าง 09:00–12:00
        Assert.True((await calendar.CreateAsync(new(CalendarKind.Available, Day.AddHours(9), Day.AddHours(12), null, null, null), It)).Ok);
        return (db, calendar, owner, app);
    }

    private static CalendarInput Booking(string kind, int startHour, int endHour, int? appId) =>
        new(kind, Day.AddHours(startHour), Day.AddHours(endHour), null, null, appId);

    [Fact]
    public async Task User_books_inside_an_available_slot_and_waits_for_IT()
    {
        var (db, calendar, owner, app) = await SetupAsync();
        await using var _ = db;

        Assert.False((await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 13, 14, null), owner.Id, owner.Email)).Ok); // นอกช่วงว่าง
        var booked = await calendar.RequestBookingAsync(Booking(CalendarKind.Deploy, 10, 11, app.Id), owner.Id, owner.Email);
        Assert.True(booked.Ok);
        Assert.Equal(CalendarStatus.Requested, booked.Event!.Status);
        Assert.Equal("Deploy: Leave app", booked.Event.Title);

        Assert.False((await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 10, 11, null), owner.Id, owner.Email)).Ok); // ชนเวลา
        Assert.True((await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 11, 12, null), owner.Id, owner.Email)).Ok); // ต่อกันได้
    }

    [Fact]
    public async Task Deploy_needs_an_approved_application_owned_by_the_requester()
    {
        var (db, calendar, owner, app) = await SetupAsync(AppStatus.Pending);
        await using var _ = db;
        Assert.False((await calendar.RequestBookingAsync(Booking(CalendarKind.Deploy, 9, 10, app.Id), owner.Id, owner.Email)).Ok);
        Assert.False((await calendar.RequestBookingAsync(Booking(CalendarKind.Deploy, 9, 10, null), owner.Id, owner.Email)).Ok);

        app.Status = AppStatus.Active;
        await db.SaveChangesAsync();
        Assert.False((await calendar.RequestBookingAsync(Booking(CalendarKind.Deploy, 9, 10, app.Id), 999, "other@megachem.co.th")).Ok);
        Assert.True((await calendar.RequestBookingAsync(Booking(CalendarKind.Deploy, 9, 10, app.Id), owner.Id, owner.Email)).Ok);
    }

    [Fact]
    public async Task Deploy_cannot_be_scheduled_during_a_freeze()
    {
        var (db, calendar, owner, app) = await SetupAsync();
        await using var _ = db;
        Assert.True((await calendar.CreateAsync(new(CalendarKind.Freeze, Day, Day.AddDays(1), "Month-end close", null, null), It)).Ok);

        Assert.False((await calendar.RequestBookingAsync(Booking(CalendarKind.Deploy, 9, 10, app.Id), owner.Id, owner.Email)).Ok);
        Assert.False((await calendar.CreateAsync(Booking(CalendarKind.Deploy, 9, 10, app.Id), It)).Ok);
        Assert.True((await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 9, 10, null), owner.Id, owner.Email)).Ok); // นัดคุยได้
    }

    [Fact]
    public async Task IT_confirms_or_declines_with_a_reason_and_users_cancel_their_own()
    {
        var (db, calendar, owner, _) = await SetupAsync();
        await using var __ = db;
        var first = (await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 9, 10, null), owner.Id, owner.Email)).Event!;
        var second = (await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 10, 11, null), owner.Id, owner.Email)).Event!;

        Assert.True((await calendar.DecideAsync(first, true, null, It)).Ok);
        Assert.Equal(CalendarStatus.Confirmed, first.Status);
        Assert.False((await calendar.DecideAsync(second, false, " ", It)).Ok);
        Assert.True((await calendar.DecideAsync(second, false, "IT training that day", It)).Ok);
        Assert.Equal(CalendarStatus.Declined, second.Status);

        // เวลาที่ถูกปฏิเสธว่างให้จองใหม่ได้
        Assert.True((await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 10, 11, null), owner.Id, owner.Email)).Ok);

        Assert.False((await calendar.CancelAsync(first, 999, false, null, "other@megachem.co.th")).Ok);
        Assert.True((await calendar.CancelAsync(first, owner.Id, false, null, owner.Email)).Ok);
        Assert.Equal(CalendarStatus.Cancelled, first.Status);
        Assert.True((await calendar.RequestBookingAsync(Booking(CalendarKind.Meeting, 9, 10, null), owner.Id, owner.Email)).Ok);
    }
}
