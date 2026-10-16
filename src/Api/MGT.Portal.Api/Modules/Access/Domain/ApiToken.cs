using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Access;

/// <summary>
/// Ad-hoc scope-based bearer token a user can generate from the "My Tokens" page,
/// separate from the per-Application Token ID/Secret credentials.
/// </summary>
public class ApiToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string Value { get; set; } = "";
    public string ScopesCsv { get; set; } = "";
    public string Env { get; set; } = CredEnv.Sandbox;
    public string Expiry { get; set; } = "90 วัน";
    public DateTime CreatedAt { get; set; }
    public bool Revoked { get; set; }
}
