using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Identity;

[ApiController]
[Route("api/auth")]
public class AuthController(PortalDbContext db, JwtService jwt, IUserScopeProvider scopeProvider, IWebHostEnvironment env) : ControllerBase
{
    /// <summary>
    /// Development only: accounts that have a display name, for the quick sign-in list on the login page.
    /// Returns 404 in any other environment so the staff list is never exposed on a real server.
    /// </summary>
    [HttpGet("dev-accounts")]
    public async Task<ActionResult<List<DevAccountDto>>> DevAccounts()
    {
        if (!env.IsDevelopment()) return NotFound();
        return await db.Users.Include(u => u.Role)
            .Where(u => u.DisplayName != null && u.DisplayName.Trim() != "")
            .OrderBy(u => u.Role.Name).ThenBy(u => u.DisplayName)
            .Select(u => new DevAccountDto(u.Email, u.DisplayName, u.Role.Name))
            .ToListAsync();
    }

    /// <summary>Development only: sign in as an account from <see cref="DevAccounts"/> without a password.</summary>
    [HttpPost("dev-login")]
    public async Task<ActionResult<LoginResponse>> DevLogin(DevLoginRequest req)
    {
        if (!env.IsDevelopment()) return NotFound();
        var user = await db.Users.Include(u => u.Role).Include(u => u.Team)
            .FirstOrDefaultAsync(u => u.Email == req.Email && u.DisplayName != null && u.DisplayName.Trim() != "");
        if (user is null) return Unauthorized(new { message = "Account not found" });
        return Ok(new LoginResponse(jwt.CreateToken(user), await ToDto(user)));
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.Include(u => u.Role).Include(u => u.Team)
            .FirstOrDefaultAsync(u => u.Email == req.Email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password" });

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
        user.Id, user.Email, string.IsNullOrWhiteSpace(user.DisplayName) ? user.Email : user.DisplayName, user.Role.Key, user.Role.Name,
        await EffectiveScopes(user),
        user.Level, user.EffectiveDataScope, user.Team?.Name,
        await db.UserApiPermissions.Where(p => p.UserId == user.Id)
            .ToDictionaryAsync(p => p.ResourceKey, p => new ApiScopeOverrideDto(p.ReadScope, p.WriteScope)));

    /// <summary>Role scopes บวกกับ scope ที่ module อื่นให้เพิ่ม (ตอนนี้คือ AccessGrant ที่ยังไม่หมดอายุและยังไม่ถูกยกเลิก)</summary>
    private async Task<string[]> EffectiveScopes(User user)
    {
        var granted = await scopeProvider.GetGrantedScopesAsync(user.Id, HttpContext.RequestAborted);
        return user.Role.Scopes.Concat(granted).Distinct().ToArray();
    }
}
