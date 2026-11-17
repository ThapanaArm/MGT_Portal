using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Identity;

public record UserTokenDto(int Id, string Name, string Prefix, DateTime CreatedAt, DateTime ExpiresAt, DateTime? LastUsedAt, string Status);
public record CreateUserTokenRequest(string Name, int Days);
/// <param name="Value">ค่า token จริง — แสดงครั้งเดียว ระบบเก็บเฉพาะ hash</param>
public record CreatedUserTokenDto(UserTokenDto Token, string Value);

/// <summary>
/// User token ของผู้ใช้ที่ login อยู่ — แอปส่งมาคู่กับ Token ID/Secret ของแอป (header X-User-Token)
/// แล้ว Gateway กรองข้อมูลตามสิทธิ์ของผู้ใช้คนนี้ (ดู GatewayUserContext)
/// </summary>
[ApiController]
[Route("api/me/user-tokens")]
[Authorize]
public class UserTokensController(PortalDbContext db) : ControllerBase
{
    public static readonly int[] AllowedDays = [30, 90, 180, 365];
    public const int MaxActiveTokens = 10;

    private static string Status(UserToken t, DateTime now) => t.RevokedAt is not null ? "revoked" : t.ExpiresAt <= now ? "expired" : "active";
    private static UserTokenDto ToDto(UserToken t, DateTime now) => new(t.Id, t.Name, t.Prefix, t.CreatedAt, t.ExpiresAt, t.LastUsedAt, Status(t, now));

    [HttpGet]
    public async Task<ActionResult<List<UserTokenDto>>> GetMine()
    {
        var me = User.Id();
        var now = DateTime.UtcNow;
        var tokens = await db.UserTokens.Where(t => t.UserId == me).OrderByDescending(t => t.CreatedAt).ToListAsync();
        return tokens.Select(t => ToDto(t, now)).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<CreatedUserTokenDto>> Create(CreateUserTokenRequest req)
    {
        var name = req.Name?.Trim() ?? "";
        if (name.Length is < 1 or > 100) return BadRequest(new { message = "Enter a token name (up to 100 characters)" });
        if (!AllowedDays.Contains(req.Days)) return BadRequest(new { message = "Choose 30, 90, 180 or 365 days" });

        var me = User.Id();
        var now = DateTime.UtcNow;
        if (await db.UserTokens.CountAsync(t => t.UserId == me && t.RevokedAt == null && t.ExpiresAt > now) >= MaxActiveTokens)
            return BadRequest(new { message = $"You can have up to {MaxActiveTokens} active tokens. Revoke one first." });

        var value = UserTokenGenerator.New();
        var token = new UserToken
        {
            UserId = me, Name = name, Prefix = UserTokenGenerator.Display(value), TokenHash = UserTokenGenerator.Hash(value),
            CreatedAt = now, ExpiresAt = now.AddDays(req.Days),
        };
        db.UserTokens.Add(token);
        await db.SaveChangesAsync();
        return new CreatedUserTokenDto(ToDto(token, now), value);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Revoke(int id)
    {
        var me = User.Id();
        var token = await db.UserTokens.FirstOrDefaultAsync(t => t.Id == id && t.UserId == me);
        if (token is null) return NotFound();
        token.RevokedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
