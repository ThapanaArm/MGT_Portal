namespace MGT.Portal.Api.Dtos;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, UserDto User);

public record UserDto(
    int Id, string Email, string DisplayName, string RoleKey, string RoleName, string[] Scopes,
    // ระดับองค์กรและขอบเขตข้อมูล — คนละชั้นกับ Scopes ข้างบน
    // Scopes = เรียก endpoint ไหนได้ / DataScope = เห็นข้อมูลของใครได้
    string Level, string DataScope, string? TeamName);
