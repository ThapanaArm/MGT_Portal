using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Apps;

[ApiController]
[Route("api/committee")]
[Authorize]
public class CommitteeController(PortalDbContext db) : ControllerBase
{
    [HttpGet("members")]
    public async Task<ActionResult<List<CommitteeMemberDto>>> GetMembers()
    {
        var members = await db.CommitteeMembers.Include(m => m.User).ToListAsync();
        return members.Select(m => new CommitteeMemberDto(m.Id, m.User?.DisplayName ?? m.Name, m.RoleTitle, m.UserId, m.User?.Email)).ToList();
    }

    [HttpPut("members/{id:int}/assignment")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Assign(int id, AssignCommitteeMemberRequest req)
    {
        var member = await db.CommitteeMembers.FindAsync(id);
        if (member is null) return NotFound();
        if (member.UserId != req.UserId && await db.AppVotes.AnyAsync(v => v.CommitteeMemberId == id && v.Application.Status == AppStatus.Pending && v.ReviewCycle == v.Application.ReviewCycle))
            return BadRequest(new { message = "This seat has a decision in a pending review. Finish that review before changing its assignment" });
        if (req.UserId is not null && !await db.Users.AnyAsync(u => u.Id == req.UserId))
            return BadRequest(new { message = "User not found" });
        if (req.UserId is not null && await db.CommitteeMembers.AnyAsync(m => m.Id != id && m.UserId == req.UserId))
            return BadRequest(new { message = "This account is already assigned to another committee seat" });
        member.UserId = req.UserId;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
