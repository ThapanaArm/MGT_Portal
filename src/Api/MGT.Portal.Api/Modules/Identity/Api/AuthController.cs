using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Identity;

[ApiController]
[Route("api/auth")]
public class AuthController(PortalDbContext db, JwtService jwt, IUserScopeProvider scopeProvider) : ControllerBase
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

    /// <summary>Role scopes บวกกับ scope ที่ module อื่นให้เพิ่ม (ตอนนี้คือ AccessGrant ที่ยังไม่หมดอายุและยังไม่ถูกยกเลิก)</summary>
    private async Task<string[]> EffectiveScopes(User user)
    {
        var granted = await scopeProvider.GetGrantedScopesAsync(user.Id, HttpContext.RequestAborted);
        return user.Role.Scopes.Concat(granted).Distinct().ToArray();
    }
}
