namespace MGT.Portal.Api.Modules.Apps;

/// <param name="Type">Tier ที่ได้รับอนุมัติแล้ว (tier1 / tier2 / tier3)</param>
/// <param name="ReviewTarget">Tier ที่ขอในรอบรีวิวปัจจุบัน</param>
/// <param name="Audience">ใครใช้ App ได้ (self / department / company)</param>
/// <param name="RequestedTier">Tier ที่กำลังขอ (ระหว่างเตรียม/พัฒนา/รีวิว) — null เมื่อไม่ได้อยู่ระหว่างขอ</param>
public record AppSummaryDto(
    int Id, string Name, string Description, string Subdomain, string Github,
    string[] Products, string Status, string Type, string? ReviewTarget,
    string? Image, string Icon, string OwnerEmail, DateTime CreatedAt, DateTime UpdatedAt,
    string Audience, string? ProcessStage = null, string? RequestedTier = null, string? OwnerDisplayName = null);

/// <summary>Hidden = true: Production key ที่ผู้ดูไม่ใช่ IT — TokenId ถูกปิดบางส่วน และไม่ส่ง TokenSecret มา</summary>
public record CredentialDto(string Env, string Category, string TokenId, string TokenSecret, DateTime CreatedAt, bool Hidden = false);

public record LogEntryDto(string ActionType, DateTime OccurredAt, string Actor, string? Note);

public record VoteDto(int ReviewerUserId, string MemberName, string MemberEmail, bool Approved,
    string? ActorEmail, DateTime? DecidedAt, string? Note, bool Rejected = false);

/// <summary>การขอแก้ไขหนึ่งครั้ง (จาก IT review หรือกรรมการ) — ทุกรอบรีวิว ใหม่สุดก่อน</summary>
/// <param name="Source">it / committee</param>
public record ChangeRequestDto(int Cycle, string Source, string By, DateTime At, string? Note, List<string> Links, int? ResolvedInCycle = null, string? ResolvedBy = null, DateTime? ResolvedAt = null);

/// <summary>กรรมการของ App (รายแอป, IT เลือก/เปลี่ยนได้ทุกเมื่อ)</summary>
public record ReviewerDto(int UserId, string Name, string Email, DateTime AssignedAt, string AssignedBy);

/// <summary>ผล IT code review ของรอบรีวิวปัจจุบัน</summary>
public record CodeReviewDto(bool Approved, string ReviewerEmail, string? Note, DateTime ReviewedAt, List<string>? Links = null);

/// <param name="RequiredVotes">จำนวนเสียงที่ต้องได้สำหรับ Tier ที่ขอ</param>
/// <param name="RequiresCodeReview">Tier ที่ขอต้องผ่าน IT code review หรือไม่</param>
/// <param name="Reviewers">กรรมการของ App นี้ (สูงสุด CommitteeSize คน)</param>
/// <param name="CommitteeSize">จำนวนกรรมการของคำขอนี้ (5 คน หรือ 4 ถ้าผู้ขอเป็นกรรมการเอง)</param>
public record AppDetailDto(AppSummaryDto Summary, List<string> Screenshots, List<CredentialDto> Credentials,
    List<LogEntryDto> Log, List<VoteDto> Votes, int ReviewCycle,
    CodeReviewDto? CodeReview, int RequiredVotes, bool RequiresCodeReview, DevelopmentRequest? Development = null,
    List<ReviewerDto>? Reviewers = null, List<ChangeRequestDto>? ChangeRequests = null, bool CanEditData = false,
    int CommitteeSize = AppTier.CommitteeSize);

public record CreateAppRequest(
    string Name, string Description, string Subdomain, string Github, string[] Products,
    string? Image, string? Icon, List<string>? Screenshots, string? Audience);

public record UpdateAppRequest(
    string Name, string Description, string Subdomain, string Github, string[] Products,
    string? Image, string? Icon, List<string>? Screenshots, string? Audience);

/// <param name="TargetType">Tier ที่ขอ (tier1 / tier2 / tier3)</param>
public record SendReviewRequest(string TargetType);

/// <summary>Reject = true: ปฏิเสธคำขอ (ต้องมี Note เป็นเหตุผล) · Approved = false และ Reject = false: ขอให้แก้</summary>
public record VoteRequest(bool Approved, string? Note = null, bool Reject = false);

/// <summary>IT เปิดคำขอที่ถูก Reject กลับมาพัฒนาใหม่ — ต้องมีเหตุผล</summary>
public record ReopenRequest(string? Note);

/// <param name="Links">ลิงก์เอกสารประกอบ https:// (เช่น SharePoint) ไม่เกิน 5 ลิงก์</param>
public record CodeReviewRequest(bool Approved, string? Note, List<string>? Links = null, List<int>? ResolvedCycles = null, bool ResolveOnly = false);

public record SetAppRepositoryRequest(string Github);

/// <summary>กรรมการหนึ่งคนในคณะกรรมการชุดเดียวของ Portal</summary>
public record CommitteeMemberDto(int UserId, string Email, string DisplayName);

/// <summary>IT ตั้งคณะกรรมการทั้งชุด — ต้องครบ AppTier.CommitteeSize คน ไม่ซ้ำกัน คนที่ไม่อยู่ในรายการจะถูกเอาออก</summary>
public record SetCommitteeRequest(List<int>? UserIds);

/// <param name="IsReviewer">อยู่ในคณะกรรมการ หรือเคยเป็นกรรมการของ App ใด</param>
/// <param name="PendingAssigned">จำนวนคำขอที่รอรีวิวและผู้ใช้เป็นกรรมการ</param>
public record CommitteeStatusDto(bool IsReviewer, int PendingAssigned);
