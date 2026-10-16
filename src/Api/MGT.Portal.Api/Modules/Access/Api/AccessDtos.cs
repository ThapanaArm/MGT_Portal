namespace MGT.Portal.Api.Modules.Access;

public record AccessGrantDto(
    int Id,
    int UserId, string UserEmail, string UserDisplayName,
    int CategoryId, string CategoryKey, string CategoryName,
    string Scope,
    DateTime GrantedAt, DateTime? ExpiresAt, bool Revoked, bool IsExpired,
    string GrantedByName, string? Note);

public record CreateAccessGrantRequest(int UserId, int CategoryId, string Scope, int? DurationDays, string? Note);
