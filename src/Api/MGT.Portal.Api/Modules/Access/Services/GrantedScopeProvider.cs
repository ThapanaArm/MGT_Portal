using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Access;

/// <summary>scope ที่ผู้ดูแลระบบให้เพิ่มผ่าน AccessGrant — นับเฉพาะที่ยังไม่ถูกยกเลิกและยังไม่หมดอายุ</summary>
public class GrantedScopeProvider(PortalDbContext db) : IUserScopeProvider
{
    public async Task<IReadOnlyList<string>> GetGrantedScopesAsync(int userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await db.AccessGrants
            .Where(g => g.UserId == userId && !g.Revoked && (g.ExpiresAt == null || g.ExpiresAt > now))
            .Select(g => g.Scope)
            .ToListAsync(ct);
    }
}
