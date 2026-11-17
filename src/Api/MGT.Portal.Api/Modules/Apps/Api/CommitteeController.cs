using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// สถานะกรรมการของผู้ใช้ที่ login อยู่ — กรรมการเป็นรายแอป (IT เลือกที่ PUT api/applications/{id}/reviewers)
/// frontend ใช้ตัดสินว่าจะแสดงเมนู Requests and reviews หรือไม่
/// </summary>
[ApiController]
[Route("api/committee")]
[Authorize]
public class CommitteeController(PortalDbContext db) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<CommitteeStatusDto>> GetMine()
    {
        var me = User.Id();
        var assigned = await db.AppReviewers.Where(r => r.UserId == me)
            .Select(r => r.Application.Status).ToListAsync();
        return new CommitteeStatusDto(assigned.Count > 0, assigned.Count(s => s == AppStatus.Pending));
    }
}
