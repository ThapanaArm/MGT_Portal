namespace MGT.Portal.Api.Modules.Identity;

public record LoginRequest(string Email, string Password);
/// <summary>Development only: one account offered for quick sign-in on the login page.</summary>
public record DevAccountDto(string Email, string DisplayName, string RoleName);
/// <summary>Development only: sign in as this account without a password.</summary>
public record DevLoginRequest(string Email);

public record LoginResponse(string Token, UserDto User);

public record UserDto(
    int Id, string Email, string DisplayName, string RoleKey, string RoleName, string[] Scopes,
    // ระดับองค์กรและขอบเขตข้อมูล — คนละชั้นกับ Scopes ข้างบน
    // Scopes = เรียก endpoint ไหนได้ / DataScope = เห็นข้อมูลของใครได้
    string Level, string DataScope, string? TeamName, Dictionary<string, ApiScopeOverrideDto>? ApiPermissions = null);

public record ApiScopeOverrideDto(string ReadScope, string WriteScope);
