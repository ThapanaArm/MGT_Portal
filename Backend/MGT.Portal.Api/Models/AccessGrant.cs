namespace MGT.Portal.Api.Models;

/// <summary>
/// Admin-issued, time-boxed permission letting a specific User use a specific API category
/// beyond what their Role already grants. Independent of Role.ScopesCsv.
/// </summary>
public class AccessGrant
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public int CategoryId { get; set; }
    public ApiCategory Category { get; set; } = null!;

    public string Scope { get; set; } = ""; // e.g. "sales.read" or "sales.write"

    public int GrantedByUserId { get; set; }
    public User GrantedByUser { get; set; } = null!;

    public DateTime GrantedAt { get; set; }
    public DateTime? ExpiresAt { get; set; } // null = ไม่มีกำหนด (permanent)
    public bool Revoked { get; set; }
    public string Note { get; set; } = "";
}
