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
        if (state?.Stage != "development") return BadRequest(new { message = "IT preparation and development must precede a deployment request." });
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

    private void AddProcessLog(Application app, string note)
    {
        app.UpdatedAt = DateTime.UtcNow;
        db.AppLogEntries.Add(new() { ApplicationId = app.Id, ActionType = "update", Actor = Actor, OccurredAt = app.UpdatedAt, Note = note });
    }
}
