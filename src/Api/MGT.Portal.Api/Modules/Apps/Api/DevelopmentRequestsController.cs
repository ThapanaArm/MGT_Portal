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
            return BadRequest(new { message = "Tier 1 cannot request API services." });
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

    [HttpPost("{id:int}/deployment-request")]
    public async Task<IActionResult> RequestDeployment(int id, DeploymentRequest req)
    {
        var app = await db.Applications.FindAsync(id);
        if (app is null) return NotFound();
        if (app.OwnerUserId != User.Id()) return Forbid();
        var state = DevelopmentProcess.Read(app);
        if (state is null || !DevelopmentProcess.IsDeveloping(state.Stage)) return BadRequest(new { message = "IT preparation and development must precede a deployment request." });
        var branch = req.Branch?.Trim() ?? "";
        var commit = req.Commit?.Trim() ?? "";
        if (branch.Length is < 1 or > 200 || branch.Any(char.IsControl) || !System.Text.RegularExpressions.Regex.IsMatch(commit, "\\A[0-9a-fA-F]{7,40}\\z"))
            return BadRequest(new { message = "Enter a branch and a valid Git commit (7–40 hexadecimal characters)." });
        var result = await workflow.SendForReviewAsync(app, state.TargetTier, Actor);
        if (!result.Ok) return ToError(result);
        DevelopmentProcess.Write(app, state with { Stage = "review", Branch = branch, Commit = commit });
        AddProcessLog(app, $"Deployment requested for {branch} @ {commit}.");
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
        var reviewers = await db.AppReviewers.Where(r => r.ApplicationId == app.Id).ToListAsync();
        foreach (var reviewer in reviewers)
            db.AppReviewers.Add(new AppReviewer { ApplicationId = update.Id, UserId = reviewer.UserId, AssignedAt = DateTime.UtcNow, AssignedBy = Actor });
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
