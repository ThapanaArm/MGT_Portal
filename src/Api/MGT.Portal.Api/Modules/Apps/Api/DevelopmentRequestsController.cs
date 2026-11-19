using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

public partial class ApplicationsController
{
    [HttpPut("{id:int}/development-access")]
    public async Task<IActionResult> SaveDevelopmentAccess(int id, DevelopmentAccessRequest req)
    {
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        if (app.OwnerUserId != User.Id()) return Forbid();
        if (app.Status != AppStatus.Draft || DevelopmentProcess.Read(app)?.Stage is not (null or "draft"))
            return BadRequest(new { message = "Development access has already been submitted." });
        if (!AppTier.IsValid(req.TargetTier) || (req.TargetTier == AppTier.Tier3 && !User.IsAdmin()))
            return BadRequest(new { message = "Select an available application tier." });
        if (req.TargetTier == AppTier.Tier1 && !string.IsNullOrWhiteSpace(app.ProductsCsv))
            return BadRequest(new { message = "Register cannot request API services." });
        var emails = (req.Emails ?? []).Select(e => e.Trim().ToLowerInvariant()).Distinct().ToArray();
        if (emails.Length is < 1 or > 20 || emails.Any(e => !DevelopmentProcess.ValidEmail(e)))
            return BadRequest(new { message = "Enter 1–20 company Microsoft account emails (@megachem.co.th)." });
        DevelopmentProcess.Write(app, new(req.Submit ? "setup" : "draft", req.TargetTier,
            emails.Select(e => new DeveloperPreparation(e)).ToArray()));
        AddProcessLog(app, req.Submit ? "Development access requested. Next: IT preparation." : "Development access draft saved.");
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}/development-preparation")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> PrepareDevelopment(int id, PreparationRequest req)
    {
        if (!User.IsAdmin()) return Forbid();
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        var state = DevelopmentProcess.Read(app);
        if (state?.Stage != "setup") return BadRequest(new { message = "This request is not awaiting IT preparation." });
        var repository = req.Github?.Trim() ?? "";
        if (!DevelopmentProcess.ValidRepository(repository)) return BadRequest(new { message = "Enter a valid HTTPS repository URL without embedded credentials." });
        var developers = req.Developers ?? [];
        var expected = state.Developers ?? [];
        if (developers.Length != expected.Length || !developers.Select(d => d.Email).Order().SequenceEqual(expected.Select(d => d.Email).Order()))
            return BadRequest(new { message = "Preparation must match the requested developer accounts." });
        if (req.Complete && developers.Any(d => !d.GitReady || (!string.IsNullOrWhiteSpace(app.ProductsCsv) && !d.ApiReady)))
            return BadRequest(new { message = "Complete Git and requested API preparation for every developer first." });
        app.Github = repository;
        DevelopmentProcess.Write(app, state with { Stage = req.Complete ? "development" : "setup", Developers = developers });
        if (req.Complete) await workflow.IssueDevelopmentCredentialAsync(app, Actor);
        AddProcessLog(app, req.Complete ? "IT preparation completed. Next: requester development." : "IT preparation updated.");
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// ขอเพิ่ม/ลบคน dev หลังส่งคำขอแล้ว (เจ้าของ APP หรือ IT) — คำขอของเจ้าของต้องรอ IT อนุมัติ
    /// คำขอที่ IT ทำเองมีผลทันที เพราะ IT เป็นคนเปิด/ปิดสิทธิ์ Git อยู่แล้ว
    /// </summary>
    [HttpPost("{id:int}/developers")]
    public async Task<IActionResult> RequestDeveloperChange(int id, DeveloperChangeRequest req)
    {
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        var admin = User.IsAdmin();
        if (app.OwnerUserId != User.Id() && !admin) return Forbid();
        var state = DevelopmentProcess.ReadStored(app);
        if (state is null || state.Stage == "draft")
            return BadRequest(new { message = "While the request is a draft, change developers with Edit request." });
        var email = req.Email?.Trim().ToLowerInvariant() ?? "";
        if (!DevelopmentProcess.ValidEmail(email)) return BadRequest(new { message = "Enter a company Microsoft account (@megachem.co.th)." });
        if (req.Action is not ("add" or "remove")) return BadRequest(new { message = "Action must be add or remove." });
        var developers = state.Developers ?? [];
        var pending = state.PendingDevelopers ?? [];
        var isDeveloper = developers.Any(d => d.Email == email);
        if (pending.Any(p => p.Email == email)) return Conflict(new { message = $"{email} already has a request waiting for IT." });
        if (req.Action == "add" && isDeveloper) return Conflict(new { message = $"{email} is already a developer." });
        if (req.Action == "add" && developers.Length + pending.Count(p => p.Action == "add") >= 20) return BadRequest(new { message = "An application can have up to 20 developers." });
        if (req.Action == "remove" && !isDeveloper) return BadRequest(new { message = $"{email} is not a developer of this application." });
        if (req.Action == "remove" && developers.Length <= 1) return BadRequest(new { message = "At least one developer must remain." });

        if (admin)
        {
            // IT ทำเอง = เปิด/ปิดสิทธิ์ Git แล้ว จึงมีผลทันที
            DevelopmentProcess.Write(app, state with { Developers = Apply(developers, email, req.Action, app) });
            AddProcessLog(app, req.Action == "add" ? $"IT added developer {email} (Git access prepared)." : $"IT removed developer {email} (Git access revoked).");
        }
        else
        {
            DevelopmentProcess.Write(app, state with { PendingDevelopers = [.. pending, new PendingDeveloperChange(email, req.Action, Actor, DateTime.UtcNow)] });
            AddProcessLog(app, req.Action == "add" ? $"Requested to add developer {email}. Waiting for IT approval." : $"Requested to remove developer {email}. Waiting for IT approval.");
        }
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>IT อนุมัติ (หลังเปิด/ปิดสิทธิ์ Git แล้ว) หรือปฏิเสธคำขอเพิ่ม/ลบคน dev</summary>
    [HttpPost("{id:int}/developers/decision")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DecideDeveloperChange(int id, DeveloperChangeDecision req)
    {
        if (!User.IsAdmin()) return Forbid();
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        var state = DevelopmentProcess.ReadStored(app);
        var email = req.Email?.Trim().ToLowerInvariant() ?? "";
        var request = state?.PendingDevelopers?.FirstOrDefault(p => p.Email == email);
        if (state is null || request is null) return NotFound(new { message = "This developer request no longer exists." });
        var pending = state.PendingDevelopers!.Where(p => p.Email != email).ToArray();
        var developers = state.Developers ?? [];
        if (req.Approve && request.Action == "remove" && developers.Length <= 1) return BadRequest(new { message = "At least one developer must remain." });
        DevelopmentProcess.Write(app, state with
        {
            PendingDevelopers = pending,
            Developers = req.Approve ? Apply(developers, email, request.Action, app) : developers,
        });
        AddProcessLog(app, req.Approve
            ? request.Action == "add" ? $"IT approved adding developer {email} (Git access prepared)." : $"IT approved removing developer {email} (Git access revoked)."
            : $"IT declined the request to {request.Action} developer {email}.");
        await db.SaveChangesAsync();
        return NoContent();
    }

    // คนที่ IT อนุมัติเข้ามาแล้วถือว่าเปิด Git ให้แล้ว และเปิด API ให้ด้วยถ้า APP ใช้ API
    private static DeveloperPreparation[] Apply(DeveloperPreparation[] developers, string email, string action, Application app) =>
        action == "add"
            ? [.. developers, new DeveloperPreparation(email, GitReady: true, ApiReady: !string.IsNullOrWhiteSpace(app.ProductsCsv))]
            : developers.Where(d => d.Email != email).ToArray();

    [HttpPost("{id:int}/deployment-request")]
    public async Task<IActionResult> RequestDeployment(int id, DeploymentRequest req)
    {
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        if (app.OwnerUserId != User.Id()) return Forbid();
        var state = DevelopmentProcess.Read(app);
        if (state is null || !DevelopmentProcess.IsDeveloping(state.Stage)) return BadRequest(new { message = "IT preparation and development must precede a deployment request." });
        // Git ไม่บังคับ: IT ใส่ branch / commit เองที่ deployment-source (ถ้าผู้ขอส่งมาจะถูกตรวจรูปแบบ)
        var branch = req.Branch?.Trim() ?? "";
        var commit = req.Commit?.Trim() ?? "";
        var hasSource = branch.Length > 0 || commit.Length > 0;
        if (hasSource && !ValidSource(branch, commit))
            return BadRequest(new { message = "Enter a branch and a valid Git commit (7–40 hexadecimal characters)." });
        var result = await workflow.SendForReviewAsync(app, state.TargetTier, Actor);
        if (!result.Ok) return ToError(result);
        DevelopmentProcess.Write(app, hasSource ? state with { Stage = "review", Branch = branch, Commit = commit } : state with { Stage = "review" });
        AddProcessLog(app, hasSource ? $"Deployment requested for {branch} @ {commit}." : "Deployment requested.");
        await db.SaveChangesAsync();
        return NoContent();
    }

    public const int MaxScreenshots = 8;

    /// <summary>
    /// ผู้ขอเพิ่ม/แก้รูป screenshot ระหว่างพัฒนาและตอนขอ deploy (ข้อมูลคำขออื่นล็อกแล้ว แต่รูปหน้าจอจริงมักมีหลังพัฒนา)
    /// ส่งรูปทั้งชุดแทนชุดเดิม
    /// </summary>
    [HttpPut("{id:int}/screenshots")]
    public async Task<IActionResult> SetScreenshots(int id, ScreenshotsRequest req)
    {
        var app = await db.Applications.Include(a => a.Screenshots).FirstOrDefaultAsync(a => a.Id == id);
        if (app is null) return NotFound();
        if (app.OwnerUserId != User.Id() && !User.IsAdmin()) return Forbid();
        if (!DevelopmentProcess.IsDeveloping(DevelopmentProcess.Read(app)?.Stage))
            return BadRequest(new { message = "Screenshots can be changed while the application is in development." });
        var images = req.Screenshots ?? [];
        if (images.Count > MaxScreenshots)
            return BadRequest(new { message = $"Add up to {MaxScreenshots} screenshots" });
        if (images.Any(image => !image.StartsWith("data:image/", StringComparison.Ordinal)))
            return BadRequest(new { message = "Screenshots must be uploaded images" });

        db.AppScreenshots.RemoveRange(app.Screenshots);
        db.AppScreenshots.AddRange(images.Select((image, index) => new AppScreenshot { ApplicationId = app.Id, ImageData = image, SortOrder = index }));
        app.UpdatedAt = DateTime.UtcNow;
        AddProcessLog(app, $"Screenshots updated ({images.Count}).");
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static bool ValidSource(string branch, string commit) =>
        branch.Length is >= 1 and <= 200 && !branch.Any(char.IsControl)
        && System.Text.RegularExpressions.Regex.IsMatch(commit, "\\A[0-9a-fA-F]{7,40}\\z");

    /// <summary>IT ใส่ branch และ commit ที่จะ deploy — ทำได้ระหว่างรีวิวจนถึงก่อน deploy</summary>
    [HttpPut("{id:int}/deployment-source")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> SetDeploymentSource(int id, DeploymentSourceRequest req)
    {
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        var stage = DevelopmentProcess.Read(app)?.Stage;
        var stored = DevelopmentProcess.ReadStored(app);
        if (stored is null || stage is not ("review" or "awaiting-deployment"))
            return BadRequest(new { message = "Git details can be set after the deployment request and before deployment." });
        var branch = req.Branch?.Trim() ?? "";
        var commit = req.Commit?.Trim() ?? "";
        if (!ValidSource(branch, commit))
            return BadRequest(new { message = "Enter a branch and a valid Git commit (7–40 hexadecimal characters)." });
        DevelopmentProcess.Write(app, stored with { Branch = branch, Commit = commit });
        app.UpdatedAt = DateTime.UtcNow;
        AddProcessLog(app, $"IT set the version to deploy: {branch} @ {commit}.");
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}/deployment-status")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> AdvanceDeployment(int id, DeploymentStatusRequest req)
    {
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        if (req.ExpectedUpdatedAt == null || req.ExpectedUpdatedAt.Value != app.UpdatedAt)
            return Conflict(new { message = "Another administrator updated this request. Please refresh." });
        try
        {
            var result = await workflow.AdvanceDeploymentAsync(app, req.Stage, Actor);
            return result.Ok ? NoContent() : ToError(result);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Another administrator updated this request. Please refresh." });
        }
    }

    [HttpPost("{id:int}/system-updates")]
    public async Task<IActionResult> RequestSystemUpdate(int id, SystemUpdateRequest req)
    {
        var attempt = 0;
        int? candidateId = null;
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            // Discard entities from the rolled-back attempt before replaying the whole transaction.
            if (attempt++ > 0) db.ChangeTracker.Clear();
            return await RequestSystemUpdateAttemptAsync(id, req, candidateId, createdId => candidateId = createdId);
        });
    }

    private async Task<IActionResult> RequestSystemUpdateAttemptAsync(int id, SystemUpdateRequest req, int? previousCandidateId, Action<int> candidateCreated)
    {
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable) : null;
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        if (app.OwnerUserId != User.Id() && !User.IsAdmin()) return Forbid();
        var state = DevelopmentProcess.Read(app);
        if (app.Status != AppStatus.Active || state?.Stage != "live" || state.ParentApplicationId != null)
            return BadRequest(new { message = "Request an update from the live application's main request." });
        if (state.PendingUpdateId != null)
        {
            // If the commit succeeded but its acknowledgement was lost, return that request instead of creating another.
            if (previousCandidateId == state.PendingUpdateId)
            {
                var previous = await db.Applications.FindAsync(previousCandidateId.Value);
                var submitted = previous is null ? null : DevelopmentProcess.Read(previous);
                if (submitted?.ParentApplicationId == id && submitted.Version == req.Version?.Trim()
                    && submitted.Branch == req.Branch?.Trim() && submitted.Commit == req.Commit?.Trim())
                    return Ok(new { id = previousCandidateId.Value });
            }
            return BadRequest(new { message = "An update is already in progress. Open the existing update request." });
        }
        var version = req.Version?.Trim() ?? "";
        var summary = req.ChangeSummary?.Trim() ?? "";
        var branch = req.Branch?.Trim() ?? "";
        var commit = req.Commit?.Trim() ?? "";
        if (version.Length is < 1 or > 100 || version.Any(char.IsControl) || summary.Length is < 1 or > 5000 ||
            branch.Length is < 1 or > 200 || branch.Any(char.IsControl) ||
            !System.Text.RegularExpressions.Regex.IsMatch(commit, "\\A[0-9a-fA-F]{7,40}\\z"))
            return BadRequest(new { message = "Enter a version, change summary, branch and valid commit SHA (7–40 hexadecimal characters)." });
        if ((state.Releases ?? []).Any(release => string.Equals(release.Version, version, StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { message = "Use a new version name for this update." });
        var update = new Application {
            Name = app.Name + " · " + version, Description = app.Description,
            Subdomain = app.Subdomain, Github = app.Github, ProductsCsv = app.ProductsCsv,
            OwnerUserId = app.OwnerUserId, Type = app.Type, Audience = app.Audience,
            Icon = app.Icon, Image = app.Image, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        DevelopmentProcess.Write(update, new DevelopmentRequest("review", app.Type, state.Developers, branch, commit,
            Version: version, ChangeSummary: summary, ParentApplicationId: app.Id));
        var screenshots = await db.AppScreenshots.Where(image => image.ApplicationId == app.Id).ToListAsync();
        foreach (var image in screenshots) update.Screenshots.Add(new AppScreenshot { ImageData = image.ImageData, SortOrder = image.SortOrder });
        db.Applications.Add(update);
        await db.SaveChangesAsync();
        candidateCreated(update.Id);
        // กรรมการของคำขออัปเดตมาจากคณะกรรมการชุดปัจจุบัน (SendForReviewAsync ตั้งให้)
        var releases = state.Releases ?? [new ReleaseRecord(app.Id, state.Version ?? "Initial release", state.ChangeSummary,
            state.Branch, state.Commit, state.DeployedBy, state.DeployedAt, state.LiveBy, state.LiveAt)];
        DevelopmentProcess.Write(app, state with { PendingUpdateId = update.Id, Releases = releases });
        AddProcessLog(app, $"Update {version} requested in request #{update.Id}. Current release remains live.");
        var result = await workflow.SendForReviewAsync(update, app.Type, Actor);
        if (!result.Ok) return ToError(result);
        if (transaction != null) await transaction.CommitAsync();
        return Ok(new { id = update.Id });
    }

    private void AddProcessLog(Application app, string note)
    {
        app.UpdatedAt = DateTime.UtcNow;
        db.AppLogEntries.Add(new() { ApplicationId = app.Id, ActionType = "update", Actor = Actor, OccurredAt = app.UpdatedAt, Note = note });
    }
}
