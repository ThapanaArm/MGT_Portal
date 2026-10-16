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
        var users = await db.Users.Include(u => u.Role).Include(u => u.Team).OrderBy(u => u.DisplayName).ToListAsync();
        return users.Select(ToBrief).ToList();
    }

    private static UserBriefDto ToBrief(User u) => new(
        u.Id, u.Email, u.DisplayName, u.Role.Key, u.Role.Name,
        u.Level, u.TeamId, u.Team?.Name, u.DataScopeOverride, u.EffectiveDataScope);

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
        if (req.Level is not (OrgLevel.Employee or OrgLevel.Manager or OrgLevel.Management))
            return BadRequest(new { message = "ระดับองค์กรไม่ถูกต้อง" });

        if (req.DataScopeOverride is not null && !DataScope.IsValid(req.DataScopeOverride))
            return BadRequest(new { message = "ขอบเขตข้อมูลไม่ถูกต้อง" });

        var user = await db.Users.Include(u => u.Role).Include(u => u.Team).FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();

        if (req.TeamId is not null && !await db.Teams.AnyAsync(t => t.Id == req.TeamId))
            return BadRequest(new { message = "ไม่พบทีมที่ระบุ" });

        // Manager ที่ไม่มีทีม จะไม่มีขอบเขตให้ดูแล — กันไว้ตั้งแต่ตอนบันทึก
        if (req.Level == OrgLevel.Manager && req.TeamId is null)
            return BadRequest(new { message = "ระดับ Manager ต้องระบุทีมที่ดูแล" });

        user.Level = req.Level;
        user.TeamId = req.TeamId;
        user.DataScopeOverride = req.DataScopeOverride;
        await db.SaveChangesAsync();

        await db.Entry(user).Reference(u => u.Team).LoadAsync();
        return ToBrief(user);
    }
}
