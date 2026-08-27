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
        var user = await db.Users.Include(u => u.Role).Include(u => u.Team)
            .FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

        var token = jwt.CreateToken(user);
        return Ok(new LoginResponse(token, await ToDto(user)));
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var user = await db.Users.Include(u => u.Role).Include(u => u.Team)
            .FirstOrDefaultAsync(u => u.Email == email);
        if (user is null) return Unauthorized();
        return Ok(await ToDto(user));
    }

    private async Task<UserDto> ToDto(User user) => new(
        user.Id, user.Email, user.DisplayName, user.Role.Key, user.Role.Name,
        await EffectiveScopes(user),
        user.Level, user.EffectiveDataScope, user.Team?.Name);

    /// <summary>Role scopes บวกกับ AccessGrant ที่ยังไม่หมดอายุและยังไม่ถูกยกเลิก</summary>
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
