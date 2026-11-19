using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// คณะกรรมการรีวิวชุดเดียวของ Portal (5 คน ใช้กับทุกคำขอ) — IT ตั้งที่ PUT api/committee/members
/// GET me: frontend ใช้ตัดสินว่าจะแสดงเมนู Requests and reviews หรือไม่
/// </summary>
[ApiController]
[Route("api/committee")]
[Authorize]
public class CommitteeController(PortalDbContext db, ApplicationWorkflow workflow) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<CommitteeStatusDto>> GetMine()
    {
        var me = User.Id();
        var member = await db.CommitteeMembers.AnyAsync(m => m.UserId == me);
        var assigned = await db.AppReviewers.Where(r => r.UserId == me)
            .Select(r => r.Application.Status).ToListAsync();
        return new CommitteeStatusDto(member || assigned.Count > 0, assigned.Count(s => s == AppStatus.Pending));
    }

    /// <summary>คณะกรรมการชุดปัจจุบัน เรียงตามที่นั่ง</summary>
    [HttpGet("members")]
    public async Task<ActionResult<List<CommitteeMemberDto>>> GetMembers() =>
        (await workflow.CommitteeAsync()).Select(u => new CommitteeMemberDto(u.Id, u.Email, u.DisplayName)).ToList();

    /// <summary>IT ตั้งคณะกรรมการทั้งชุด — คำขอที่รอรีวิวอยู่เปลี่ยนตามทันที (กติกาอยู่ใน ApplicationWorkflow.SetCommitteeAsync)</summary>
    [HttpPut("members")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SetMembers(SetCommitteeRequest req)
    {
        var result = await workflow.SetCommitteeAsync(req.UserIds ?? [], User.Email() ?? "");
        return result.Ok ? NoContent() : BadRequest(new { message = result.Error });
    }
}
