using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;
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
        // ผู้ขอ 1 คน + ผู้ใช้ที่ IT เลือกเป็นกรรมการได้ (a, b, c, e, f เป็นกรรมการตั้งต้น 5 คนของแอปในเทสต์, d เป็นตัวสำรอง)
        db.Users.AddRange(
            new User { Email = OwnerEmail },
            new User { Email = "a@megachem.co.th" },
            new User { Email = "b@megachem.co.th" },
            new User { Email = "c@megachem.co.th" },
            new User { Email = "d@megachem.co.th" },
            new User { Email = "e@megachem.co.th" },
            new User { Email = "f@megachem.co.th" });
        db.SaveChanges();
        return db;
    }

    private const string OwnerEmail = "owner@megachem.co.th";

    private static Task<int> UserIdAsync(PortalDbContext db, string email) =>
        db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync();

    /// <summary>กรรมการตั้งต้นของแอปในเทสต์ (a, b, c, e, f — ครบ AppTier.CommitteeSize)</summary>
    private static async Task<List<int>> ReviewerIdsAsync(PortalDbContext db) =>
    [
        await UserIdAsync(db, "a@megachem.co.th"),
        await UserIdAsync(db, "b@megachem.co.th"),
        await UserIdAsync(db, "c@megachem.co.th"),
        await UserIdAsync(db, "e@megachem.co.th"),
        await UserIdAsync(db, "f@megachem.co.th"),
    ];

    /// <summary>สร้างคำขอ Draft ที่มีกรรมการ a, b, c, e, f (กรรมการเป็นรายแอป)</summary>
    private static async Task<Application> NewDraftAsync(PortalDbContext db, string productsCsv = "")
    {
        var a = new Application
        {
            Name = "Test App",
            ProductsCsv = productsCsv,
            Status = AppStatus.Draft,
            OwnerUserId = await UserIdAsync(db, OwnerEmail),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        db.Applications.Add(a);
        await db.SaveChangesAsync();
        foreach (var id in await ReviewerIdsAsync(db))
            db.AppReviewers.Add(new AppReviewer { ApplicationId = a.Id, UserId = id, AssignedAt = DateTime.UtcNow, AssignedBy = Actor });
        await db.SaveChangesAsync();
        return a;
    }

    private static Task<int> ActiveCredentialCount(PortalDbContext db, Application a) =>
        db.AppCredentials.CountAsync(c => c.ApplicationId == a.Id && !c.Revoked);

    private static async Task VoteAllAsync(PortalDbContext db, ApplicationWorkflow wf, Application a)
    {
        foreach (var id in await ReviewerIdsAsync(db))
            Assert.True((await VoteAsync(db, wf, a, id)).Ok);
    }

    /// <summary>ผู้ใช้ id นี้กดอนุมัติด้วยบัญชีของตัวเอง</summary>
    private static async Task<WorkflowResult> VoteAsync(PortalDbContext db, ApplicationWorkflow wf, Application a, int userId)
    {
        var email = await db.Users.Where(u => u.Id == userId).Select(u => u.Email).SingleAsync();
        return await wf.RecordVoteAsync(a, userId, true, null, email);
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
        var reviewerId = (await ReviewerIdsAsync(db))[0];
        Assert.False((await wf.RecordVoteAsync(app, reviewerId, true, null, "someone-else@example.com")).Ok);
        Assert.Empty(await db.AppVotes.ToListAsync());
    }

    [Fact]
    public async Task Repeated_approval_is_idempotent_and_records_the_actor_and_time()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        var id = (await ReviewerIdsAsync(db))[0];
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
        foreach (var id in await ReviewerIdsAsync(db))
            db.AppVotes.Add(new() { ApplicationId = app.Id, ReviewerUserId = id, ReviewCycle = app.ReviewCycle, Approved = true });
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
        var reviewerId = (await ReviewerIdsAsync(db))[0];
        Assert.False((await wf.RecordVoteAsync(app, reviewerId, false, null, "a@megachem.co.th")).Ok);
        Assert.True((await wf.RecordVoteAsync(app, reviewerId, false, "Explain the business purpose", "a@megachem.co.th")).Ok);
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

        var ids = await ReviewerIdsAsync(db);
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
    public async Task Each_application_has_its_own_committee()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var first = await NewDraftAsync(db, "hr");
        var second = await NewDraftAsync(db, "hr");
        var a = await UserIdAsync(db, "a@megachem.co.th");
        var b = await UserIdAsync(db, "b@megachem.co.th");
        var c = await UserIdAsync(db, "c@megachem.co.th");
        var d = await UserIdAsync(db, "d@megachem.co.th");
        var e = await UserIdAsync(db, "e@megachem.co.th");
        var f = await UserIdAsync(db, "f@megachem.co.th");
        Assert.True((await wf.SetReviewersAsync(second, [b, c, d, e, f], Actor)).Ok);
        await wf.SendForReviewAsync(first, AppTier.Tier2, Actor);
        await wf.SendForReviewAsync(second, AppTier.Tier2, Actor);

        Assert.False((await VoteAsync(db, wf, second, a)).Ok); // a เป็นกรรมการของแอปแรกเท่านั้น
        Assert.True((await VoteAsync(db, wf, second, d)).Ok);
        Assert.False((await VoteAsync(db, wf, first, d)).Ok);
        Assert.Equal(new List<int> { a, b, c, e, f }, await db.AppReviewers.Where(r => r.ApplicationId == first.Id).OrderBy(r => r.UserId).Select(r => r.UserId).ToListAsync());
    }

    [Fact]
    public async Task Replacing_a_reviewer_discards_their_decision_and_the_new_member_must_decide()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        Assert.True((await wf.SendForReviewAsync(app, AppTier.Tier2, Actor)).Ok);
        await VoteAllAsync(db, wf, app);
        var ids = await ReviewerIdsAsync(db);
        var d = await UserIdAsync(db, "d@megachem.co.th");

        Assert.True((await wf.SetReviewersAsync(app, [ids[0], ids[1], d, ids[3], ids[4]], Actor)).Ok);
        Assert.Equal(4, await db.AppVotes.CountAsync(v => v.ApplicationId == app.Id && v.ReviewCycle == app.ReviewCycle));
        Assert.Contains(await db.AppLogEntries.Select(l => l.Note).ToListAsync(), n => n != null && n.Contains("c@megachem.co.th"));

        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor)).Ok);
        Assert.Equal(AppStatus.Pending, app.Status); // ยังขาดความเห็นของ d

        Assert.False((await VoteAsync(db, wf, app, ids[2])).Ok); // คนที่ถูกเอาออกลงความเห็นไม่ได้แล้ว
        Assert.True((await VoteAsync(db, wf, app, d)).Ok);
        Assert.Equal(AppStatus.Active, app.Status);
    }

    [Fact]
    public async Task Reviewers_can_be_changed_at_any_time()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        var d = await UserIdAsync(db, "d@megachem.co.th");
        var ids = await ReviewerIdsAsync(db);

        Assert.True((await wf.SetReviewersAsync(app, [d, ids[1], ids[2], ids[3], ids[4]], Actor)).Ok); // Draft
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        Assert.True((await wf.SetReviewersAsync(app, [.. ids], Actor)).Ok); // Pending
        await VoteAllAsync(db, wf, app);
        await wf.RecordCodeReviewAsync(app, true, null, Actor);
        Assert.Equal(AppStatus.Active, app.Status);
        Assert.True((await wf.SetReviewersAsync(app, [d], Actor)).Ok); // Active — ใช้กับรอบรีวิวถัดไป
        Assert.Equal(AppStatus.Active, app.Status);
    }

    [Fact]
    public async Task Committee_has_at_most_five_different_people_and_excludes_the_requester()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        var ids = await ReviewerIdsAsync(db);
        var d = await UserIdAsync(db, "d@megachem.co.th");

        Assert.False((await wf.SetReviewersAsync(app, [.. ids, d], Actor)).Ok);
        Assert.False((await wf.SetReviewersAsync(app, [ids[0], ids[0], d], Actor)).Ok);
        Assert.False((await wf.SetReviewersAsync(app, [ids[0], ids[1], app.OwnerUserId], Actor)).Ok);
        Assert.False((await wf.SetReviewersAsync(app, [ids[0], ids[1], 9999], Actor)).Ok);
        Assert.Equal(5, await db.AppReviewers.CountAsync(r => r.ApplicationId == app.Id));
    }

    [Fact]
    public async Task Request_created_before_the_change_keeps_a_committee_of_three()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        app.CommitteeSize = AppTier.LegacyCommitteeSize;
        var ids = await ReviewerIdsAsync(db);

        Assert.False((await wf.SetReviewersAsync(app, [ids[0], ids[1], ids[2], ids[3]], Actor)).Ok);
        Assert.True((await wf.SetReviewersAsync(app, [ids[0], ids[1], ids[2]], Actor)).Ok);
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        foreach (var id in ids.Take(3)) Assert.True((await VoteAsync(db, wf, app, id)).Ok);
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor)).Ok);
        Assert.Equal(AppStatus.Active, app.Status);
    }

    [Fact]
    public void New_requests_have_a_committee_of_five()
    {
        Assert.Equal(5, new Application().CommitteeSize);
        Assert.Equal(5, AppTier.CommitteeSize);
    }

    [Fact]
    public async Task Fewer_than_five_reviewers_cannot_complete_a_review()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        var ids = await ReviewerIdsAsync(db);
        Assert.True((await wf.SetReviewersAsync(app, [ids[0], ids[1], ids[2], ids[3]], Actor)).Ok);
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        foreach (var id in ids.Take(4)) await VoteAsync(db, wf, app, id);
        await wf.RecordCodeReviewAsync(app, true, null, Actor);
        Assert.Equal(AppStatus.Pending, app.Status);
    }

    [Fact]
    public async Task IT_can_withdraw_a_code_review_and_record_it_again()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);
        Assert.False((await wf.WithdrawCodeReviewAsync(app, Actor)).Ok); // ยังไม่มีผลให้ถอน
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor)).Ok);

        Assert.True((await wf.WithdrawCodeReviewAsync(app, Actor)).Ok);
        Assert.Empty(await db.AppCodeReviews.ToListAsync());
        await VoteAllAsync(db, wf, app);
        Assert.Equal(AppStatus.Pending, app.Status); // ถอนผลผ่านแล้ว กรรมการครบก็ยังไม่อนุมัติ

        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor)).Ok);
        Assert.Equal(AppStatus.Active, app.Status);
        Assert.False((await wf.WithdrawCodeReviewAsync(app, Actor)).Ok); // อนุมัติแล้วถอนไม่ได้
    }

    [Fact]
    public async Task Code_review_keeps_https_links_only()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier2, Actor);

        Assert.False((await wf.RecordCodeReviewAsync(app, true, null, Actor, ["http://intranet/report"])).Ok);
        Assert.False((await wf.RecordCodeReviewAsync(app, true, null, Actor, ["javascript:alert(1)"])).Ok);
        Assert.False((await wf.RecordCodeReviewAsync(app, true, null, Actor, Enumerable.Range(1, 6).Select(i => $"https://megachem.sharepoint.com/{i}"))).Ok);
        Assert.Empty(await db.AppCodeReviews.ToListAsync());

        var link = "https://megachem.sharepoint.com/sites/it/review.pdf";
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor, [link, " ", link])).Ok);
        Assert.Equal([link], ApplicationWorkflow.SplitLinks(Assert.Single(await db.AppCodeReviews.ToListAsync()).Links));
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
    [InlineData(AppTier.Tier2, 5, true, true)]
    [InlineData(AppTier.Tier3, 5, true, true)]
    public void Tier_rules(string tier, int votes, bool codeReview, bool apis)
    {
        Assert.Equal(votes, AppTier.RequiredVotes(tier, AppTier.CommitteeSize));
        Assert.Equal(tier == AppTier.Tier1 ? 0 : 3, AppTier.RequiredVotes(tier, AppTier.LegacyCommitteeSize));
        Assert.Equal(codeReview, AppTier.RequiresCodeReview(tier));
        Assert.Equal(apis, AppTier.CanUseApis(tier));
    }

    [Fact]
    public async Task IT_rereview_records_each_confirmed_round_and_the_actual_approving_admin()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier3, Actor);
        app.ReviewCycle = 3;
        var first = new AppCodeReview { ApplicationId = app.Id, ReviewCycle = 1, ReviewerEmail = "it-one@megachem.co.th", Note = "Fix validation", ReviewedAt = DateTime.UtcNow.AddDays(-2) };
        var second = new AppCodeReview { ApplicationId = app.Id, ReviewCycle = 2, ReviewerEmail = "it-two@megachem.co.th", Note = "Fix permissions", ReviewedAt = DateTime.UtcNow.AddDays(-1) };
        db.AppCodeReviews.AddRange(first, second);
        await db.SaveChangesAsync();
        Assert.False((await wf.RecordCodeReviewAsync(app, true, null, Actor, resolvedCycles: [1])).Ok);
        Assert.Null(first.ResolvedBy);
        Assert.False(await db.AppCodeReviews.AnyAsync(r => r.ReviewCycle == 3));
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor, resolvedCycles: [1, 2])).Ok);
        foreach (var change in new[] { first, second })
        {
            Assert.Equal(3, change.ResolvedInCycle);
            Assert.Equal(Actor, change.ResolvedBy);
            Assert.NotNull(change.ResolvedAt);
        }
        Assert.Equal("it-one@megachem.co.th", first.ReviewerEmail);
        Assert.Equal("it-two@megachem.co.th", second.ReviewerEmail);
        Assert.True((await wf.WithdrawCodeReviewAsync(app, "it-three@megachem.co.th")).Ok);
        Assert.Equal(3, first.ResolvedInCycle);
        Assert.NotNull(second.ResolvedAt);
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, "it-three@megachem.co.th")).Ok);
        Assert.Equal(Actor, first.ResolvedBy);
    }

    [Fact]
    public async Task Later_round_does_not_overwrite_an_earlier_recorded_resolution()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier3, Actor);
        app.ReviewCycle = 4;
        var resolvedAt = DateTime.UtcNow.AddDays(-1);
        var old = new AppCodeReview { ApplicationId = app.Id, ReviewCycle = 1, ReviewerEmail = "requester-it@megachem.co.th", ResolvedInCycle = 2, ResolvedBy = "previous-it@megachem.co.th", ResolvedAt = resolvedAt };
        var pending = new AppCodeReview { ApplicationId = app.Id, ReviewCycle = 3, ReviewerEmail = Actor };
        db.AppCodeReviews.AddRange(old, pending);
        await db.SaveChangesAsync();
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor, resolvedCycles: [3])).Ok);
        Assert.Equal(2, old.ResolvedInCycle);
        Assert.Equal(resolvedAt, old.ResolvedAt);
        Assert.Equal("previous-it@megachem.co.th", old.ResolvedBy);
        Assert.Equal(4, pending.ResolvedInCycle);
        Assert.True((await wf.WithdrawCodeReviewAsync(app, Actor)).Ok);
        Assert.Equal(2, old.ResolvedInCycle);
        Assert.Equal(4, pending.ResolvedInCycle);
    }

    [Fact]
    public void IT_resolution_schema_matches_migration_snapshot()
    {
        using var db = new PortalDbContext(new DbContextOptionsBuilder<PortalDbContext>()
            .UseSqlServer("Server=unused;Database=unused;Trusted_Connection=True;TrustServerCertificate=True").Options);
        Assert.Contains("20261104090000_TrackITChangeResolution", db.Database.GetMigrations());
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task Selected_changes_pass_independently_without_passing_the_whole_review()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        await wf.SendForReviewAsync(app, AppTier.Tier3, Actor);
        app.ReviewCycle = 3;
        var first = new AppCodeReview { ApplicationId = app.Id, ReviewCycle = 1, ReviewerEmail = "it-one@megachem.co.th" };
        var second = new AppCodeReview { ApplicationId = app.Id, ReviewCycle = 2, ReviewerEmail = "it-two@megachem.co.th" };
        db.AppCodeReviews.AddRange(first, second);
        await db.SaveChangesAsync();
        Assert.False((await wf.RecordCodeReviewAsync(app, true, null, Actor, resolvedCycles: [99], resolveOnly: true)).Ok);
        Assert.Null(first.ResolvedBy);
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor, resolvedCycles: [1], resolveOnly: true)).Ok);
        Assert.Equal(Actor, first.ResolvedBy);
        Assert.Null(second.ResolvedBy);
        Assert.Equal(AppStatus.Pending, app.Status);
        Assert.False(await db.AppCodeReviews.AnyAsync(r => r.ApplicationId == app.Id && r.ReviewCycle == 3));
        Assert.False((await wf.RecordCodeReviewAsync(app, true, null, Actor)).Ok);
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, "it-three@megachem.co.th", resolvedCycles: [2], resolveOnly: true)).Ok);
        Assert.Equal("it-three@megachem.co.th", second.ResolvedBy);
        Assert.Equal(Actor, first.ResolvedBy);
        Assert.True((await wf.RecordCodeReviewAsync(app, true, null, Actor)).Ok);
        Assert.True((await wf.WithdrawCodeReviewAsync(app, Actor)).Ok);
        db.ChangeTracker.Clear();
        var stored = await db.AppCodeReviews.Where(r => r.ApplicationId == app.Id).OrderBy(r => r.ReviewCycle).ToListAsync();
        Assert.Equal(2, stored.Count);
        Assert.Equal(Actor, stored[0].ResolvedBy);
        Assert.Equal("it-three@megachem.co.th", stored[1].ResolvedBy);
    }

    [Fact]
    public async Task Deployment_requires_approval_and_records_each_admin_and_timestamp_in_order()
    {
        await using var db = NewDb();
        var wf = new ApplicationWorkflow(db);
        var app = await NewDraftAsync(db, "hr");
        DevelopmentProcess.Write(app, new DevelopmentRequest("review", "tier3", Branch: "main", Commit: "abc1234"));
        Assert.False((await wf.AdvanceDeploymentAsync(app, "deployed", Actor)).Ok);
        app.Status = AppStatus.Active;
        await db.SaveChangesAsync();
        Assert.Equal("awaiting-deployment", DevelopmentProcess.Read(app)!.Stage);
        Assert.False((await wf.AdvanceDeploymentAsync(app, "live", Actor)).Ok);
        Assert.True((await wf.AdvanceDeploymentAsync(app, "deployed", Actor)).Ok);
        var deployed = DevelopmentProcess.Read(app)!;
        Assert.Equal("deployed", deployed.Stage);
        Assert.Equal(Actor, deployed.DeployedBy);
        Assert.NotNull(deployed.DeployedAt);
        Assert.Null(deployed.LiveAt);
        Assert.False((await wf.AdvanceDeploymentAsync(app, "deployed", "other@megachem.co.th")).Ok);
        Assert.True((await wf.AdvanceDeploymentAsync(app, "live", "other@megachem.co.th")).Ok);
        db.ChangeTracker.Clear();
        var stored = DevelopmentProcess.Read(await db.Applications.FindAsync(app.Id) ?? throw new Exception())!;
        Assert.Equal("live", stored.Stage);
        Assert.Equal(Actor, stored.DeployedBy);
        Assert.Equal("other@megachem.co.th", stored.LiveBy);
        Assert.NotNull(stored.LiveAt);
        Assert.Equal("abc1234", stored.Commit);
        Assert.False((await wf.AdvanceDeploymentAsync(app, "deployed", Actor)).Ok);
    }

    [Fact]
    public async Task Stale_deployment_does_not_overwrite_the_first_administrators_decision()
    {
        var options = new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var firstDb = new PortalDbContext(options);
        var app = new Application { Status = AppStatus.Active, UpdatedAt = DateTime.UtcNow.AddHours(-1) };
        DevelopmentProcess.Write(app, new DevelopmentRequest("review", "tier2"));
        firstDb.Applications.Add(app); await firstDb.SaveChangesAsync();
        await using var secondDb = new PortalDbContext(options);
        var stale = (await secondDb.Applications.FindAsync(app.Id))!;
        Assert.True((await new ApplicationWorkflow(firstDb).AdvanceDeploymentAsync(app, "deployed", "first-admin")).Ok);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => new ApplicationWorkflow(secondDb).AdvanceDeploymentAsync(stale, "deployed", "second-admin"));
        await using var verifyDb = new PortalDbContext(options);
        var stored = DevelopmentProcess.Read((await verifyDb.Applications.FindAsync(app.Id))!)!;
        Assert.Equal("first-admin", stored.DeployedBy);
        Assert.Equal("deployed", stored.Stage);
        Assert.Null(stored.LiveAt);
    }

    [Fact]
    public async Task Reactivating_an_update_does_not_issue_separate_API_credentials()
    {
        await using var db = NewDb();
        var app = await NewDraftAsync(db, "hr");
        app.Status = AppStatus.Suspended; app.Type = AppTier.Tier2;
        DevelopmentProcess.Write(app, new DevelopmentRequest("live", "tier2", ParentApplicationId: 42));
        await db.SaveChangesAsync();
        Assert.True((await new ApplicationWorkflow(db).RepublishAsync(app, Actor)).Ok);
        Assert.Empty(await db.AppCredentials.ToListAsync());
        Assert.False(ApplicationWorkflow.CredentialAllowed(app, CredEnv.Sandbox).Ok);
        Assert.False(ApplicationWorkflow.CredentialAllowed(app, CredEnv.Production).Ok);
    }
}
