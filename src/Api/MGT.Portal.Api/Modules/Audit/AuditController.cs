using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Audit;

public sealed record AuditFilter(DateTimeOffset? From = null, DateTimeOffset? To = null, int? ApplicationId = null,
    int? ActorUserId = null, string? EventName = null, string? Result = null);

[ApiController]
[Route("api/admin/audit")]
[Authorize(Roles = "admin")]
public sealed class AuditController(PortalDbContext db) : ControllerBase
{
    private IQueryable<AuditLog> Query(AuditFilter filter, out string? error)
    {
        var to = filter.To?.UtcDateTime ?? DateTime.UtcNow;
        var from = filter.From?.UtcDateTime ?? to.AddDays(-30);
        error = to <= from ? "End date must be after start date" : to - from > TimeSpan.FromDays(366) ? "Choose a period of up to 366 days" : null;
        var query = db.AuditLogs.AsNoTracking().Where(a => a.OccurredAt >= from && a.OccurredAt < to);
        if (filter.ApplicationId is int appId) query = query.Where(a => a.ApplicationId == appId);
        if (filter.ActorUserId is int actorId) query = query.Where(a => a.ActorUserId == actorId);
        if (!string.IsNullOrWhiteSpace(filter.EventName)) query = query.Where(a => a.EventName == filter.EventName);
        if (!string.IsNullOrWhiteSpace(filter.Result)) query = query.Where(a => a.Result == filter.Result);
        return query;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] AuditFilter filter, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
    {
        if (page < 1 || page > 100000 || pageSize < 1 || pageSize > 100) return BadRequest(new { message = "Invalid page or page size" });
        var query = Query(filter, out var error); if (error is not null) return BadRequest(new { message = error });
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(a => a.OccurredAt).ThenByDescending(a => a.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new { a.Id, a.BatchId, a.OccurredAt, a.ActorUserId, a.Actor, a.ApplicationId,
                ApplicationName = a.ApplicationName ?? (a.Application != null ? a.Application.Name : null),
                a.EntityType, a.EntityId, a.EntityKeyJson, a.EventName, a.Action, a.Result, a.PreviousStage, a.NewStage,
                a.ChangedFieldsJson, a.BeforeJson, a.AfterJson, a.RequestMethod, a.RequestPath, a.CorrelationId, a.StatusCode }).ToListAsync(ct);
        return Ok(new { data = rows, total, page, pageSize });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary([FromQuery] AuditFilter filter, CancellationToken ct)
    {
        var query = Query(filter, out var error); if (error is not null) return BadRequest(new { message = error });
        var total = await query.CountAsync(ct);
        var applications = await query.Where(a => a.ApplicationId != null).Select(a => a.ApplicationId).Distinct().CountAsync(ct);
        var actors = await query.Where(a => a.ActorUserId != null).Select(a => a.ActorUserId).Distinct().CountAsync(ct);
        var byEvent = await query.GroupBy(a => new { a.EventName, a.Result }).Select(g => new { g.Key.EventName, g.Key.Result, Count = g.Count() }).OrderByDescending(g => g.Count).ToListAsync(ct);
        var byActor = await query.Where(a => a.Result == "Succeeded").GroupBy(a => new { a.ActorUserId, a.Actor })
            .Select(g => new { g.Key.ActorUserId, g.Key.Actor, Changes = g.Count(),
                Applications = g.Where(a => a.ApplicationId != null).Select(a => a.ApplicationId).Distinct().Count(),
                CreatedApplications = g.Count(a => a.EventName == "application.created"),
                ReviewActions = g.Count(a => a.EventName.StartsWith("committee.") || a.EventName.StartsWith("code_review.")),
                Deployments = g.Count(a => a.EventName == "application.stage.deployed"),
                GoLives = g.Count(a => a.EventName == "application.stage.live") })
            .OrderByDescending(g => g.Changes).ToListAsync(ct);
        return Ok(new { total, applications, actors, byEvent, byActor });
    }

    [HttpGet("events")]
    public async Task<IActionResult> Events(CancellationToken ct) => Ok(await db.AuditLogs.AsNoTracking().Select(a => a.EventName).Distinct().Order().ToListAsync(ct));
}
