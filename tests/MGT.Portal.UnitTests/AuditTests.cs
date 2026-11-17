using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Audit;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.UnitTests;

public class AuditTests
{
    private sealed class FailFirstSave : SaveChangesInterceptor
    {
        private bool failed;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!failed) { failed = true; throw new InvalidOperationException("Simulated write failure"); }
            return ValueTask.FromResult(result);
        }
    }

    [Fact]
    public async Task A_failed_save_does_not_leave_success_audits_or_duplicate_them_on_retry()
    {
        var options = new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).AddInterceptors(new FailFirstSave()).Options;
        await using var db = new PortalDbContext(options, new HttpContextAccessor());
        db.Users.Add(new User { Email = "user@example.com" });
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        Assert.Empty(await db.AuditLogs.ToListAsync());
        await db.SaveChangesAsync();
        Assert.Single(await db.AuditLogs.ToListAsync());
    }

    [Fact]
    public async Task Denied_requests_are_logged_without_copying_headers_or_request_body()
    {
        var services = new ServiceCollection();
        // Use one context instance for this request-only test so each scope sees the same store.
        var options = new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        services.AddScoped(_ => new PortalDbContext(options));
        await using var provider = services.BuildServiceProvider();
        var http = new DefaultHttpContext(); http.Request.Path = "/api/applications"; http.Request.Method = "POST";
        http.Request.Headers.Authorization = "Bearer DO-NOT-LOG-THIS";
        http.User = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier, "42"), new(ClaimTypes.Email, "actor@example.com")], "Test"));
        var middleware = new AuditFailureMiddleware(context => { context.Response.StatusCode = 403; return Task.CompletedTask; }, NullLogger<AuditFailureMiddleware>.Instance);
        await middleware.InvokeAsync(http, provider.GetRequiredService<IServiceScopeFactory>());
        await using var db = new PortalDbContext(options);
        var log = await db.AuditLogs.SingleAsync();
        Assert.Equal("Denied", log.Result); Assert.Equal(42, log.ActorUserId); Assert.Equal(403, log.StatusCode);
        Assert.DoesNotContain("DO-NOT-LOG-THIS", JsonSerializer.Serialize(log));
    }
    private static PortalDbContext NewDb()
    {
        var http = new DefaultHttpContext();
        http.User = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier, "42"), new(ClaimTypes.Email, "auditor@example.com")], "Test"));
        http.Request.Method = "PUT"; http.Request.Path = "/api/test"; http.TraceIdentifier = "audit-test";
        return new(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options,
            new HttpContextAccessor { HttpContext = http });
    }

    [Fact]
    public async Task Creating_and_editing_an_application_records_actor_keys_and_only_changed_values()
    {
        await using var db = NewDb();
        var app = new Application { Name = "Before", Description = "Unchanged purpose", Owner = new User { Email = "owner@example.com" } };
        db.Applications.Add(app); await db.SaveChangesAsync();
        var created = await db.AuditLogs.SingleAsync(a => a.EventName == "application.created");
        Assert.Equal(app.Id, created.ApplicationId); Assert.Equal(42, created.ActorUserId); Assert.Equal("auditor@example.com", created.Actor);
        app.Name = "After"; await db.SaveChangesAsync();
        var changed = await db.AuditLogs.SingleAsync(a => a.EventName == "application.updated");
        Assert.Equal(app.Id.ToString(), changed.EntityId);
        Assert.Contains("Before", changed.BeforeJson); Assert.Contains("After", changed.AfterJson);
        Assert.DoesNotContain("Unchanged purpose", changed.AfterJson);
        var count = await db.AuditLogs.CountAsync(); await db.SaveChangesAsync(); Assert.Equal(count, await db.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task Permission_edits_are_audited_with_the_target_user_and_resource()
    {
        await using var db = NewDb(); var user = new User { Email = "target@example.com" }; db.Users.Add(user); await db.SaveChangesAsync();
        var permission = new UserApiPermission { UserId = user.Id, ResourceKey = "inventory.stock", ReadScope = "all", WriteScope = "none" };
        db.UserApiPermissions.Add(permission); await db.SaveChangesAsync();
        permission.ReadScope = "none"; await db.SaveChangesAsync();
        var log = await db.AuditLogs.SingleAsync(a => a.EventName == "api_permission.updated");
        Assert.Contains("inventory.stock", log.EntityKeyJson); Assert.Contains("all", log.BeforeJson); Assert.Contains("none", log.AfterJson);
    }

    [Fact]
    public async Task Credentials_passwords_and_source_responses_are_not_copied_into_snapshots()
    {
        await using var db = NewDb();
        var user = new User { Email = "owner@example.com", PasswordHash = "PASSWORD-MUST-NOT-APPEAR" };
        var app = new Application { Name = "Application", Owner = user };
        app.Credentials.Add(new AppCredential { TokenId = "TOKEN-ID-MUST-NOT-APPEAR", TokenSecret = "TOKEN-SECRET-MUST-NOT-APPEAR" });
        db.Applications.Add(app); await db.SaveChangesAsync();
        var content = string.Join(" ", await db.AuditLogs.Select(a => a.BeforeJson + a.AfterJson + a.EntityKeyJson).ToListAsync());
        Assert.DoesNotContain("PASSWORD-MUST-NOT-APPEAR", content);
        Assert.DoesNotContain("TOKEN-ID-MUST-NOT-APPEAR", content);
        Assert.DoesNotContain("TOKEN-SECRET-MUST-NOT-APPEAR", content);
    }

    [Fact]
    public async Task Nested_development_secrets_are_redacted_and_stage_events_use_effective_workflow_stage()
    {
        await using var db = NewDb();
        var app = new Application { Name = "Application", Owner = new User { Email = "owner@example.com" }, Status = AppStatus.Pending,
            DevelopmentJson = """{"Stage":"review","TargetTier":"tier2","tokenSecret":"DO-NOT-COPY"}""" };
        db.Applications.Add(app); await db.SaveChangesAsync();
        app.Status = AppStatus.Active; await db.SaveChangesAsync();
        var stage = await db.AuditLogs.SingleAsync(a => a.EventName == "application.stage.awaiting-deployment");
        Assert.Equal("review", stage.PreviousStage); Assert.Equal("awaiting-deployment", stage.NewStage);
        Assert.DoesNotContain("DO-NOT-COPY", string.Join(" ", await db.AuditLogs.Select(a => a.BeforeJson + a.AfterJson).ToListAsync()));
    }

    [Fact]
    public async Task Removing_a_reviewer_retains_the_removed_assignment_in_history()
    {
        await using var db = NewDb();
        var owner = new User { Email = "owner@example.com" }; var reviewer = new User { Email = "reviewer@example.com" };
        var app = new Application { Name = "Application", Owner = owner };
        var assignment = new AppReviewer { Application = app, User = reviewer, AssignedBy = "it@example.com" };
        db.AppReviewers.Add(assignment); await db.SaveChangesAsync();
        db.AppReviewers.Remove(assignment); await db.SaveChangesAsync();
        var log = await db.AuditLogs.SingleAsync(a => a.EventName == "reviewer.removed");
        Assert.Equal(app.Id, log.ApplicationId); Assert.NotNull(log.BeforeJson); Assert.Null(log.AfterJson);
    }

    [Fact]
    public async Task Last_used_token_timestamp_does_not_create_a_fake_work_event()
    {
        await using var db = NewDb(); var token = new UserToken { User = new User { Email = "owner@example.com" }, TokenHash = "hash" };
        db.UserTokens.Add(token); await db.SaveChangesAsync(); var count = await db.AuditLogs.CountAsync();
        token.LastUsedAt = DateTime.UtcNow; await db.SaveChangesAsync(); Assert.Equal(count, await db.AuditLogs.CountAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Audit_records_cannot_be_edited_or_deleted(bool remove)
    {
        await using var db = NewDb(); db.Users.Add(new User { Email = "owner@example.com" }); await db.SaveChangesAsync();
        var log = await db.AuditLogs.FirstAsync(); if (remove) db.AuditLogs.Remove(log); else log.Actor = "tampered";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Summary_counts_real_stage_events_and_filters_the_requested_actor_and_period()
    {
        await using var db = NewDb(); var app = new Application { Name = "Application", Owner = new User { Email = "owner@example.com" } };
        DevelopmentProcess.Write(app, new DevelopmentRequest("deployed", "tier2")); app.Status = AppStatus.Active;
        db.Applications.Add(app); await db.SaveChangesAsync();
        DevelopmentProcess.Write(app, DevelopmentProcess.Read(app)! with { Stage = "live" }); await db.SaveChangesAsync();
        var controller = new AuditController(db);
        var result = Assert.IsType<OkObjectResult>(await controller.Summary(new(ActorUserId: 42, ApplicationId: app.Id), default));
        var json = JsonSerializer.SerializeToElement(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(1, json.GetProperty("applications").GetInt32());
        Assert.Equal(1, json.GetProperty("byActor")[0].GetProperty("goLives").GetInt32());
        Assert.IsType<BadRequestObjectResult>(await controller.Get(new(From: DateTimeOffset.UtcNow, To: DateTimeOffset.UtcNow.AddDays(-1)), ct: default));
    }

    [Fact]
    public void Audit_read_endpoints_require_an_administrator()
    {
        var authorization = Assert.Single(typeof(AuditController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Equal("admin", authorization.Roles);
    }
}
