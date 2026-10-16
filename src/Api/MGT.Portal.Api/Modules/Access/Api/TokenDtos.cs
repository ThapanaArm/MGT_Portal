namespace MGT.Portal.Api.Modules.Access;

public record TokenDto(int Id, string Value, string[] Scopes, string Env, string Expiry, DateTime CreatedAt);

public record CreateTokenRequest(string[] Scopes, string Env, string Expiry);
