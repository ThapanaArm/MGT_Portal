using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.UnitTests;

public class SqlResiliencyTests
{
    private sealed class LostAcknowledgement : Exception { }
    public sealed class RetryFactory(ExecutionStrategyDependencies dependencies) : IExecutionStrategyFactory
    {
        public IExecutionStrategy Create() => new TestStrategy(dependencies);
    }
    private sealed class TestStrategy(ExecutionStrategyDependencies dependencies) : ExecutionStrategy(dependencies, 1, TimeSpan.Zero)
    {
        protected override bool ShouldRetryOn(Exception exception) => exception is LostAcknowledgement;
    }
    private sealed class LoseFinalSaveAcknowledgement : SaveChangesInterceptor
    {
        public bool Triggered { get; private set; }
        public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            if (!Triggered && eventData.Context!.ChangeTracker.Entries<Application>().Any(entry =>
                DevelopmentProcess.Read(entry.Entity)?.PendingUpdateId != null))
            {
                Triggered = true;
                throw new LostAcknowledgement();
            }
            return ValueTask.FromResult(result);
        }
    }

    [Fact]
    public async Task Retrying_a_lost_save_acknowledgement_returns_the_existing_update_without_duplicates()
    {
        var fault = new LoseFinalSaveAcknowledgement();
        var options = new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ReplaceService<IExecutionStrategyFactory, RetryFactory>().AddInterceptors(fault).Options;
        await using var db = new PortalDbContext(options);
        var owner = new User { Email = "owner@example.com" };
        var app = new Application { Owner = owner, Name = "Live application", Status = AppStatus.Active, Type = AppTier.Tier2 };
        DevelopmentProcess.Write(app, new DevelopmentRequest("live", AppTier.Tier2, Branch: "main", Commit: "aaaaaaa"));
        db.Applications.Add(app);
        for (var i = 1; i <= AppTier.CommitteeSize; i++)
            db.CommitteeMembers.Add(new CommitteeMember { User = new User { Email = $"member{i}@example.com" }, AddedBy = "it@example.com" });
        await db.SaveChangesAsync();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new(ClaimTypes.NameIdentifier, owner.Id.ToString()), new(ClaimTypes.Email, owner.Email), new(ClaimTypes.Role, "sales")], "Test"));
        var controller = new ApplicationsController(db, new DataBoundaryResolver(db), new ApplicationWorkflow(db)) {
            ControllerContext = new() { HttpContext = new DefaultHttpContext { User = principal } }
        };
        var result = await controller.RequestSystemUpdate(app.Id, new("1.1", "Fix", "release/1.1", "bbbbbbb"));
        Assert.True(fault.Triggered);
        Assert.IsType<OkObjectResult>(result);
        db.ChangeTracker.Clear();
        Assert.Equal(2, await db.Applications.CountAsync());
        var main = await db.Applications.FindAsync(app.Id);
        var state = DevelopmentProcess.Read(main!)!;
        Assert.NotNull(state.PendingUpdateId);
        var candidate = await db.Applications.FindAsync(state.PendingUpdateId);
        Assert.Equal("1.1", DevelopmentProcess.Read(candidate!)!.Version);
    }
}
