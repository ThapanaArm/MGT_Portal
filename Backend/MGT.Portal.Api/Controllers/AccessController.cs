using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Data;
using MGT.Portal.Api.Dtos;
using MGT.Portal.Api.Models;

namespace MGT.Portal.Api.Controllers;

/// <summary>Admin control over which users may use which API category, and until when.</summary>
[ApiController]
[Route("api/access")]
[Authorize(Roles = "admin")]
public class AccessController(PortalDbContext db) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static AccessGrantDto ToDto(AccessGrant g) => new(
        g.Id,
        g.UserId, g.User.Email, g.User.DisplayName,
        g.CategoryId, g.Category.Key, g.Category.Name,
        g.Scope,
        g.GrantedAt, g.ExpiresAt, g.Revoked,
        g.ExpiresAt is not null && g.ExpiresAt < DateTime.UtcNow,
        g.GrantedByUser.DisplayName, g.Note);

    [HttpGet("users")]
    public async Task<ActionResult<List<UserBriefDto>>> GetUsers()
    {
        var users = await db.Users.Include(u => u.Role).OrderBy(u => u.DisplayName).ToListAsync();
        return users.Select(u => new UserBriefDto(u.Id, u.Email, u.DisplayName, u.Role.Key, u.Role.Name)).ToList();
    }

    [HttpGet("grants")]
    public async Task<ActionResult<List<AccessGrantDto>>> GetGrants()
    {
        var grants = await db.AccessGrants
            .Include(g => g.User)
            .Include(g => g.Category)
            .Include(g => g.GrantedByUser)
            .OrderByDescending(g => g.GrantedAt)
            .ToListAsync();
        return grants.Select(ToDto).ToList();
    }

    [HttpPost("grants")]
    public async Task<ActionResult<AccessGrantDto>> CreateGrant(CreateAccessGrantRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Scope))
            return BadRequest(new { message = "กรุณาระบุ Scope" });

        var user = await db.Users.FindAsync(req.UserId);
        if (user is null) return BadRequest(new { message = "ไม่พบผู้ใช้งาน" });

        var category = await db.ApiCategories.FindAsync(req.CategoryId);
        if (category is null) return BadRequest(new { message = "ไม่พบหมวดหมู่ API" });

        var grant = new AccessGrant
        {
            UserId = req.UserId,
            CategoryId = req.CategoryId,
            Scope = req.Scope,
            GrantedByUserId = CurrentUserId,
            GrantedAt = DateTime.UtcNow,
            ExpiresAt = req.DurationDays is > 0 ? DateTime.UtcNow.AddDays(req.DurationDays.Value) : null,
            Note = req.Note ?? "",
        };
        db.AccessGrants.Add(grant);
        await db.SaveChangesAsync();

        await db.Entry(grant).Reference(g => g.User).LoadAsync();
        await db.Entry(grant).Reference(g => g.Category).LoadAsync();
        await db.Entry(grant).Reference(g => g.GrantedByUser).LoadAsync();
        return ToDto(grant);
    }

    [HttpPost("grants/{id:int}/revoke")]
    public async Task<IActionResult> RevokeGrant(int id)
    {
        var grant = await db.AccessGrants.FindAsync(id);
        if (grant is null) return NotFound();
        grant.Revoked = true;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
