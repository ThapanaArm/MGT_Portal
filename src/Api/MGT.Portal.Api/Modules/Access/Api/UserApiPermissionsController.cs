using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Access;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/access/users/{id:int}/api-permissions")]
public class UserApiPermissionsController(PortalDbContext db, ApiPermissionService permissions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiPermissionDocument>> Get(int id, CancellationToken ct)
    {
        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        return await permissions.DocumentAsync(user, ct);
    }

    [HttpPut]
    public async Task<ActionResult<ApiPermissionDocument>> Save(int id, SaveApiPermissionsRequest req, CancellationToken ct)
    {
        var user = await db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (req.Permissions is null || req.Permissions.GroupBy(p => p.ResourceKey).Any(g => g.Count() > 1))
            return BadRequest(new { message = "API permissions must be unique" });
        var keys = (await permissions.ResourcesAsync(ct)).Select(r => r.Key).ToHashSet();
        foreach (var row in req.Permissions)
        {
            if (!keys.Contains(row.ResourceKey)) return BadRequest(new { message = "Unknown API resource" });
            bool Valid(string value, string legacy) => ApiPermissionService.ValidScope(value) || value == DataScope.SaleGroup && legacy == DataScope.SaleGroup;
            if (row.IsCustom && (!Valid(row.ReadScope, user.EffectiveDataScope) || !Valid(row.WriteScope, user.EffectiveWriteDataScope)))
                return BadRequest(new { message = "Choose Not allowed, Own data, Department, or Entire company" });
        }
        if (req.TeamId is not null && !await db.Teams.AnyAsync(t => t.Id == req.TeamId, ct))
            return BadRequest(new { message = "Department not found" });
        if (req.TeamId is null && req.Permissions.Any(p => p.IsCustom && (p.ReadScope == DataScope.Team || p.WriteScope == DataScope.Team)))
            return BadRequest(new { message = "Select a department for department permissions" });
        var current = await db.UserApiPermissions.Where(p => p.UserId == id).ToListAsync(ct);
        // Only submitted resources change; newly added catalog entries keep their role defaults.
        foreach (var row in req.Permissions)
        {
            var existing = current.SingleOrDefault(p => p.ResourceKey == row.ResourceKey);
            if (!row.IsCustom) { if (existing is not null) db.UserApiPermissions.Remove(existing); continue; }
            if (existing is null) { existing = new() { UserId = id, ResourceKey = row.ResourceKey }; db.UserApiPermissions.Add(existing); }
            existing.ReadScope = row.ReadScope; existing.WriteScope = row.WriteScope;
        }
        var targetTeam = req.TeamId is null ? null : await db.Teams.FirstOrDefaultAsync(t => t.Id == req.TeamId, ct);
        if (!SalesDepartment.IsSales(targetTeam)) { user.SaleGroup = null; user.SaleGroupId = null; }
        user.TeamId = req.TeamId;
        await db.SaveChangesAsync(ct);
        return await permissions.DocumentAsync(user, ct);
    }
}

