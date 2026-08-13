using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Data;
using MGT.Portal.Api.Dtos;
using MGT.Portal.Api.Models;
using MGT.Portal.Api.Services;

namespace MGT.Portal.Api.Controllers;

[ApiController]
[Route("api/applications")]
[Authorize]
public class ApplicationsController(PortalDbContext db) : ControllerBase
{
    private static readonly Dictionary<string, int> ReviewThreshold = new()
    {
        [AppType.Registered] = 1,
        [AppType.Verify] = 2,
        [AppType.Official] = 3,
    };

    private bool IsAdmin => User.IsInRole("admin");
    private string? CurrentEmail => User.FindFirst(ClaimTypes.Email)?.Value;
    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static AppSummaryDto ToSummary(Application a, string ownerEmail) => new(
        a.Id, a.Name, a.Description, a.Subdomain, a.Github,
        a.ProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries),
        a.Status, a.Type, a.ReviewTarget, a.Image, a.Icon, ownerEmail, a.CreatedAt, a.UpdatedAt);

    private bool CanSeeCredentials(Application a, string ownerEmail) =>
        IsAdmin || string.Equals(ownerEmail, CurrentEmail, StringComparison.OrdinalIgnoreCase);

    [HttpGet]
    public async Task<ActionResult<List<AppSummaryDto>>> GetAll([FromQuery] string? status)
    {
        var query = db.Applications.Include(a => a.Owner).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(a => a.Status == status);
        var apps = await query.OrderByDescending(a => a.UpdatedAt).ToListAsync();
        return apps.Select(a => ToSummary(a, a.Owner.Email)).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AppDetailDto>> GetById(int id)
    {
        var a = await db.Applications
            .Include(x => x.Owner)
            .Include(x => x.Screenshots)
            .Include(x => x.Credentials)
            .Include(x => x.Log)
            .Include(x => x.Votes).ThenInclude(v => v.CommitteeMember)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();

        var summary = ToSummary(a, a.Owner.Email);
        var screenshots = a.Screenshots.OrderBy(s => s.SortOrder).Select(s => s.ImageData).ToList();
        var credentials = CanSeeCredentials(a, a.Owner.Email)
            ? a.Credentials.Where(c => !c.Revoked).Select(c => new CredentialDto(c.Env, c.TokenId, c.TokenSecret, c.CreatedAt)).ToList()
            : new List<CredentialDto>();
        var log = a.Log.OrderByDescending(l => l.OccurredAt).Select(l => new LogEntryDto(l.ActionType, l.OccurredAt, l.Actor, l.Note)).ToList();
        var votes = a.Votes.Where(v => v.ReviewCycle == a.ReviewCycle)
            .Select(v => new VoteDto(v.CommitteeMemberId, v.CommitteeMember.Name, v.CommitteeMember.RoleTitle, v.Approved)).ToList();

        return new AppDetailDto(summary, screenshots, credentials, log, votes, a.ReviewCycle);
    }

    [HttpPost]
    public async Task<ActionResult<AppSummaryDto>> Create(CreateAppRequest req)
    {
        var subdomain = string.IsNullOrWhiteSpace(req.Subdomain)
            ? System.Text.RegularExpressions.Regex.Replace(req.Name.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-')
            : req.Subdomain;

        var a = new Application
        {
            Name = req.Name,
            Description = string.IsNullOrWhiteSpace(req.Description) ? "-" : req.Description,
            Subdomain = subdomain,
            Github = string.IsNullOrWhiteSpace(req.Github) ? "-" : req.Github,
            ProductsCsv = string.Join(',', req.Products),
            Image = req.Image,
            Icon = string.IsNullOrWhiteSpace(req.Icon) ? "📦" : req.Icon,
            Status = AppStatus.Draft,
            Type = AppType.Registered,
            OwnerUserId = CurrentUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Applications.Add(a);
        await db.SaveChangesAsync();

        if (req.Screenshots is { Count: > 0 })
        {
            db.AppScreenshots.AddRange(req.Screenshots.Select((s, i) => new AppScreenshot { ApplicationId = a.Id, ImageData = s, SortOrder = i }));
        }
        var cred = CredentialGenerator.NewAppCredential(CredEnv.Sandbox);
        cred.ApplicationId = a.Id;
        db.AppCredentials.Add(cred);
        db.AppLogEntries.Add(new AppLogEntry { ApplicationId = a.Id, ActionType = LogActionType.Create, OccurredAt = DateTime.UtcNow, Actor = CurrentEmail ?? "" });
        await db.SaveChangesAsync();

        var owner = await db.Users.FindAsync(a.OwnerUserId);
        return ToSummary(a, owner!.Email);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AppSummaryDto>> Update(int id, UpdateAppRequest req)
    {
        var a = await db.Applications.Include(x => x.Owner).Include(x => x.Screenshots).FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!IsAdmin && a.OwnerUserId != CurrentUserId) return Forbid();

        a.Name = req.Name;
        a.Description = req.Description;
        a.Subdomain = req.Subdomain;
        a.Github = req.Github;
        a.ProductsCsv = string.Join(',', req.Products);
        a.Image = req.Image;
        a.Icon = string.IsNullOrWhiteSpace(req.Icon) ? a.Icon : req.Icon;
        a.UpdatedAt = DateTime.UtcNow;

        if (req.Screenshots is not null)
        {
            db.AppScreenshots.RemoveRange(a.Screenshots);
            db.AppScreenshots.AddRange(req.Screenshots.Select((s, i) => new AppScreenshot { ApplicationId = a.Id, ImageData = s, SortOrder = i }));
        }

        db.AppLogEntries.Add(new AppLogEntry { ApplicationId = a.Id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow, Actor = CurrentEmail ?? "" });
        await db.SaveChangesAsync();
        return ToSummary(a, a.Owner.Email);
    }

    [HttpPost("{id:int}/send-review")]
    public async Task<IActionResult> SendReview(int id, SendReviewRequest req)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!IsAdmin && a.OwnerUserId != CurrentUserId) return Forbid();
        if (a.Status is not (AppStatus.Draft or AppStatus.Suspended)) return BadRequest(new { message = "ส่งตรวจสอบได้เฉพาะ Application สถานะ Draft หรือ Suspended" });

        a.Status = AppStatus.Pending;
        a.ReviewTarget = req.TargetType;
        a.ReviewCycle += 1;
        a.UpdatedAt = DateTime.UtcNow;

        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = a.Id, ActionType = LogActionType.Review, OccurredAt = DateTime.UtcNow,
            Actor = CurrentEmail ?? "", Note = $"ขอตรวจสอบระดับ {req.TargetType}"
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/vote")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<AppDetailDto>> Vote(int id, [FromBody] VoteRequest req)
    {
        var a = await db.Applications.Include(x => x.Owner).Include(x => x.Votes).FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (a.Status != AppStatus.Pending) return BadRequest(new { message = "Application นี้ไม่ได้อยู่ระหว่างการตรวจสอบ" });

        var existing = a.Votes.FirstOrDefault(v => v.CommitteeMemberId == req.CommitteeMemberId && v.ReviewCycle == a.ReviewCycle);
        if (existing is null)
        {
            db.AppVotes.Add(new AppVote { ApplicationId = a.Id, CommitteeMemberId = req.CommitteeMemberId, ReviewCycle = a.ReviewCycle, Approved = true });
        }
        else
        {
            existing.Approved = !existing.Approved;
        }
        await db.SaveChangesAsync();

        var approvedCount = await db.AppVotes.CountAsync(v => v.ApplicationId == a.Id && v.ReviewCycle == a.ReviewCycle && v.Approved);
        var target = a.ReviewTarget ?? a.Type;
        var need = ReviewThreshold.GetValueOrDefault(target, 3);

        if (approvedCount >= need)
        {
            a.Type = target;
            a.Status = AppStatus.Active;
            a.ReviewTarget = null;
            a.UpdatedAt = DateTime.UtcNow;

            if (!await db.AppCredentials.AnyAsync(c => c.ApplicationId == a.Id && c.Env == CredEnv.Production && !c.Revoked))
            {
                var prod = CredentialGenerator.NewAppCredential(CredEnv.Production);
                prod.ApplicationId = a.Id;
                db.AppCredentials.Add(prod);
            }

            db.AppLogEntries.Add(new AppLogEntry
            {
                ApplicationId = a.Id, ActionType = LogActionType.Publish, OccurredAt = DateTime.UtcNow,
                Actor = CurrentEmail ?? "", Note = $"คณะกรรมการอนุมัติระดับ {target} ({approvedCount}/3 เสียง) — ออก Production Credential ให้อัตโนมัติ"
            });
            await db.SaveChangesAsync();
        }

        return await GetById(id);
    }

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reject(int id)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        var target = a.ReviewTarget ?? a.Type;

        a.Status = AppStatus.Draft;
        a.ReviewTarget = null;
        a.UpdatedAt = DateTime.UtcNow;

        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = a.Id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow,
            Actor = CurrentEmail ?? "", Note = $"คณะกรรมการปฏิเสธคำขอระดับ {target}"
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/publish")]
    public async Task<IActionResult> Publish(int id)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!IsAdmin && a.OwnerUserId != CurrentUserId) return Forbid();

        a.Status = AppStatus.Active;
        a.UpdatedAt = DateTime.UtcNow;

        if (!await db.AppCredentials.AnyAsync(c => c.ApplicationId == a.Id && c.Env == CredEnv.Production && !c.Revoked))
        {
            var prod = CredentialGenerator.NewAppCredential(CredEnv.Production);
            prod.ApplicationId = a.Id;
            db.AppCredentials.Add(prod);
        }
        db.AppLogEntries.Add(new AppLogEntry { ApplicationId = a.Id, ActionType = LogActionType.Publish, OccurredAt = DateTime.UtcNow, Actor = CurrentEmail ?? "" });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/unpublish")]
    public async Task<IActionResult> Unpublish(int id)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!IsAdmin && a.OwnerUserId != CurrentUserId) return Forbid();

        a.Status = AppStatus.Suspended;
        a.UpdatedAt = DateTime.UtcNow;
        db.AppLogEntries.Add(new AppLogEntry { ApplicationId = a.Id, ActionType = LogActionType.Unpublish, OccurredAt = DateTime.UtcNow, Actor = CurrentEmail ?? "" });
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/credentials/{env}/regenerate")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<CredentialDto>> RegenerateCredential(int id, string env)
    {
        var a = await db.Applications.FindAsync(id);
        if (a is null) return NotFound();

        var old = await db.AppCredentials.FirstOrDefaultAsync(c => c.ApplicationId == id && c.Env == env && !c.Revoked);
        if (old is not null) old.Revoked = true;

        var cred = CredentialGenerator.NewAppCredential(env);
        cred.ApplicationId = id;
        db.AppCredentials.Add(cred);
        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow,
            Actor = CurrentEmail ?? "", Note = $"ผู้ดูแลระบบสร้าง Token ID/Secret ({env}) ใหม่"
        });
        await db.SaveChangesAsync();
        return new CredentialDto(cred.Env, cred.TokenId, cred.TokenSecret, cred.CreatedAt);
    }

    [HttpPost("{id:int}/credentials/{env}/revoke")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RevokeCredential(int id, string env)
    {
        var cred = await db.AppCredentials.FirstOrDefaultAsync(c => c.ApplicationId == id && c.Env == env && !c.Revoked);
        if (cred is null) return NotFound();
        cred.Revoked = true;
        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow,
            Actor = CurrentEmail ?? "", Note = $"ผู้ดูแลระบบเพิกถอน Token ID/Secret ({env})"
        });
        await db.SaveChangesAsync();
        return NoContent();
    }
}

public record VoteRequest(int CommitteeMemberId);
