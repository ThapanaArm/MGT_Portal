namespace MGT.Portal.Api.Modules.Apps;

public record AppSummaryDto(
    int Id, string Name, string Description, string Subdomain, string Github,
    string[] Products, string Status, string Type, string? ReviewTarget,
    string? Image, string Icon, string OwnerEmail, DateTime CreatedAt, DateTime UpdatedAt);

public record CredentialDto(string Env, string TokenId, string TokenSecret, DateTime CreatedAt);

public record LogEntryDto(string ActionType, DateTime OccurredAt, string Actor, string? Note);

public record VoteDto(int CommitteeMemberId, string MemberName, string MemberRoleTitle, bool Approved);

public record AppDetailDto(AppSummaryDto Summary, List<string> Screenshots, List<CredentialDto> Credentials,
    List<LogEntryDto> Log, List<VoteDto> Votes, int ReviewCycle);

public record CreateAppRequest(
    string Name, string Description, string Subdomain, string Github, string[] Products,
    string? Image, string? Icon, List<string>? Screenshots);

public record UpdateAppRequest(
    string Name, string Description, string Subdomain, string Github, string[] Products,
    string? Image, string? Icon, List<string>? Screenshots);

public record SendReviewRequest(string TargetType);

public record CommitteeMemberDto(int Id, string Name, string RoleTitle);
