namespace MGT.Portal.Api.Dtos;

public record UserBriefDto(
    int Id, string Email, string DisplayName, string RoleKey, string RoleName,
    string Level, int? TeamId, string? TeamName,
    string? DataScopeOverride, string EffectiveDataScope);

public record TeamDto(int Id, string Key, string Name, int MemberCount);

/// <summary>ตั้งระดับองค์กร ทีม และขอบเขตข้อมูลเฉพาะรายของผู้ใช้หนึ่งคน</summary>
public record UpdateUserScopeRequest(string Level, int? TeamId, string? DataScopeOverride);

public record AccessGrantDto(
    int Id,
    int UserId, string UserEmail, string UserDisplayName,
    int CategoryId, string CategoryKey, string CategoryName,
    string Scope,
    DateTime GrantedAt, DateTime? ExpiresAt, bool Revoked, bool IsExpired,
    string GrantedByName, string? Note);

public record CreateAccessGrantRequest(int UserId, int CategoryId, string Scope, int? DurationDays, string? Note);
