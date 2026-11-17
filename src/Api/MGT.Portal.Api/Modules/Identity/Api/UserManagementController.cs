using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Identity;

public record ManagedUserDto(int Id, string Email, string DisplayName, string RoleKey, string RoleName,
    string Level, string? Department, string? SaleGroup);
public record UpdateManagedUserRequest(string? DisplayName, string Level);
public record AddDisplayNameRequest(string Name);

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "admin")]
public sealed class UserManagementController(PortalDbContext db, UserDirectorySync directory, ILogger<UserManagementController> logger) : ControllerBase
{
    private static ManagedUserDto ToDto(User user) => new(user.Id, user.Email, user.DisplayName,
        user.Role.Key, user.Role.Name, user.Level, user.Team?.Name, user.SaleGroup?.Name);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok((await db.Users.Include(user => user.Role).Include(user => user.Team)
        .Include(user => user.SaleGroup).AsNoTracking().OrderBy(user => user.Email).ToListAsync(ct)).Select(ToDto));

    [HttpGet("display-names")]
    public async Task<IActionResult> Names(CancellationToken ct) => Ok(await db.DisplayNameOptions.AsNoTracking().OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToListAsync(ct));

    [HttpPost("display-names")]
    public async Task<IActionResult> AddName(AddDisplayNameRequest req, CancellationToken ct)
    {
        var name = req.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length > 160) return BadRequest(new { message = "Enter a display name of 1 to 160 characters" });
        var normalized = UserDirectorySync.Normalize(name);
        var existing = await db.DisplayNameOptions.FirstOrDefaultAsync(x => x.NormalizedName == normalized, ct);
        if (existing is not null) return Ok(new { existing.Id, existing.Name });
        var option = new DisplayNameOption { Name = name, NormalizedName = normalized }; db.DisplayNameOptions.Add(option);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return Conflict(new { message = "This display name may already exist. Refresh and try again." }); }
        return Ok(new { option.Id, option.Name });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateManagedUserRequest req, CancellationToken ct)
    {
        var user = await db.Users.Include(x => x.Role).Include(x => x.Team).Include(x => x.SaleGroup).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user is null) return NotFound();
        if (!OrgLevel.IsValid(req.Level)) return BadRequest(new { message = "Select a valid level" });
        var displayName = req.DisplayName?.Trim() ?? user.DisplayName;
        if (displayName.Length > 160) return BadRequest(new { message = "Display name must be 160 characters or fewer" });
        if (!string.IsNullOrEmpty(displayName) && displayName != user.DisplayName) {
            var normalized = UserDirectorySync.Normalize(displayName);
            var option = await db.DisplayNameOptions.FirstOrDefaultAsync(x => x.NormalizedName == normalized, ct);
            if (option is null) return BadRequest(new { message = "Add this display name to the dropdown first" });
            displayName = option.Name;
        }
        if (req.Level == OrgLevel.Manager && user.TeamId is null) return BadRequest(new { message = "Department manager requires an assigned department" });
        if (req.Level == OrgLevel.SalesManager && !SalesDepartment.IsSales(user.Team)) return BadRequest(new { message = "Sales manager level is only available to the Sales department" });
        if (req.Level == OrgLevel.SalesManager && user.SaleGroupId is null) return BadRequest(new { message = "Sales manager requires a sale group" });
        if (!SalesDepartment.IsSales(user.Team)) { user.SaleGroup = null; user.SaleGroupId = null; }
        user.DisplayName = displayName;
        user.Level = req.Level;
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(user));
    }

    [HttpPost("sync/preview")]
    public async Task<IActionResult> Preview([FromQuery] string salesOrganization, CancellationToken ct)
    {
        try { return Ok(await directory.PreviewAsync(salesOrganization, ct)); }
        catch (ArgumentException) { return BadRequest(new { message = "Select SalesOrganization 1000 or 2000" }); }
        catch (Exception ex) when (ex is SqlException or InvalidOperationException) {
            logger.LogError(ex, "Unable to read the Ms_User directory");
            return StatusCode(503, new { message = "Unable to read Ms_User. Check the Datawarehouse connection and SELECT permission." });
        }
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync(DirectorySyncRequest req, CancellationToken ct)
    {
        try { return Ok(await directory.SyncAsync(req, ct)); }
        catch (ArgumentException) { return BadRequest(new { message = "Select SalesOrganization 1000 or 2000 and check the UserRole-to-Level mappings" }); }
        catch (SqlException ex) { logger.LogError(ex, "User directory sync failed"); return StatusCode(503, new { message = "User sync could not complete. Check database access and try again." }); }
    }
}
