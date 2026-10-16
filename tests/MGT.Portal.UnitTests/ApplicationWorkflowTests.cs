using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>
/// ทดสอบกติกาการอนุมัติตาม Tier ใน ApplicationWorkflow (ใช้ฐานข้อมูลจำลองในหน่วยความจำ ไม่ต้องมี SQL Server)
/// </summary>
public class ApplicationWorkflowTests
{
    private const string Actor = "tester@megachem.co.th";

    private static PortalDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<PortalDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new PortalDbContext(options);
        db.CommitteeMembers.AddRange(
            new CommitteeMember { Name = "A", RoleTitle = "IT Security" },
            new CommitteeMember { Name = "B", RoleTitle = "Business Owner" },
            new CommitteeMember { Name = "C", RoleTitle = "Compliance" });
        db.SaveChanges();
        return db;
    }

    private static async Task<Application> NewDraftAsync(PortalDbContext db, string productsCsv = "")
    {
        var a = new Application
        {
            Name = "Test App",
            ProductsCsv = productsCsv,
            Status = AppStatus.Draft,
            OwnerUserId = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Applications.Add(a);
        await db.SaveChangesAsync();
        return a;
    }

    private static Task<int> ActiveCredentialCount(PortalDbContext db, Application a) =>
        db.AppCredentials.CountAsync(c => c.ApplicationId == a.Id && !c.Revoked);

    private static async Task VoteAllAsync(PortalDbContext db, ApplicationWorkflow wf, Application a)
    {
        foreach (var id in await db.CommitteeMembers.Select(m => m.Id).ToListAsync())
            Assert.True((await wf.ToggleVoteAsync(a, id, Actor)).Ok);
    }

    [Fact]
    public async Task Tier1_is_approved_immediately_and_gets_no_credentials()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db);

        var result = await wf.SendForReviewAsync(a, AppTier.Tier1, Actor);

        Assert.True(result.Ok);
        Assert.Equal(AppStatus.Active, a.Status);
        Assert.Equal(AppTier.Tier1, a.Type);
        Assert.Equal(0, await ActiveCredentialCount(db, a));
    }

    [Fact]
    public async Task Tier1_cannot_request_apis()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "hr");

        var result = await wf.SendForReviewAsync(a, AppTier.Tier1, Actor);

        Assert.False(result.Ok);
        Assert.Equal(AppStatus.Draft, a.Status);
    }

    [Fact]
    public async Task Tier2_stays_pending_with_votes_but_no_code_review()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "hr");

        Assert.True((await wf.SendForReviewAsync(a, AppTier.Tier2, Actor)).Ok);
        await VoteAllAsync(db, wf, a);

        Assert.Equal(AppStatus.Pending, a.Status);
        Assert.Equal(0, await ActiveCredentialCount(db, a));
    }

    [Fact]
    public async Task Tier2_stays_pending_with_code_review_but_two_votes()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "hr");
        Assert.True((await wf.SendForReviewAsync(a, AppTier.Tier2, Actor)).Ok);

        var ids = await db.CommitteeMembers.Select(m => m.Id).ToListAsync();
        await wf.ToggleVoteAsync(a, ids[0], Actor);
        await wf.ToggleVoteAsync(a, ids[1], Actor);
        await wf.RecordCodeReviewAsync(a, approved: true, note: null, Actor);

        Assert.Equal(AppStatus.Pending, a.Status);
    }

    [Fact]
    public async Task Tier2_becomes_active_with_three_votes_and_passed_code_review()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "hr");
        Assert.True((await wf.SendForReviewAsync(a, AppTier.Tier2, Actor)).Ok);

        await VoteAllAsync(db, wf, a);
        Assert.True((await wf.RecordCodeReviewAsync(a, approved: true, note: null, Actor)).Ok);

        Assert.Equal(AppStatus.Active, a.Status);
        Assert.Equal(AppTier.Tier2, a.Type);
        Assert.True(await db.AppCredentials.AnyAsync(c => c.ApplicationId == a.Id && c.Env == CredEnv.Sandbox && !c.Revoked));
        Assert.True(await db.AppCredentials.AnyAsync(c => c.ApplicationId == a.Id && c.Env == CredEnv.Production && !c.Revoked));
    }

    [Fact]
    public async Task Failed_code_review_keeps_the_request_pending()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "hr");
        Assert.True((await wf.SendForReviewAsync(a, AppTier.Tier3, Actor)).Ok);

        await VoteAllAsync(db, wf, a);
        await wf.RecordCodeReviewAsync(a, approved: false, note: "ยังไม่มี input validation", Actor);

        Assert.Equal(AppStatus.Pending, a.Status);
    }

    [Fact]
    public async Task Unpublish_revokes_every_credential()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "hr");
        await wf.SendForReviewAsync(a, AppTier.Tier2, Actor);
        await VoteAllAsync(db, wf, a);
        await wf.RecordCodeReviewAsync(a, approved: true, note: null, Actor);
        Assert.Equal(2, await ActiveCredentialCount(db, a));

        Assert.True((await wf.UnpublishAsync(a, Actor)).Ok);

        Assert.Equal(AppStatus.Suspended, a.Status);
        Assert.Equal(0, await ActiveCredentialCount(db, a));
    }

    [Fact]
    public void Apis_cannot_change_while_active()
    {
        var a = new Application { Status = AppStatus.Active, ProductsCsv = "hr" };

        Assert.True(ApplicationWorkflow.CanChangeProducts(a, "hr").Ok);
        Assert.False(ApplicationWorkflow.CanChangeProducts(a, "hr,sales").Ok);
    }

    [Theory]
    [InlineData(AppTier.Tier1, 0, false, false)]
    [InlineData(AppTier.Tier2, 3, true, true)]
    [InlineData(AppTier.Tier3, 3, true, true)]
    public void Tier_rules(string tier, int votes, bool codeReview, bool apis)
    {
        Assert.Equal(votes, AppTier.RequiredVotes(tier));
        Assert.Equal(codeReview, AppTier.RequiresCodeReview(tier));
        Assert.Equal(apis, AppTier.CanUseApis(tier));
    }
}
