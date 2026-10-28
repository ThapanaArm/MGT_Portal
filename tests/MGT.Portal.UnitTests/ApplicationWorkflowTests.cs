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
            new CommitteeMember { Name = "A", RoleTitle = "IT Security", User = new() { Email = "a@megachem.co.th" } },
            new CommitteeMember { Name = "B", RoleTitle = "Business Owner", User = new() { Email = "b@megachem.co.th" } },
            new CommitteeMember { Name = "C", RoleTitle = "Compliance", User = new() { Email = "c@megachem.co.th" } });
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
            Assert.True((await VoteAsync(db, wf, a, id)).Ok);
    }

    private static async Task<WorkflowResult> VoteAsync(PortalDbContext db, ApplicationWorkflow wf, Application a, int id)
    {
        var member = await db.CommitteeMembers.Include(m => m.User).SingleAsync(m => m.Id == id);
        return await wf.RecordVoteAsync(a, member.UserId!.Value, true, null, member.User!.Email);
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
    public async Task Unassigned_account_cannot_vote_even_with_an_admin_email()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        var result = await wf.RecordVoteAsync(app, 999, true, null, Actor);
        Assert.False(result.Ok);
        Assert.Empty(await db.AppVotes.ToListAsync());
    }

    [Fact]
    public async Task Account_identity_must_match_the_assigned_committee_user()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        var member = await db.CommitteeMembers.FirstAsync();
        Assert.False((await wf.RecordVoteAsync(app, member.UserId!.Value, true, null, "someone-else@example.com")).Ok);
        Assert.Empty(await db.AppVotes.ToListAsync());
    }

    [Fact]
    public async Task Repeated_approval_is_idempotent_and_records_the_actor_and_time()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        var id = await db.CommitteeMembers.Select(m => m.Id).FirstAsync();
        await VoteAsync(db, wf, app, id);
        await VoteAsync(db, wf, app, id);
        var vote = Assert.Single(await db.AppVotes.ToListAsync());
        Assert.True(vote.Approved);
        Assert.Equal("a@megachem.co.th", vote.ActorEmail);
        Assert.NotNull(vote.DecidedAt);
        Assert.Equal(AppStatus.Pending, app.Status);
    }

    [Fact]
    public async Task Legacy_unattributed_votes_do_not_complete_a_review()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        foreach (var member in await db.CommitteeMembers.ToListAsync())
            db.AppVotes.Add(new() { ApplicationId = app.Id, CommitteeMemberId = member.Id, ReviewCycle = app.ReviewCycle, Approved = true });
        await db.SaveChangesAsync();
        await wf.RecordCodeReviewAsync(app, true, null, Actor);
        Assert.Equal(AppStatus.Pending, app.Status);
    }

    [Fact]
    public async Task Requesting_changes_requires_a_note_and_returns_the_draft_to_its_owner()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        var member = await db.CommitteeMembers.Include(m => m.User).FirstAsync();
        Assert.False((await wf.RecordVoteAsync(app, member.UserId!.Value, false, null, member.User!.Email)).Ok);
        Assert.True((await wf.RecordVoteAsync(app, member.UserId.Value, false, "Explain the business purpose", member.User.Email)).Ok);
        Assert.Equal(AppStatus.Draft, app.Status);
        Assert.False(Assert.Single(await db.AppVotes.ToListAsync()).Approved);
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        Assert.Equal(2, app.ReviewCycle);
        Assert.Equal(AppStatus.Pending, app.Status);
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
        await VoteAsync(db, wf, a, ids[0]);
        await VoteAsync(db, wf, a, ids[1]);
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
    public async Task Each_requested_api_gets_its_own_token_per_environment()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "purchase,inventory");
        await wf.SendForReviewAsync(a, AppTier.Tier2, Actor);
        await VoteAllAsync(db, wf, a);
        await wf.RecordCodeReviewAsync(a, approved: true, note: null, Actor);

        var creds = await db.AppCredentials.Where(c => c.ApplicationId == a.Id && !c.Revoked).ToListAsync();
        Assert.Equal(4, creds.Count);
        foreach (var env in new[] { CredEnv.Sandbox, CredEnv.Production })
            Assert.Equal(["inventory", "purchase"], creds.Where(c => c.Env == env).Select(c => c.Category).Order().ToArray());
        Assert.Equal(4, creds.Select(c => c.TokenId).Distinct().Count());
    }

    [Fact]
    public async Task Sync_issues_missing_category_tokens_and_revokes_removed_ones()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "sales");
        await wf.SendForReviewAsync(a, AppTier.Tier2, Actor);
        await VoteAllAsync(db, wf, a);
        await wf.RecordCodeReviewAsync(a, approved: true, note: null, Actor);
        var salesSandbox = await db.AppCredentials.SingleAsync(c => c.Env == CredEnv.Sandbox && c.Category == "sales");

        // ระงับ → เปลี่ยน API เป็น purchase + inventory → เปิดใหม่
        await wf.UnpublishAsync(a, Actor);
        a.ProductsCsv = "purchase,inventory";
        Assert.True((await wf.RepublishAsync(a, Actor)).Ok);

        var active = await db.AppCredentials.Where(c => c.ApplicationId == a.Id && !c.Revoked).ToListAsync();
        Assert.DoesNotContain(active, c => c.Category == "sales");
        Assert.Equal(4, active.Count);
        Assert.True((await db.AppCredentials.FindAsync(salesSandbox.Id))!.Revoked);
    }

    [Fact]
    public async Task Sync_adds_tokens_for_apps_that_had_a_single_shared_token()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var a = await NewDraftAsync(db, productsCsv: "sales,inventory");
        a.Status = AppStatus.Active; a.Type = AppTier.Tier2;
        // แบบเก่า: token เดียวต่อ env ผูกกับหมวดแรก (ผลจาก migration)
        foreach (var env in new[] { CredEnv.Sandbox, CredEnv.Production })
        {
            var old = CredentialGenerator.NewAppCredential(env, "sales");
            old.ApplicationId = a.Id;
            db.AppCredentials.Add(old);
        }
        await db.SaveChangesAsync();

        Assert.Equal(2, await wf.SyncCredentialsAsync(a, "system"));
        await db.SaveChangesAsync();
        Assert.Equal(0, await wf.SyncCredentialsAsync(a, "system")); // รันซ้ำไม่ออกเพิ่ม

        var active = await db.AppCredentials.Where(c => c.ApplicationId == a.Id && !c.Revoked).ToListAsync();
        Assert.Equal(4, active.Count);
        Assert.Equal(2, active.Count(c => c.Category == "sales"));
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
