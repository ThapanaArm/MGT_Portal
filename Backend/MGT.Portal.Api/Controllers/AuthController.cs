using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Data;
using MGT.Portal.Api.Dtos;
using MGT.Portal.Api.Models;
using MGT.Portal.Api.Services;

namespace MGT.Portal.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(PortalDbContext db, JwtService jwt) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

        var token = jwt.CreateToken(user);
        var scopes = await EffectiveScopes(user);
        var dto = new UserDto(user.Id, user.Email, user.DisplayName, user.Role.Key, user.Role.Name, scopes);

        return Ok(new LoginResponse(token, dto));
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Email == email);
        if (user is null) return Unauthorized();
        var scopes = await EffectiveScopes(user);
        return Ok(new UserDto(user.Id, user.Email, user.DisplayName, user.Role.Key, user.Role.Name, scopes));
    }

    /// <summary>Role scopes plus any admin-granted, non-expired, non-revoked AccessGrant scopes.</summary>
    private async Task<string[]> EffectiveScopes(User user)
    {
        var now = DateTime.UtcNow;
        var granted = await db.AccessGrants
            .Where(g => g.UserId == user.Id && !g.Revoked && (g.ExpiresAt == null || g.ExpiresAt > now))
            .Select(g => g.Scope)
            .ToListAsync();
        return user.Role.Scopes.Concat(granted).Distinct().ToArray();
    }
}
