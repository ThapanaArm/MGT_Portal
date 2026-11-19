using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Scheduling;

/// <summary>ประเภทของรายการในปฏิทิน IT — ค่าที่เก็บในคอลัมน์ CalendarEvents.Kind</summary>
public static class CalendarKind
{
    /// <summary>ช่วงเวลาที่ IT ว่าง เปิดให้ User ขอจอง</summary>
    public const string Available = "available";
    /// <summary>วัน deploy แอป (ผูกกับคำขอแอป)</summary>
    public const string Deploy = "deploy";
    /// <summary>นัดคุยกับ User</summary>
    public const string Meeting = "meeting";
    /// <summary>ช่วง Freeze / ปิดระบบ — ห้าม deploy</summary>
    public const string Freeze = "freeze";

    public static bool IsValid(string? kind) => kind is Available or Deploy or Meeting or Freeze;
    /// <summary>รายการที่เป็นการจองเวลา IT (User ขอได้ / IT ลงเองได้)</summary>
    public static bool IsBooking(string? kind) => kind is Deploy or Meeting;

    public static string Label(string kind) => kind switch
    {
        Available => "Available",
        Deploy => "Deploy",
        Meeting => "Meeting",
        Freeze => "Freeze",
        _ => kind,
    };
}

/// <summary>สถานะของการจอง (Deploy / Meeting) — Available และ Freeze เป็น Confirmed เสมอ</summary>
public static class CalendarStatus
{
    public const string Requested = "requested";
    public const string Confirmed = "confirmed";
    public const string Declined = "declined";
    public const string Cancelled = "cancelled";

    /// <summary>ยังใช้เวลานั้นอยู่ (ชนกับการจองอื่นไม่ได้)</summary>
    public static bool IsActive(string status) => status is Requested or Confirmed;
}

/// <summary>
/// หนึ่งรายการในปฏิทิน IT — ช่วงว่างของ IT, วัน deploy, นัดคุยกับ User หรือช่วง Freeze
/// User ขอจองเวลาในช่วงที่ IT เปิดไว้ (Requested) แล้ว IT ยืนยันหรือปฏิเสธ — กติกาอยู่ใน CalendarService
/// เวลาเก็บเป็น UTC
/// </summary>
public class CalendarEvent
{
    public int Id { get; set; }
    public string Kind { get; set; } = CalendarKind.Meeting;
    public string Status { get; set; } = CalendarStatus.Confirmed;
    public string Title { get; set; } = "";
    public string? Note { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }

    /// <summary>คำขอแอปที่เกี่ยวข้อง (จำเป็นสำหรับ Deploy)</summary>
    public int? ApplicationId { get; set; }
    public Application? Application { get; set; }

    /// <summary>User ที่ขอจอง (null เมื่อ IT ลงเอง)</summary>
    public int? RequestedByUserId { get; set; }
    public User? RequestedBy { get; set; }

    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    /// <summary>เหตุผลที่ IT ปฏิเสธ หรือหมายเหตุตอนยืนยัน</summary>
    public string? DecisionNote { get; set; }
}
