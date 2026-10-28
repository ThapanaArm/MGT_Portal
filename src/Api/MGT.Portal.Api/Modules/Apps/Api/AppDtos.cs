namespace MGT.Portal.Api.Modules.Apps;

/// <param name="Type">Tier ที่ได้รับอนุมัติแล้ว (tier1 / tier2 / tier3)</param>
/// <param name="ReviewTarget">Tier ที่ขอในรอบรีวิวปัจจุบัน</param>
/// <param name="Audience">ใครใช้ App ได้ (self / department / company)</param>
public record AppSummaryDto(
    int Id, string Name, string Description, string Subdomain, string Github,
    string[] Products, string Status, string Type, string? ReviewTarget,
    string? Image, string Icon, string OwnerEmail, DateTime CreatedAt, DateTime UpdatedAt,
    string Audience, string? ProcessStage = null);

public record CredentialDto(string Env, string Category, string TokenId, string TokenSecret, DateTime CreatedAt);

public record LogEntryDto(string ActionType, DateTime OccurredAt, string Actor, string? Note);

public record VoteDto(int CommitteeMemberId, string MemberName, string MemberRoleTitle, bool Approved,
    string? ActorEmail, DateTime? DecidedAt, string? Note);

/// <summary>ผล IT code review ของรอบรีวิวปัจจุบัน</summary>
public record CodeReviewDto(bool Approved, string ReviewerEmail, string? Note, DateTime ReviewedAt);

/// <param name="RequiredVotes">จำนวนเสียงที่ต้องได้สำหรับ Tier ที่ขอ</param>
/// <param name="RequiresCodeReview">Tier ที่ขอต้องผ่าน IT code review หรือไม่</param>
public record AppDetailDto(AppSummaryDto Summary, List<string> Screenshots, List<CredentialDto> Credentials,
    List<LogEntryDto> Log, List<VoteDto> Votes, int ReviewCycle,
    CodeReviewDto? CodeReview, int RequiredVotes, bool RequiresCodeReview, DevelopmentRequest? Development = null);

public record CreateAppRequest(
    string Name, string Description, string Subdomain, string Github, string[] Products,
    string? Image, string? Icon, List<string>? Screenshots, string? Audience);

public record UpdateAppRequest(
    string Name, string Description, string Subdomain, string Github, string[] Products,
    string? Image, string? Icon, List<string>? Screenshots, string? Audience);

/// <param name="TargetType">Tier ที่ขอ (tier1 / tier2 / tier3)</param>
public record SendReviewRequest(string TargetType);

public record VoteRequest(bool Approved, string? Note = null);

public record CodeReviewRequest(bool Approved, string? Note);

public record SetAppRepositoryRequest(string Github);

public record CommitteeMemberDto(int Id, string Name, string RoleTitle, int? UserId, string? Email);
public record AssignCommitteeMemberRequest(int? UserId);
