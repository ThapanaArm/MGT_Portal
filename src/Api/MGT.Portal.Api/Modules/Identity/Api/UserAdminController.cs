using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Identity;

/// <summary>
/// ผู้ดูแลระบบจัดการผู้ใช้ ทีม และขอบเขตข้อมูล
/// ใช้ route เดิม (api/access/...) เพื่อไม่ให้ frontend ต้องแก้
/// </summary>
[ApiController]
[Route("api/access")]
[Authorize(Roles = "admin")]
public class UserAdminController(PortalDbContext db) : ControllerBase
{
    [HttpGet("users")]
    public async Task<ActionResult<List<UserBriefDto>>> GetUsers()
    {
        var users = await db.Users.Include(u => u.Role).Include(u => u.Team).Include(u => u.SaleGroup).Include(u => u.PlatformIds)
            .AsSplitQuery().OrderBy(u => u.DisplayName).ToListAsync();
        return users.Select(ToBrief).ToList();
    }

    private static UserBriefDto ToBrief(User u) => new(
        u.Id, u.Email, u.DisplayName, u.Role.Key, u.Role.Name,
        u.Level, u.TeamId, u.Team?.Name, u.DataScopeOverride, u.EffectiveDataScope,
        u.SaleGroup?.Name, u.PlatformIds.OrderBy(p => p.Platform).Select(p => $"{p.Platform}: {p.ExternalId}").ToList(),
        u.ReadDataScope, u.WriteDataScope, u.EffectiveWriteDataScope);

    [HttpPut("users/{id:int}/permissions")]
    public async Task<ActionResult<UserBriefDto>> UpdatePermissions(int id, UpdateUserPermissionsRequest req)
    {
        // Sale-group values remain valid only for unchanged legacy permissions.
        var user = await db.Users.Include(u => u.Role).Include(u => u.Team).Include(u => u.SaleGroup).Include(u => u.PlatformIds)
            .FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();
        bool Allowed(string value, string previous) => value is DataScope.Self or DataScope.Team or DataScope.All
            || value == DataScope.SaleGroup && previous == DataScope.SaleGroup;
        if (!Allowed(req.ReadScope, user.EffectiveDataScope) || !Allowed(req.WriteScope, user.EffectiveWriteDataScope))
            return BadRequest(new { message = "Choose own data, department, or entire company" });
        if (req.TeamId is not null && !await db.Teams.AnyAsync(t => t.Id == req.TeamId))
            return BadRequest(new { message = "Department not found" });
        if ((req.ReadScope == DataScope.Team || req.WriteScope == DataScope.Team) && req.TeamId is null)
            return BadRequest(new { message = "Select a department for department permissions" });

        var targetTeam = req.TeamId is null ? null : await db.Teams.FindAsync(req.TeamId.Value);
        if (!SalesDepartment.IsSales(targetTeam)) { user.SaleGroup = null; user.SaleGroupId = null; }
        user.TeamId = req.TeamId;
        user.ReadDataScope = req.ReadScope;
        user.WriteDataScope = req.WriteScope;
        await db.SaveChangesAsync();
        await db.Entry(user).Reference(u => u.Team).LoadAsync();
        return ToBrief(user);
    }

    [HttpGet("teams")]
    public async Task<ActionResult<List<TeamDto>>> GetTeams()
    {
        var teams = await db.Teams.Include(t => t.Members).OrderBy(t => t.Name).ToListAsync();
        return teams.Select(t => new TeamDto(t.Id, t.Key, t.Name, t.Members.Count)).ToList();
    }

    /// <summary>
    /// ตั้งระดับองค์กร ทีม และขอบเขตข้อมูลเฉพาะรายของผู้ใช้
    /// Management เห็นทั้งหมด / Manager เห็นทีมตัวเอง / Employee เห็นเฉพาะของตัวเอง
    /// ส่ง DataScopeOverride เมื่อบางตำแหน่งต้องเห็นกว้างกว่าระดับปกติ (null = ใช้ตามระดับ)
    /// </summary>
    [HttpPut("users/{id:int}/data-scope")]
    public async Task<ActionResult<UserBriefDto>> UpdateUserScope(int id, UpdateUserScopeRequest req)
    {
        if (!OrgLevel.IsValid(req.Level))
            return BadRequest(new { message = "Invalid organization level" });

        if (req.DataScopeOverride is not null && !DataScope.IsValid(req.DataScopeOverride))
            return BadRequest(new { message = "Invalid data scope" });

        var user = await db.Users.Include(u => u.Role).Include(u => u.Team).Include(u => u.SaleGroup).Include(u => u.PlatformIds)
            .FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();

        if (req.TeamId is not null && !await db.Teams.AnyAsync(t => t.Id == req.TeamId))
            return BadRequest(new { message = "Team not found" });

        // Manager ที่ไม่มีทีม จะไม่มีขอบเขตให้ดูแล — กันไว้ตั้งแต่ตอนบันทึก
        if (req.Level == OrgLevel.Manager && req.TeamId is null)
            return BadRequest(new { message = "Managers must have an assigned team" });

        // Sale group ใส่ด้วย SQL (Users.SaleGroupId) — Sales Manager ต้องมีกลุ่มแล้ว
        if (req.Level == OrgLevel.SalesManager && !SalesDepartment.IsSales(req.TeamId is null ? null : await db.Teams.FindAsync(req.TeamId.Value)))
            return BadRequest(new { message = "Sales manager level is only available to the Sales department" });
        if (req.Level == OrgLevel.SalesManager && user.SaleGroupId is null)
            return BadRequest(new { message = "Sales managers must belong to a sale group. Set Users.SaleGroupId first." });

        user.Level = req.Level;
        var targetTeam = req.TeamId is null ? null : await db.Teams.FindAsync(req.TeamId.Value);
        if (!SalesDepartment.IsSales(targetTeam)) { user.SaleGroup = null; user.SaleGroupId = null; }
        user.TeamId = req.TeamId;
        user.DataScopeOverride = req.DataScopeOverride;
        await db.SaveChangesAsync();

        await db.Entry(user).Reference(u => u.Team).LoadAsync();
        return ToBrief(user);
    }
}

