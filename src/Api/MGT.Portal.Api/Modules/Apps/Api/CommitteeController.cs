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
        var members = await db.CommitteeMembers.ToListAsync();
        return members.Select(m => new CommitteeMemberDto(m.Id, m.Name, m.RoleTitle)).ToList();
    }
}
