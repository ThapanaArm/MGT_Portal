using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Access;

[ApiController]
[Route("api/tokens")]
[Authorize]
public class TokensController(PortalDbContext db) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static TokenDto ToDto(ApiToken t) => new(t.Id, t.Value, t.ScopesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries), t.Env, t.Expiry, t.CreatedAt);

    [HttpGet]
    public async Task<ActionResult<List<TokenDto>>> GetMine()
    {
        var tokens = await db.ApiTokens.Where(t => t.UserId == CurrentUserId && !t.Revoked).OrderByDescending(t => t.CreatedAt).ToListAsync();
        return tokens.Select(ToDto).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<TokenDto>> Create(CreateTokenRequest req)
    {
        if (req.Scopes.Length == 0) return BadRequest(new { message = "Select at least one scope" });

        var token = new ApiToken
        {
            UserId = CurrentUserId,
            Value = ScopeTokenGenerator.New(req.Env),
            ScopesCsv = string.Join(',', req.Scopes),
            Env = req.Env,
            Expiry = req.Expiry,
            CreatedAt = DateTime.UtcNow,
        };
        db.ApiTokens.Add(token);
        await db.SaveChangesAsync();
        return ToDto(token);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Revoke(int id)
    {
        var token = await db.ApiTokens.FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (token is null) return NotFound();
        token.Revoked = true;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
