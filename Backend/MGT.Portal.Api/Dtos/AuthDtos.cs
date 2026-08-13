namespace MGT.Portal.Api.Dtos;

public record LoginRequest(string Email, string Password);

public record LoginResponse(string Token, UserDto User);

public record UserDto(int Id, string Email, string DisplayName, string RoleKey, string RoleName, string[] Scopes);
