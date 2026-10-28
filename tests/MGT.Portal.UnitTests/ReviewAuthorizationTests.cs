using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

public class ReviewAuthorizationTests
{
    [Fact]
    public async Task Development_access_does_not_start_deployment_review_or_issue_credentials()
    {
        await using var db = NewDb();
        var app = new Application { OwnerUserId = 7, ProductsCsv = "sales" };
        db.Applications.Add(app); await db.SaveChangesAsync();
        var owner = Controller(db, 7, "sales@megachem.co.th");
        Assert.IsType<NoContentResult>(await owner.SaveDevelopmentAccess(app.Id, new("tier2", ["sales@megachem.co.th"], true)));
        Assert.Equal("setup", DevelopmentProcess.Read(app)!.Stage);
        Assert.Equal("draft", app.Status);
        Assert.Equal(0, app.ReviewCycle);
        Assert.Empty(await db.AppCredentials.ToListAsync());
        Assert.IsType<BadRequestObjectResult>(await owner.RequestDeployment(app.Id, new("main", "a1b2c3d")));
        Assert.IsType<BadRequestObjectResult>(await owner.SendReview(app.Id, new("tier2")));
    }

    [Fact]
    public async Task Every_requested_developer_must_be_prepared_before_deployment_can_be_requested()
    {
        await using var db = NewDb();
        var app = new Application { OwnerUserId = 7, ProductsCsv = "sales" };
        db.Applications.Add(app); await db.SaveChangesAsync();
        var owner = Controller(db, 7, "sales@megachem.co.th");
        await owner.SaveDevelopmentAccess(app.Id, new("tier2", ["sales@megachem.co.th", "team@megachem.co.th"], true));
        var it = Controller(db, 42, "it@megachem.co.th", "admin");
        DeveloperPreparation[] incomplete = [new("sales@megachem.co.th", true, true), new("team@megachem.co.th", true, false)];
        Assert.IsType<ForbidResult>(await owner.PrepareDevelopment(app.Id, new("https://github.com/company/repo", incomplete, true)));
        Assert.IsType<BadRequestObjectResult>(await it.PrepareDevelopment(app.Id, new("https://github.com/company/repo", incomplete, true)));
        Assert.IsType<NoContentResult>(await it.PrepareDevelopment(app.Id, new("https://github.com/company/repo", incomplete.Select(d => d with { ApiReady = true }).ToArray(), true)));
        Assert.Equal("development", DevelopmentProcess.Read(app)!.Stage);
        Assert.IsType<BadRequestObjectResult>(await owner.RequestDeployment(app.Id, new("main", "invalid")));
        Assert.IsType<NoContentResult>(await owner.RequestDeployment(app.Id, new("main", "a1b2c3d")));
        Assert.Equal("pending", app.Status);
        Assert.Equal("review", DevelopmentProcess.Read(app)!.Stage);
        Assert.Equal("a1b2c3d", DevelopmentProcess.Read(app)!.Commit);
        // Sandbox ออกตอน IT เตรียมเสร็จ เพื่อให้ผู้ขอพัฒนาได้ — Production ยังไม่ออกจนกว่าจะอนุมัติ
        Assert.Equal(CredEnv.Sandbox, Assert.Single(await db.AppCredentials.ToListAsync()).Env);
        await new ApplicationWorkflow(db).RejectAsync(app, "it@megachem.co.th");
        Assert.Equal("development", DevelopmentProcess.Read(app)!.Stage);
    }

    [Theory]
    [InlineData("personal@gmail.com")]
    [InlineData("Name <sales@megachem.co.th>")]
    public async Task Development_request_requires_company_account(string email)
    {
        await using var db = NewDb();
        var app = new Application { OwnerUserId = 7 }; db.Applications.Add(app); await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>(await Controller(db, 7, "sales@megachem.co.th").SaveDevelopmentAccess(app.Id, new("tier2", [email], true)));
        Assert.Null(app.DevelopmentJson);
    }

    [Fact]
    public async Task Tier1_is_approved_only_after_development_and_a_separate_deployment_request()
    {
        await using var db = NewDb();
        var app = new Application { OwnerUserId = 7 }; db.Applications.Add(app); await db.SaveChangesAsync();
        var owner = Controller(db, 7, "sales@megachem.co.th");
        await owner.SaveDevelopmentAccess(app.Id, new("tier1", ["sales@megachem.co.th"], true));
        Assert.Equal("draft", app.Status);
        await Controller(db, 42, "it@megachem.co.th", "admin").PrepareDevelopment(app.Id,
            new("https://github.com/company/repo", [new("sales@megachem.co.th", true)], true));
        Assert.IsType<NoContentResult>(await owner.RequestDeployment(app.Id, new("main", "a1b2c3d")));
        Assert.Equal("active", app.Status);
        Assert.Equal("approved", DevelopmentProcess.Read(app)!.Stage);
        Assert.Empty(await db.AppCredentials.ToListAsync());
    }

    [Fact]
    public async Task Requester_cannot_set_a_repository_when_creating_a_request()
    {
        await using var db = NewDb();
        var result = await Controller(db, 7, "sales@example.com").Create(new(
            "Request", "Business purpose", "request", "https://github.com/company/repo", [], null, "fa:box", null, "self"));
        Assert.IsType<ForbidResult>(result.Result);
        Assert.Empty(await db.Applications.ToListAsync());
    }

    [Fact]
    public async Task Requester_cannot_change_an_existing_repository_through_general_update()
    {
        await using var db = NewDb();
        var owner = new User { Email = "sales@example.com" };
        var app = new Application { Name = "Request", Owner = owner, Github = "https://github.com/company/original" };
        db.Applications.Add(app); await db.SaveChangesAsync();
        var result = await Controller(db, owner.Id, owner.Email).Update(app.Id, new(
            "Request", "Business purpose", "request", "https://github.com/company/changed", [], null, "fa:box", null, "self"));
        Assert.IsType<ForbidResult>(result.Result);
        Assert.Equal("https://github.com/company/original", app.Github);
    }

    [Fact]
    public async Task Requester_cannot_use_the_IT_repository_endpoint()
    {
        await using var db = NewDb();
        Assert.IsType<ForbidResult>(await Controller(db, 7, "sales@example.com").SetRepository(1, new("https://github.com/company/repo")));
    }

    [Fact]
    public async Task IT_can_update_only_repository_information_without_changing_the_approval()
    {
        await using var db = NewDb();
        var app = new Application { Name = "Request", Description = "Business purpose", OwnerUserId = 7, Status = AppStatus.Pending, ReviewCycle = 2 };
        db.Applications.Add(app); await db.SaveChangesAsync();
        var result = await Controller(db, 42, "it@example.com", "admin").SetRepository(app.Id, new("https://github.com/company/repo"));
        Assert.IsType<NoContentResult>(result);
        Assert.Equal("https://github.com/company/repo", app.Github);
        Assert.Equal(AppStatus.Pending, app.Status);
        Assert.Equal(2, app.ReviewCycle);
        Assert.Equal("Business purpose", app.Description);
        Assert.Equal(7, app.OwnerUserId);
        Assert.Equal("it@example.com", Assert.Single(await db.AppLogEntries.ToListAsync()).Actor);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("http://github.com/company/repo")]
    [InlineData("https://user:password@github.com/company/repo")]
    public async Task IT_repository_endpoint_rejects_unsafe_urls(string url)
    {
        await using var db = NewDb();
        var app = new Application { Name = "Request", Github = "-", Status = AppStatus.Pending };
        db.Applications.Add(app); await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>(await Controller(db, 42, "it@example.com", "admin").SetRepository(app.Id, new(url)));
        Assert.Equal("-", app.Github);
    }

    [Fact]
    public async Task IT_preparation_requires_requester_submission()
    {
        await using var db = NewDb();
        var app = new Application { Name = "Draft request", Github = "-", Status = AppStatus.Draft };
        db.Applications.Add(app); await db.SaveChangesAsync();
        Assert.IsType<BadRequestObjectResult>(await Controller(db, 42, "it@example.com", "admin")
            .SetRepository(app.Id, new("https://github.com/company/repo")));
        Assert.Equal("-", app.Github);
        Assert.Empty(await db.AppLogEntries.ToListAsync());
    }

    [Fact]
    public async Task Requester_can_edit_business_details_without_changing_the_IT_repository()
    {
        await using var db = NewDb();
        var owner = new User { Email = "sales@example.com" };
        var app = new Application { Name = "Request", Owner = owner, Github = "https://github.com/company/repo", Status = AppStatus.Draft };
        db.Applications.Add(app); await db.SaveChangesAsync();
        var result = await Controller(db, owner.Id, owner.Email).Update(app.Id, new(
            "Updated business name", "New purpose", "request", app.Github, [], null, "fa:box", null, "self"));
        Assert.NotNull(result.Value);
        Assert.Equal("Updated business name", app.Name);
        Assert.Equal("https://github.com/company/repo", app.Github);
    }

    private static PortalDbContext NewDb() => new(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static ApplicationsController Controller(PortalDbContext db, int userId, string email, string role = "sales")
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier, userId.ToString()), new(ClaimTypes.Email, email), new(ClaimTypes.Role, role)], "Test"));
        return new(db, new DataBoundaryResolver(db), new ApplicationWorkflow(db)) { ControllerContext = new() { HttpContext = new DefaultHttpContext { User = principal } } };
    }

    [Fact]
    public async Task Administrator_without_a_committee_assignment_cannot_cast_votes()
    {
        await using var db = NewDb();
        var result = await Controller(db, 42, "admin@example.com", "admin").Vote(1, new VoteRequest(true));
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task Non_reviewer_cannot_read_the_review_queue()
    {
        await using var db = NewDb();
        Assert.IsType<ForbidResult>((await Controller(db, 42, "staff@example.com").GetReviewQueue()).Result);
    }

    [Fact]
    public async Task Vote_is_always_bound_to_the_authenticated_account()
    {
        await using var db = NewDb();
        var person = new User { Email = "reviewer@example.com" };
        var member = new CommitteeMember { Name = "Reviewer", RoleTitle = "Business review", User = person };
        var other = new CommitteeMember { Name = "Other", RoleTitle = "Other review", User = new User { Email = "other@example.com" } };
        var app = new Application { Name = "Request", OwnerUserId = 999, Status = AppStatus.Pending, ReviewTarget = AppTier.Tier2, ReviewCycle = 1 };
        db.CommitteeMembers.AddRange(member, other); db.Applications.Add(app); await db.SaveChangesAsync();
        var result = await Controller(db, person.Id, person.Email).Vote(app.Id, new VoteRequest(true));
        Assert.IsType<NoContentResult>(result.Result);
        var vote = Assert.Single(await db.AppVotes.ToListAsync());
        Assert.Equal(member.Id, vote.CommitteeMemberId);
        Assert.Equal(person.Email, vote.ActorEmail);
    }

    [Fact]
    public async Task Same_account_cannot_be_assigned_to_two_committee_seats()
    {
        await using var db = NewDb();
        var person = new User { Email = "reviewer@example.com" };
        var member = new CommitteeMember { Name = "First", User = person };
        var other = new CommitteeMember { Name = "Second" };
        db.CommitteeMembers.AddRange(member, other); await db.SaveChangesAsync();
        var result = await new CommitteeController(db).Assign(other.Id, new(person.Id));
        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Null(other.UserId);
    }

    [Fact]
    public async Task Committee_can_read_a_pending_request_but_not_its_credentials()
    {
        await using var db = NewDb();
        var reviewer = new User { Email = "reviewer@example.com" };
        db.CommitteeMembers.Add(new() { Name = "Reviewer", User = reviewer });
        var app = new Application { Name = "Request", Owner = new User { Email = "owner@example.com" }, Status = AppStatus.Pending, ReviewTarget = AppTier.Tier2, ReviewCycle = 1 };
        app.Credentials.Add(new() { TokenId = "test-id", TokenSecret = "test-only-secret" });
        db.Applications.Add(app); await db.SaveChangesAsync();
        var result = await Controller(db, reviewer.Id, reviewer.Email).GetById(app.Id);
        Assert.NotNull(result.Value);
        Assert.Empty(result.Value.Credentials);
        Assert.Equal("Request", result.Value.Summary.Name);
    }

    [Fact]
    public async Task Pending_vote_prevents_reassigning_its_committee_seat()
    {
        await using var db = NewDb();
        var member = new CommitteeMember { Name = "First", User = new User { Email = "first@example.com" } };
        var app = new Application { Status = AppStatus.Pending, ReviewCycle = 1 };
        db.AppVotes.Add(new() { Application = app, CommitteeMember = member, ReviewCycle = 1, Approved = true });
        await db.SaveChangesAsync();
        var result = await new CommitteeController(db).Assign(member.Id, new(null));
        Assert.IsType<BadRequestObjectResult>(result);
        Assert.NotNull(member.UserId);
    }
}
