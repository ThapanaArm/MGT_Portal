using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Identity;

public static class JwtSessionValidator
{
    public static async Task<bool> IsCurrentAsync(PortalDbContext db, ClaimsPrincipal? principal, CancellationToken ct, string signingKey)
    {
        if (!int.TryParse(principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return false;
        var current = await db.Users.AsNoTracking().Where(user => user.Id == id).Select(user => new { user.PasswordHash, Role = user.Role.Key }).FirstOrDefaultAsync(ct);
        if (current is null || current.Role != principal?.FindFirstValue(ClaimTypes.Role)) return false;
        var stamp = principal?.FindFirstValue("credential_stamp");
        return !string.IsNullOrEmpty(stamp) && stamp == JwtService.CredentialStamp(current.PasswordHash, signingKey);
    }
}
