namespace MGT.Portal.Api.Modules.Scheduling;

/// <summary>
/// รายการในปฏิทิน — การจองของคนอื่นแสดงแค่ว่าเวลานั้นถูกจองแล้ว (Title "Booked", ไม่มีหมายเหตุ/แอป/ผู้ขอ) ยกเว้น IT
/// </summary>
/// <param name="Mine">ผู้ใช้ที่เรียกเป็นคนขอจองรายการนี้</param>
/// <param name="Private">ซ่อนรายละเอียดเพราะเป็นการจองของคนอื่น</param>
public record CalendarEventDto(
    int Id, string Kind, string Status, string Title, string? Note, DateTime StartAt, DateTime EndAt,
    int? ApplicationId, string? ApplicationName, string? RequestedByName, string? RequestedByEmail,
    string? DecidedBy, DateTime? DecidedAt, string? DecisionNote, DateTime UpdatedAt, bool Mine, bool Private);

/// <summary>สร้าง/แก้รายการ หรือขอจอง — เวลาเป็น ISO 8601 (UTC)</summary>
public record CalendarEventRequest(string Kind, DateTime StartAt, DateTime EndAt, string? Title = null, string? Note = null, int? ApplicationId = null);

public record CalendarDecisionRequest(bool Confirm, string? Note = null);

public record CalendarCancelRequest(string? Note = null);

/// <param name="Requested">คำขอจองที่รอ IT ยืนยัน (IT เท่านั้น นอกนั้นเป็น 0)</param>
public record CalendarSummaryDto(int Requested);
