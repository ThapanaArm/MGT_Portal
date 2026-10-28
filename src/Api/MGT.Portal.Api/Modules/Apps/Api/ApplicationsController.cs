using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// รับ request เรื่อง Application แล้วส่งต่อให้ ApplicationWorkflow
/// กติกาการอนุมัติ (Tier, จำนวนเสียง, code review, credential) อยู่ใน ApplicationWorkflow ไม่ใช่ที่นี่
/// </summary>
[ApiController]
[Route("api/applications")]
[Authorize]
public partial class ApplicationsController(PortalDbContext db, DataBoundaryResolver boundaries, ApplicationWorkflow workflow) : ControllerBase
{
    private string Actor => User.Email() ?? "";

    private static AppSummaryDto ToSummary(Application a, string ownerEmail) => new(
        a.Id, a.Name, a.Description, a.Subdomain, a.Github,
        a.ProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries),
        a.Status, a.Type, a.ReviewTarget, a.Image, a.Icon, ownerEmail, a.CreatedAt, a.UpdatedAt,
        a.Audience, DevelopmentProcess.Read(a)?.Stage);

    private bool CanSeeCredentials(string ownerEmail) =>
        User.IsAdmin() || string.Equals(ownerEmail, User.Email(), StringComparison.OrdinalIgnoreCase);

    private bool CanManage(Application a) => User.IsAdmin() || a.OwnerUserId == User.Id();

    private Task<bool> IsCommitteeMemberAsync() => db.CommitteeMembers.AnyAsync(m => m.UserId == User.Id());

    [HttpGet("review-queue")]
    public async Task<ActionResult<List<AppSummaryDto>>> GetReviewQueue()
    {
        if (!User.IsAdmin() && !await IsCommitteeMemberAsync()) return Forbid();
        var apps = await db.Applications.Include(a => a.Owner).Where(a => a.Status == AppStatus.Pending)
            .OrderBy(a => a.UpdatedAt).ToListAsync();
        return apps.Select(a => ToSummary(a, a.Owner.Email)).ToList();
    }

    private ActionResult ToError(WorkflowResult r) => BadRequest(new { message = r.Error });

    /// <summary>
    /// ขอบเขตข้อมูลของผู้ใช้ที่กำลังเรียก — Management เห็นทั้งหมด, Manager เห็นทีมตัวเอง,
    /// Employee เห็นเฉพาะของตัวเอง (ปรับเฉพาะรายได้ผ่าน DataScopeOverride)
    /// </summary>
    private async Task<DataBoundary> CurrentBoundaryAsync()
    {
        var me = await db.Users.AsNoTracking().FirstAsync(u => u.Id == User.Id());
        return await boundaries.ResolveAsync(me, User.IsAdmin());
    }

    private static string NormalizeAudience(string? audience) =>
        string.IsNullOrWhiteSpace(audience) ? AppAudience.Self : audience;

    /// <param name="catalog">
    /// true = ดึง "แคตตาล็อกสาธารณะ" คือ Application ที่เผยแพร่แล้ว (Active) ซึ่งพนักงานทุกคนเห็นได้
    /// โดยตั้งใจ — ใช้กับหน้า MGT Ecosystem เท่านั้น
    /// ค่าเริ่มต้นคือ false เพื่อให้ "กรองตามสิทธิ์" เป็นพฤติกรรมปกติ (deny by default)
    /// </param>
    [HttpGet]
    public async Task<ActionResult<List<AppSummaryDto>>> GetAll([FromQuery] string? status, [FromQuery] bool catalog = false)
    {
        var query = db.Applications.Include(a => a.Owner).AsQueryable();

        if (catalog)
        {
            // แคตตาล็อกเผยแพร่: บังคับเฉพาะ Active เสมอ ไม่ให้ใช้ flag นี้ดึง draft ของคนอื่น
            query = query.Where(a => a.Status == AppStatus.Active);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(status)) query = query.Where(a => a.Status == status);
            query = query.WithinBoundary(await CurrentBoundaryAsync());
        }

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
            .Include(x => x.CodeReviews)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();

        // Application ที่เผยแพร่แล้วเปิดให้พนักงานทุกคนดูได้ (เป็นแคตตาล็อกของบริษัท)
        // ส่วนที่ยังไม่เผยแพร่ ต้องอยู่ในขอบเขตข้อมูลของผู้เรียกเท่านั้น
        // คืน 404 แทน 403 เพื่อไม่ให้ไล่เดา id แล้วรู้ว่ามีรายการนี้อยู่จริง
        if (a.Status != AppStatus.Active && !(await CurrentBoundaryAsync()).Allows(a.OwnerUserId)
            && !(a.Status == AppStatus.Pending && await IsCommitteeMemberAsync()))
            return NotFound();

        var screenshots = a.Screenshots.OrderBy(s => s.SortOrder).Select(s => s.ImageData).ToList();
        var credentials = CanSeeCredentials(a.Owner.Email)
            ? a.Credentials.Where(c => !c.Revoked).OrderBy(c => c.Category).Select(c => new CredentialDto(c.Env, c.Category, c.TokenId, c.TokenSecret, c.CreatedAt)).ToList()
            : new List<CredentialDto>();
        var log = a.Log.OrderByDescending(l => l.OccurredAt).Select(l => new LogEntryDto(l.ActionType, l.OccurredAt, l.Actor, l.Note)).ToList();
        var votes = a.Votes.Where(v => v.ReviewCycle == a.ReviewCycle)
            .Select(v => new VoteDto(v.CommitteeMemberId, v.CommitteeMember.Name, v.CommitteeMember.RoleTitle, v.Approved, v.ActorEmail, v.DecidedAt, v.Note)).ToList();
        var codeReview = a.CodeReviews.Where(r => r.ReviewCycle == a.ReviewCycle)
            .Select(r => new CodeReviewDto(r.Approved, r.ReviewerEmail, r.Note, r.ReviewedAt)).FirstOrDefault();

        var tier = DevelopmentProcess.Read(a)?.TargetTier ?? a.ReviewTarget ?? a.Type;
        return new AppDetailDto(ToSummary(a, a.Owner.Email), screenshots, credentials, log, votes, a.ReviewCycle,
            codeReview, AppTier.RequiredVotes(tier), AppTier.RequiresCodeReview(tier), DevelopmentProcess.Read(a));
    }

    [HttpPost]
    public async Task<ActionResult<AppSummaryDto>> Create(CreateAppRequest req)
    {
        if (!User.IsAdmin() && !string.IsNullOrWhiteSpace(req.Github) && req.Github.Trim() != "-")
            return Forbid();
        var audience = NormalizeAudience(req.Audience);
        if (!AppAudience.IsValid(audience)) return BadRequest(new { message = "Invalid application audience" });

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
            Icon = string.IsNullOrWhiteSpace(req.Icon) ? "fa:box" : req.Icon,
            Audience = audience,
            Status = AppStatus.Draft,
            Type = AppTier.Tier1,
            OwnerUserId = User.Id(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Applications.Add(a);
        DevelopmentProcess.Write(a, new());
        await db.SaveChangesAsync();

        if (req.Screenshots is { Count: > 0 })
            db.AppScreenshots.AddRange(req.Screenshots.Select((s, i) => new AppScreenshot { ApplicationId = a.Id, ImageData = s, SortOrder = i }));

        // ไม่ออก credential ตอนสร้าง — credential ออกให้เฉพาะตอนได้รับอนุมัติ Tier 2/3 (ดู ApplicationWorkflow)
        db.AppLogEntries.Add(new AppLogEntry { ApplicationId = a.Id, ActionType = LogActionType.Create, OccurredAt = DateTime.UtcNow, Actor = Actor });
        await db.SaveChangesAsync();

        var owner = await db.Users.FindAsync(a.OwnerUserId);
        return ToSummary(a, owner!.Email);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AppSummaryDto>> Update(int id, UpdateAppRequest req)
    {
        var a = await db.Applications.Include(x => x.Owner).Include(x => x.Screenshots).FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!CanManage(a)) return Forbid();

        if (a.DevelopmentJson is not null && DevelopmentProcess.Read(a)?.Stage != "draft")
            return BadRequest(new { message = "Submitted development details are locked. Contact IT to revise the access request." });

        if (!User.IsAdmin() && !string.Equals(req.Github?.Trim() ?? "", a.Github?.Trim() ?? "", StringComparison.Ordinal))
            return Forbid();

        var audience = NormalizeAudience(req.Audience ?? a.Audience);
        if (!AppAudience.IsValid(audience)) return BadRequest(new { message = "Invalid application audience" });

        var productsCsv = string.Join(',', req.Products);
        var productCheck = ApplicationWorkflow.CanChangeProducts(a, productsCsv);
        if (!productCheck.Ok) return ToError(productCheck);

        a.Name = req.Name;
        a.Description = req.Description;
        a.Subdomain = req.Subdomain;
        a.Github = req.Github ?? "-";
        a.ProductsCsv = productsCsv;
        a.Image = req.Image;
        a.Icon = string.IsNullOrWhiteSpace(req.Icon) ? a.Icon : req.Icon;
        a.Audience = audience;
        a.UpdatedAt = DateTime.UtcNow;

        if (req.Screenshots is not null)
        {
            db.AppScreenshots.RemoveRange(a.Screenshots);
            db.AppScreenshots.AddRange(req.Screenshots.Select((s, i) => new AppScreenshot { ApplicationId = a.Id, ImageData = s, SortOrder = i }));
        }

        db.AppLogEntries.Add(new AppLogEntry { ApplicationId = a.Id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow, Actor = Actor });
        // รายการ API เปลี่ยน → ออก/เพิกถอน token ให้ตรงกับหมวดที่ขอ
        await workflow.SyncCredentialsAsync(a, Actor);
        await db.SaveChangesAsync();
        return ToSummary(a, a.Owner.Email);
    }

    [HttpPut("{id:int}/repository")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SetRepository(int id, SetAppRepositoryRequest req)
    {
        if (!User.IsAdmin()) return Forbid();
        var a = await db.Applications.FindAsync(id);
        if (a is null) return NotFound();
        if (a.DevelopmentJson is not null)
            return BadRequest(new { message = "Use IT preparation to record the repository for this development request." });

        if (a.Status == AppStatus.Draft && a.DevelopmentJson is null)
            return BadRequest(new { message = "The requester must submit this request before IT can add the repository." });

        var repository = req.Github?.Trim() ?? "";
        if (repository.Length > 2048 || (repository.Length > 0 &&
            (!Uri.TryCreate(repository, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps ||
             string.IsNullOrWhiteSpace(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo))))
            return BadRequest(new { message = "Enter a valid HTTPS repository URL without embedded credentials." });

        a.Github = repository.Length > 0 ? repository : "-";
        a.UpdatedAt = DateTime.UtcNow;
        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = a.Id, ActionType = LogActionType.Update,
            Actor = Actor, OccurredAt = DateTime.UtcNow, Note = "IT updated repository information."
        });
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>ส่งคำขอให้พิจารณาตาม Tier — Tier 1 อนุมัติทันที, Tier 2/3 รอกรรมการและ IT</summary>
    [HttpPost("{id:int}/send-review")]
    public async Task<IActionResult> SendReview(int id, SendReviewRequest req)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!CanManage(a)) return Forbid();
        if (a.DevelopmentJson is not null)
            return BadRequest(new { message = "Use the deployment request after IT preparation and development." });

        if (req.TargetType == AppTier.Tier3 && !await db.Users.AnyAsync(u => u.Id == a.OwnerUserId && u.Role.Key == "admin"))
            return BadRequest(new { message = "Official Tier 3 requests must be owned by an IT administrator account" });
        var result = await workflow.SendForReviewAsync(a, req.TargetType, Actor);
        return result.Ok ? NoContent() : ToError(result);
    }

    [HttpPost("{id:int}/vote")]
    public async Task<ActionResult<AppDetailDto>> Vote(int id, [FromBody] VoteRequest req)
    {
        if (!await IsCommitteeMemberAsync()) return Forbid();
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();

        var result = await workflow.RecordVoteAsync(a, User.Id(), req.Approved, req.Note, Actor);
        return result.Ok ? NoContent() : ToError(result);
    }

    /// <summary>IT บันทึกผลรีวิวโค้ด (Tier 2/3) — แยกจากการโหวตของกรรมการ</summary>
    [HttpPost("{id:int}/code-review")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<AppDetailDto>> CodeReview(int id, [FromBody] CodeReviewRequest req)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();

        var result = await workflow.RecordCodeReviewAsync(a, req.Approved, req.Note, Actor);
        return result.Ok ? await GetById(id) : ToError(result);
    }

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Reject(int id)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();

        var result = await workflow.RejectAsync(a, Actor);
        return result.Ok ? NoContent() : ToError(result);
    }

    /// <summary>เปิด App ที่ถูกระงับกลับมา (ใช้ Tier เดิม)</summary>
    [HttpPost("{id:int}/publish")]
    public async Task<IActionResult> Publish(int id)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!CanManage(a)) return Forbid();

        var result = await workflow.RepublishAsync(a, Actor);
        return result.Ok ? NoContent() : ToError(result);
    }

    /// <summary>ระงับ App — ปิด credential ทั้งหมดทันที</summary>
    [HttpPost("{id:int}/unpublish")]
    public async Task<IActionResult> Unpublish(int id)
    {
        var a = await db.Applications.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        if (!CanManage(a)) return Forbid();

        var result = await workflow.UnpublishAsync(a, Actor);
        return result.Ok ? NoContent() : ToError(result);
    }

    /// <summary>ออก Token ID/Secret ใหม่ของหมวด API หนึ่ง (ตัวเก่าของหมวดนั้นถูกเพิกถอน)</summary>
    [HttpPost("{id:int}/credentials/{env}/{category}/regenerate")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<CredentialDto>> RegenerateCredential(int id, string env, string category)
    {
        var a = await db.Applications.FindAsync(id);
        if (a is null) return NotFound();
        var allowed = ApplicationWorkflow.CredentialAllowed(a, env);
        if (!allowed.Ok) return ToError(allowed);
        category = ApplicationWorkflow.NormalizeCategory(category);
        if (!ApplicationWorkflow.ApiCategories(a).Contains(category))
            return BadRequest(new { message = $"This application did not request the {category} API" });

        var old = await db.AppCredentials.FirstOrDefaultAsync(c => c.ApplicationId == id && c.Env == env && c.Category == category && !c.Revoked);
        if (old is not null) old.Revoked = true;

        var cred = CredentialGenerator.NewAppCredential(env, category);
        cred.ApplicationId = id;
        db.AppCredentials.Add(cred);
        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow,
            Actor = Actor, Note = $"ผู้ดูแลระบบสร้าง Token ID/Secret ({env}, {category}) ใหม่"
        });
        await db.SaveChangesAsync();
        return new CredentialDto(cred.Env, cred.Category, cred.TokenId, cred.TokenSecret, cred.CreatedAt);
    }

    /// <summary>เพิกถอน Token ID/Secret ของหมวด API หนึ่ง</summary>
    [HttpPost("{id:int}/credentials/{env}/{category}/revoke")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> RevokeCredential(int id, string env, string category)
    {
        category = ApplicationWorkflow.NormalizeCategory(category);
        var cred = await db.AppCredentials.FirstOrDefaultAsync(c => c.ApplicationId == id && c.Env == env && c.Category == category && !c.Revoked);
        if (cred is null) return NotFound();
        cred.Revoked = true;
        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = id, ActionType = LogActionType.Update, OccurredAt = DateTime.UtcNow,
            Actor = Actor, Note = $"ผู้ดูแลระบบเพิกถอน Token ID/Secret ({env}, {category})"
        });
        await db.SaveChangesAsync();
        return NoContent();
    }
}
