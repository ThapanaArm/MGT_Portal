using System.Security.Claims;
using MGT.Portal.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Audit;

public sealed class AuditFailureMiddleware(RequestDelegate next, ILogger<AuditFailureMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext http, IServiceScopeFactory scopes)
    {
        Exception? failure = null;
        try { await next(http); }
        catch (Exception ex) { failure = ex; throw; }
        finally
        {
            if (http.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsOptions(http.Request.Method)
                && (failure is not null || http.Response.StatusCode >= 400))
            {
                var status = failure is null ? http.Response.StatusCode : 500;
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
                    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                    int? actorId = int.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
                    if (actorId is null && http.Items[GatewayUserPermissionFilter.UserIdItem] is int gatewayId) actorId = gatewayId;
                    var actor = http.User.FindFirstValue(ClaimTypes.Email) ?? (actorId is null ? "anonymous" : $"user:{actorId}");
                    if (actorId is null && http.Request.Headers[GatewayUserContext.Header].ToString() is { Length: > 0 } token)
                    {
                        var hash = UserTokenGenerator.Hash(token);
                        var now = DateTime.UtcNow;
                        var person = await db.UserTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null && t.ExpiresAt > now)
                            .Select(t => new { t.UserId, t.User.Email }).FirstOrDefaultAsync(timeout.Token);
                        if (person is not null) { actorId = person.UserId; actor = person.Email; }
                    }
                    db.AuditLogs.Add(new() {
                        BatchId = Guid.NewGuid(), OccurredAt = DateTime.UtcNow,
                        ActorUserId = actorId, Actor = actor.Length > 320 ? actor[..320] : actor,
                        EntityType = "HttpRequest", EventName = status is 401 or 403 ? "request.denied" : "request.failed",
                        Action = http.Request.Method, Result = status is 401 or 403 ? "Denied" : "Failed", StatusCode = status,
                        RequestMethod = http.Request.Method, RequestPath = http.Request.Path.Value is { Length: > 2048 } path ? path[..2048] : http.Request.Path.Value,
                        CorrelationId = http.TraceIdentifier.Length > 128 ? http.TraceIdentifier[..128] : http.TraceIdentifier,
                    });
                    await db.SaveChangesAsync(timeout.Token);
                }
                catch (Exception ex)
                {
                    // Database outages cannot reliably be recorded in that same database.
                    logger.LogError(ex, "Audit persistence failed for {Method} {Path}, status {Status}, correlation {Correlation}",
                        http.Request.Method, http.Request.Path, status, http.TraceIdentifier);
                }
            }
        }
    }
}
