namespace MGT.Portal.Api.Modules.Identity;

public record UserBriefDto(
    int Id, string Email, string DisplayName, string RoleKey, string RoleName,
    string Level, int? TeamId, string? TeamName,
    string? DataScopeOverride, string EffectiveDataScope,
    string? SaleGroupName = null, List<string>? PlatformIds = null,
    string? ReadDataScope = null, string? WriteDataScope = null,
    string EffectiveWriteDataScope = DataScope.Self);

public record TeamDto(int Id, string Key, string Name, int MemberCount);

/// <summary>ตั้งระดับองค์กร ทีม และขอบเขตข้อมูลเฉพาะรายของผู้ใช้หนึ่งคน</summary>
public record UpdateUserScopeRequest(string Level, int? TeamId, string? DataScopeOverride);

public record UpdateUserPermissionsRequest(int? TeamId, string ReadScope, string WriteScope);
