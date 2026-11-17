using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>ผลของคำสั่งใน workflow — Error เป็นข้อความภาษาไทยที่ส่งกลับให้ผู้ใช้ได้เลย</summary>
public sealed record WorkflowResult(bool Ok, string? Error = null)
{
    public static readonly WorkflowResult Success = new(true);
    public static WorkflowResult Fail(string error) => new(false, error);
}

/// <summary>
/// กติกาการอนุมัติ App ทั้งหมดอยู่ที่นี่ที่เดียว (controller แค่รับ request แล้วเรียก method ในนี้)
///
/// เส้นทางของคำขอ:
///   Draft ──ส่งรีวิว──▶ Pending ──ผ่านเกณฑ์ของ Tier──▶ Active ──Unpublish──▶ Suspended
///                         │                                    ▲                │
///                         └──ปฏิเสธ──▶ Draft                    └────Publish────┘
///
/// เกณฑ์ของแต่ละ Tier อยู่ใน AppTier: Tier 1 ผ่านทันที, Tier 2/3 ต้องได้เสียงกรรมการครบ Application.CommitteeSize (ใหม่ 5, คำขอเดิม 3) + IT รีวิวโค้ดผ่าน
/// กรรมการเป็นรายแอป: IT เลือก 3 คนให้แต่ละ App และเปลี่ยนได้ทุกเมื่อ (SetReviewersAsync)
/// นับเฉพาะเสียงของคนที่ยังเป็นกรรมการของ App อยู่ — เปลี่ยนคนระหว่างรีวิว เสียงของคนเดิมในรอบนั้นถูกทิ้ง
/// credential ที่ Gateway ออกให้เฉพาะ Tier ที่ใช้ API ได้ และถูกปิดทันทีเมื่อ App ถูกระงับ
/// Sandbox ออกตั้งแต่ IT เตรียม repo เสร็จ ส่วน Production ออกหลังอนุมัติ (ดู CredentialAllowed)
/// credential แยกตามหมวด API ที่ขอ (ProductsCsv) — ขอ 2 หมวดได้ 2 token ต่อ env
/// </summary>
public class ApplicationWorkflow(PortalDbContext db)
{
    public static string TierLabel(string tier) => tier switch
    {
        AppTier.Tier1 => "Tier 1 Register",
        AppTier.Tier2 => "Tier 2 Verify",
        AppTier.Tier3 => "Tier 3 Official",
        _ => tier,
    };

    public static string NormalizeCategory(string category) => category.Trim().ToLowerInvariant();

    /// <summary>หมวด API ที่ App ขอไว้ (key ตัวเล็ก ไม่ซ้ำ) — credential ออกตามรายการนี้</summary>
    public static IReadOnlyList<string> ApiCategories(Application a) =>
        a.ProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeCategory).Where(c => c.Length > 0).Distinct().ToList();

    /// <summary>รายการ API ของ App ที่ Active/Pending แก้ไม่ได้ — ต้องผ่านกรรมการใหม่ก่อน</summary>
    public static WorkflowResult CanChangeProducts(Application a, string newProductsCsv)
    {
        if (a.Status is AppStatus.Draft or AppStatus.Suspended) return WorkflowResult.Success;

        var current = a.ProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).OrderBy(x => x);
        var next = newProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).OrderBy(x => x);
        return current.SequenceEqual(next)
            ? WorkflowResult.Success
            : WorkflowResult.Fail("API products can only be changed for draft or suspended applications. Additional APIs require a new committee review.");
    }

    /// <summary>
    /// credential ของ env นี้ออกได้และใช้ที่ Gateway ได้หรือไม่ — ใช้ทั้งตอนออก credential และตอน Gateway ตรวจ
    ///   Sandbox    : ตั้งแต่ IT เตรียม repo เสร็จ (development / review) ไปจนหลังอนุมัติ
    ///   Production : หลังอนุมัติ (Active) เท่านั้น
    /// ต้องเป็น Tier ที่ใช้ API ได้ และใช้ไม่ได้เมื่อ App ถูกระงับ
    /// </summary>
    public static WorkflowResult CredentialAllowed(Application a, string env)
    {
        if (env is not (CredEnv.Sandbox or CredEnv.Production))
            return WorkflowResult.Fail("Unknown credential environment");
        if (DevelopmentProcess.Read(a)?.ParentApplicationId != null)
            return WorkflowResult.Fail("Manage API credentials on the main application. Update requests do not have separate credentials.");
        if (a.Status == AppStatus.Active)
            return AppTier.CanUseApis(a.Type)
                ? WorkflowResult.Success
                : WorkflowResult.Fail("Tier 1 applications do not use APIs and have no credentials");
        if (env == CredEnv.Production)
            return WorkflowResult.Fail("Production credentials are issued only after the application is approved");

        var state = DevelopmentProcess.Read(a);
        if (state is null || (!DevelopmentProcess.IsDeveloping(state.Stage) && state.Stage != "review"))
            return WorkflowResult.Fail("Sandbox credentials are issued after IT completes development preparation");
        if (!AppTier.CanUseApis(state.TargetTier) || !HasApis(a))
            return WorkflowResult.Fail("This request does not include API access");
        return WorkflowResult.Success;
    }

    /// <summary>IT เตรียม repo เสร็จ — ออก Sandbox credential ให้ผู้ขอใช้พัฒนาและทดสอบ (ยังไม่ SaveChanges)</summary>
    public async Task IssueDevelopmentCredentialAsync(Application a, string actor)
    {
        if (!CredentialAllowed(a, CredEnv.Sandbox).Ok) return;
        var issued = await EnsureCredentialAsync(a, CredEnv.Sandbox);
        if (issued.Count > 0)
            Log(a, LogActionType.Update, actor, $"ออก Sandbox credential สำหรับพัฒนาและทดสอบ ({string.Join(", ", issued)})");
    }

    public async Task<WorkflowResult> SendForReviewAsync(Application a, string targetTier, string actor)
    {
        if (!AppTier.IsValid(targetTier))
            return WorkflowResult.Fail("Invalid application tier");
        if (a.Status is not (AppStatus.Draft or AppStatus.Suspended))
            return WorkflowResult.Fail("Only draft or suspended applications can be submitted for review");
        if (!AppTier.CanUseApis(targetTier) && HasApis(a))
            return WorkflowResult.Fail("Tier 1 does not support APIs. Remove the API products or select Tier 2.");

        a.Status = AppStatus.Pending;
        a.ReviewTarget = targetTier;
        a.ReviewCycle += 1;
        a.UpdatedAt = DateTime.UtcNow;
        Log(a, LogActionType.Review, actor, $"ขอตรวจสอบระดับ {TierLabel(targetTier)}");

        // Tier 1 ไม่ต้องรอกรรมการ จึงผ่านทันทีในขั้นนี้
        await TryCompleteReviewAsync(a, actor);
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>
    /// IT เลือก/เปลี่ยนกรรมการของ App (ไม่เกิน Application.CommitteeSize คน ไม่ซ้ำกัน และไม่ใช่ผู้ขอเอง) — เปลี่ยนได้ทุกเมื่อ
    /// ถ้า App กำลังรอรีวิว ความเห็นของคนที่ถูกเอาออกในรอบปัจจุบันจะถูกทิ้ง กรรมการคนใหม่ต้องลงความเห็นเอง
    /// </summary>
    public async Task<WorkflowResult> SetReviewersAsync(Application a, IReadOnlyCollection<int> userIds, string actor)
    {
        var wanted = userIds.Distinct().ToList();
        if (wanted.Count != userIds.Count)
            return WorkflowResult.Fail("Select a different person for each committee seat");
        if (wanted.Count > a.CommitteeSize)
            return WorkflowResult.Fail($"This application has at most {a.CommitteeSize} committee members");
        if (wanted.Contains(a.OwnerUserId))
            return WorkflowResult.Fail("The requester cannot be a committee member for their own application");
        var users = await db.Users.Where(u => wanted.Contains(u.Id)).ToListAsync();
        if (users.Count != wanted.Count)
            return WorkflowResult.Fail("User not found");

        var current = await db.AppReviewers.Include(r => r.User).Where(r => r.ApplicationId == a.Id).ToListAsync();
        var removed = current.Where(r => !wanted.Contains(r.UserId)).ToList();
        var added = users.Where(u => current.All(r => r.UserId != u.Id)).OrderBy(u => wanted.IndexOf(u.Id)).ToList();
        if (removed.Count == 0 && added.Count == 0) return WorkflowResult.Success;

        db.AppReviewers.RemoveRange(removed);
        var now = DateTime.UtcNow;
        foreach (var user in added)
            db.AppReviewers.Add(new AppReviewer { ApplicationId = a.Id, UserId = user.Id, AssignedAt = now, AssignedBy = actor });

        var discarded = 0;
        if (a.Status == AppStatus.Pending && removed.Count > 0)
        {
            var removedIds = removed.Select(r => r.UserId).ToList();
            var stale = await db.AppVotes.Where(v =>
                v.ApplicationId == a.Id && v.ReviewCycle == a.ReviewCycle && removedIds.Contains(v.ReviewerUserId)).ToListAsync();
            db.AppVotes.RemoveRange(stale);
            discarded = stale.Count;
        }

        var parts = new List<string>();
        if (added.Count > 0) parts.Add("เพิ่ม " + string.Join(", ", added.Select(u => u.Email)));
        if (removed.Count > 0) parts.Add("เอาออก " + string.Join(", ", removed.Select(r => r.User.Email)));
        if (discarded > 0) parts.Add($"ทิ้งความเห็นของคนที่ถูกเอาออก {discarded} รายการในรอบรีวิวนี้");
        Log(a, LogActionType.Update, actor, "เปลี่ยนกรรมการ: " + string.Join(" · ", parts));
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>กรรมการของ App นี้ลงความเห็น — กดซ้ำคือแก้ความเห็นของตัวเองในรอบปัจจุบัน</summary>
    public async Task<WorkflowResult> RecordVoteAsync(Application a, int userId, bool approved, string? note, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("This application is not awaiting review");
        if (AppTier.RequiredVotes(a.ReviewTarget ?? a.Type, a.CommitteeSize) == 0)
            return WorkflowResult.Fail("This tier does not require committee votes");
        var reviewer = await db.AppReviewers.Include(r => r.User)
            .SingleOrDefaultAsync(r => r.ApplicationId == a.Id && r.UserId == userId);
        if (reviewer is null || !string.Equals(reviewer.User.Email, actor, StringComparison.OrdinalIgnoreCase))
            return WorkflowResult.Fail("Only a committee member assigned to this application can record their own decision");
        if (!approved && string.IsNullOrWhiteSpace(note))
            return WorkflowResult.Fail("Enter a reason for requesting changes");

        var existing = await db.AppVotes.FirstOrDefaultAsync(v =>
            v.ApplicationId == a.Id && v.ReviewerUserId == userId && v.ReviewCycle == a.ReviewCycle);
        if (existing is null)
        {
            existing = new AppVote { ApplicationId = a.Id, ReviewerUserId = userId, ReviewCycle = a.ReviewCycle };
            db.AppVotes.Add(existing);
        }
        existing.Approved = approved;
        existing.ActorEmail = actor;
        existing.DecidedAt = DateTime.UtcNow;
        existing.Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        Log(a, LogActionType.Update, actor, approved ? "Committee approval recorded" : $"Changes requested: {existing.Note}");
        await db.SaveChangesAsync();

        if (!approved) return await RejectAsync(a, actor);

        if (await TryCompleteReviewAsync(a, actor))
            await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    public const int MaxReviewLinks = 5;

    /// <summary>
    /// ตรวจลิงก์เอกสารประกอบ: ต้องเป็น https:// แบบเต็ม ไม่เกิน 5 ลิงก์ ลิงก์ละไม่เกิน 2,000 ตัวอักษร
    /// Portal เก็บเฉพาะลิงก์ (เช่น SharePoint / OneDrive) ไม่เก็บไฟล์
    /// </summary>
    public static WorkflowResult NormalizeLinks(IEnumerable<string>? links, out List<string> normalized)
    {
        normalized = (links ?? []).Select(l => l?.Trim() ?? "").Where(l => l.Length > 0).Distinct().ToList();
        if (normalized.Count > MaxReviewLinks)
            return WorkflowResult.Fail($"Add up to {MaxReviewLinks} links");
        foreach (var link in normalized)
            if (link.Length > 2000 || !Uri.TryCreate(link, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
                return WorkflowResult.Fail("Links must be full https:// addresses, such as a SharePoint or OneDrive link");
        return WorkflowResult.Success;
    }

    public static List<string> SplitLinks(string? links) =>
        string.IsNullOrWhiteSpace(links) ? [] : links.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    /// <summary>IT บันทึกผลรีวิวโค้ดของรอบปัจจุบัน (บันทึกซ้ำ = แก้ผลเดิม) แนบลิงก์เอกสารประกอบได้</summary>
    public async Task<WorkflowResult> RecordCodeReviewAsync(Application a, bool approved, string? note, string actor, IEnumerable<string>? links = null, IEnumerable<int>? resolvedCycles = null, bool resolveOnly = false)
    {
        if (resolveOnly && !approved) return WorkflowResult.Fail("Select a passing change review.");
        if (!approved && string.IsNullOrWhiteSpace(note))
            return WorkflowResult.Fail("Enter the changes required by IT code review");
        var linkCheck = NormalizeLinks(links, out var cleanLinks);
        if (!linkCheck.Ok) return linkCheck;
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("This application is not awaiting review");
        if (!AppTier.RequiresCodeReview(a.ReviewTarget ?? a.Type))
            return WorkflowResult.Fail("This tier does not require IT code review");

        var outstanding = await db.AppCodeReviews.Where(r => r.ApplicationId == a.Id && !r.Approved && r.ResolvedInCycle == null).ToListAsync();
        var confirmed = (resolvedCycles ?? []).Distinct().Order().ToArray();
        if (resolveOnly)
        {
            if (confirmed.Length == 0 || confirmed.Any(cycle => !outstanding.Any(r => r.ReviewCycle == cycle)))
                return WorkflowResult.Fail("Select outstanding IT change requests. Refresh if another administrator updated them.");
            var checkedAt = DateTime.UtcNow;
            foreach (var change in outstanding.Where(r => confirmed.Contains(r.ReviewCycle)))
            {
                change.ResolvedInCycle = a.ReviewCycle;
                change.ResolvedBy = actor;
                change.ResolvedAt = checkedAt;
                Log(a, LogActionType.Update, actor, $"IT change request round {change.ReviewCycle} passed in round {a.ReviewCycle} (requested by {change.ReviewerEmail}).");
            }
            await db.SaveChangesAsync();
            return WorkflowResult.Success;
        }
        if (approved && !confirmed.SequenceEqual(outstanding.Select(r => r.ReviewCycle).Order()))
            return WorkflowResult.Fail("Confirm every outstanding IT change request before passing the review. Refresh if another administrator updated the request.");
        if (approved && outstanding.Any(r => r.ReviewCycle == a.ReviewCycle))
            return WorkflowResult.Fail("Resubmit the changes in a new review round to preserve the original IT change request.");

        var review = await db.AppCodeReviews.FirstOrDefaultAsync(r => r.ApplicationId == a.Id && r.ReviewCycle == a.ReviewCycle);
        if (review?.Approved == true)
            return WorkflowResult.Fail("Withdraw the current IT approval before recording a new decision.");
        if (review is null)
        {
            review = new AppCodeReview { ApplicationId = a.Id, ReviewCycle = a.ReviewCycle };
            db.AppCodeReviews.Add(review);
        }
        review.Approved = approved;
        review.Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        review.Links = cleanLinks.Count == 0 ? null : string.Join("\n", cleanLinks);
        review.ReviewerEmail = actor;
        review.ReviewedAt = DateTime.UtcNow;

        if (approved)
            foreach (var change in outstanding)
            {
                change.ResolvedInCycle = a.ReviewCycle;
                change.ResolvedBy = actor;
                change.ResolvedAt = review.ReviewedAt;
                Log(a, LogActionType.Update, actor, $"IT change request round {change.ReviewCycle} passed in round {a.ReviewCycle} (requested by {change.ReviewerEmail}).");
            }

        Log(a, LogActionType.Update, actor, approved ? "IT code review: ผ่าน" : $"IT code review: ไม่ผ่าน{(review.Note is null ? "" : $" — {review.Note}")}");
        await db.SaveChangesAsync();

        if (!approved && a.DevelopmentJson is not null) return await RejectAsync(a, actor);
        if (approved && await TryCompleteReviewAsync(a, actor))
            await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>IT ถอนผล code review ของรอบปัจจุบัน — กลับเป็น "รอรีวิว" แล้วบันทึกผลใหม่ได้</summary>
    public async Task<WorkflowResult> WithdrawCodeReviewAsync(Application a, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("This application is not awaiting review");
        var review = await db.AppCodeReviews.FirstOrDefaultAsync(r => r.ApplicationId == a.Id && r.ReviewCycle == a.ReviewCycle);
        if (review is null)
            return WorkflowResult.Fail("There is no IT code review to withdraw in this review cycle");

        if (!review.Approved)
            return WorkflowResult.Fail("Change requests are retained as history. Submit a new review round after correcting the changes.");

        // Item-level passes are independent of the overall IT approval.
        db.AppCodeReviews.Remove(review);
        Log(a, LogActionType.Update, actor, review.Approved ? "IT code review: ถอนผลผ่าน กลับเป็นรอรีวิว" : "IT code review: ถอนผลขอแก้ไข กลับเป็นรอรีวิว");
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    public async Task<WorkflowResult> AdvanceDeploymentAsync(Application app, string stage, string actor)
    {
        var state = DevelopmentProcess.Read(app);
        if (app.Status != AppStatus.Active || state is null)
            return WorkflowResult.Fail("The request must be approved before deployment.");
        var now = DateTime.UtcNow;
        if (stage == "deployed" && state.Stage == "awaiting-deployment")
            state = state with { Stage = "deployed", DeployedBy = actor, DeployedAt = now };
        else if (stage == "live" && state.Stage == "deployed")
            state = state with { Stage = "live", LiveBy = actor, LiveAt = now };
        else return WorkflowResult.Fail("Refresh the request and follow Awaiting deployment, Deployed, then Go live.");
        if (stage == "live" && state.ParentApplicationId is int parentId)
        {
            var parent = await db.Applications.FindAsync(parentId);
            var previous = parent is null ? null : DevelopmentProcess.Read(parent);
            if (parent?.Status != AppStatus.Active || previous?.Stage != "live" || previous.PendingUpdateId != app.Id)
                return WorkflowResult.Fail("The live application is unavailable or this update is no longer current.");
            var release = new ReleaseRecord(app.Id, state.Version, state.ChangeSummary, state.Branch, state.Commit,
                state.DeployedBy, state.DeployedAt, state.LiveBy, state.LiveAt);
            DevelopmentProcess.Write(parent, previous with { Stage = "live", Version = state.Version, ChangeSummary = state.ChangeSummary,
                Branch = state.Branch, Commit = state.Commit, DeployedBy = state.DeployedBy, DeployedAt = state.DeployedAt,
                LiveBy = state.LiveBy, LiveAt = state.LiveAt, PendingUpdateId = null, Releases = [.. previous.Releases ?? [], release] });
            parent.UpdatedAt = now;
            Log(parent, LogActionType.Update, actor, $"Update {state.Version} is live (request #{app.Id}).");
        }
        DevelopmentProcess.Write(app, state);
        app.UpdatedAt = now;
        Log(app, LogActionType.Update, actor, stage == "live" ? "Application is now live." : "Deployment completed. Awaiting go live.");
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    public async Task<WorkflowResult> RejectAsync(Application a, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("This application is not awaiting review");

        var target = a.ReviewTarget ?? a.Type;
        a.Status = AppStatus.Draft;
        a.ReviewTarget = null;
        a.UpdatedAt = DateTime.UtcNow;
        Log(a, LogActionType.Update, actor, $"คณะกรรมการปฏิเสธคำขอระดับ {TierLabel(target)}");
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>ระงับ App — ปิด credential ทั้งหมดทันที App จึงเรียก API ผ่าน Gateway ไม่ได้อีก</summary>
    public async Task<WorkflowResult> UnpublishAsync(Application a, string actor)
    {
        if (a.Status != AppStatus.Active)
            return WorkflowResult.Fail("Only active applications can be suspended");

        a.Status = AppStatus.Suspended;
        a.UpdatedAt = DateTime.UtcNow;
        var revoked = await RevokeAllCredentialsAsync(a);
        Log(a, LogActionType.Unpublish, actor, revoked > 0 ? $"ปิด credential {revoked} รายการ" : null);
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>เปิด App ที่ถูกระงับกลับมา — ใช้ Tier เดิมที่เคยได้รับอนุมัติ</summary>
    public async Task<WorkflowResult> RepublishAsync(Application a, string actor)
    {
        if (a.Status != AppStatus.Suspended)
            return WorkflowResult.Fail("Only suspended applications can be published again");

        a.Status = AppStatus.Active;
        a.UpdatedAt = DateTime.UtcNow;
        if (DevelopmentProcess.Read(a)?.ParentApplicationId == null && AppTier.CanUseApis(a.Type) && (a.DevelopmentJson is null || HasApis(a)))
        {
            await EnsureCredentialAsync(a, CredEnv.Sandbox);
            await EnsureCredentialAsync(a, CredEnv.Production);
        }
        Log(a, LogActionType.Publish, actor, null);
        await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>
    /// ถ้าคำขอผ่านเกณฑ์ของ Tier ครบแล้ว เปลี่ยนเป็น Active และออก credential (ยังไม่ SaveChanges)
    /// เรียกหลังบันทึกคะแนนโหวต / ผล code review ลงฐานข้อมูลแล้วเท่านั้น เพราะนับจากฐานข้อมูล
    /// </summary>
    private async Task<bool> TryCompleteReviewAsync(Application a, string actor)
    {
        if (a.Status != AppStatus.Pending) return false;

        var target = a.ReviewTarget ?? a.Type;
        var need = AppTier.RequiredVotes(target, a.CommitteeSize);
        var votes = 0;
        if (need > 0)
        {
            // นับเฉพาะเสียงของคนที่ยังเป็นกรรมการของ App นี้อยู่
            var reviewerIds = await db.AppReviewers.Where(r => r.ApplicationId == a.Id).Select(r => r.UserId).ToListAsync();
            votes = await db.AppVotes.CountAsync(v =>
                v.ApplicationId == a.Id && v.ReviewCycle == a.ReviewCycle && v.Approved && v.ActorEmail != null && v.DecidedAt != null
                && reviewerIds.Contains(v.ReviewerUserId));
        }
        if (votes < need) return false;

        if (AppTier.RequiresCodeReview(target) && !await db.AppCodeReviews.AnyAsync(r =>
                r.ApplicationId == a.Id && r.ReviewCycle == a.ReviewCycle && r.Approved))
            return false;

        a.Type = target;
        a.Status = AppStatus.Active;
        a.ReviewTarget = null;
        a.UpdatedAt = DateTime.UtcNow;

        string note;
        if (DevelopmentProcess.Read(a)?.ParentApplicationId != null)
            note = "System update approved for deployment. Existing live application and credentials remain unchanged.";
        else if (AppTier.CanUseApis(target) && a.DevelopmentJson is null)
        {
            await EnsureCredentialAsync(a, CredEnv.Sandbox);
            await EnsureCredentialAsync(a, CredEnv.Production);
            note = $"อนุมัติระดับ {TierLabel(target)}: กรรมการ {votes}/{need} เสียง และ IT รีวิวโค้ดผ่าน — ออก credential ให้อัตโนมัติ";
        }
        else if (!AppTier.CanUseApis(target))
        {
            // Tier 1 ไม่มีสิทธิ์เรียก API — ถ้าเคยมี credential จาก Tier เดิมให้ปิดทิ้ง
            await RevokeAllCredentialsAsync(a);
            note = $"อนุมัติอัตโนมัติระดับ {TierLabel(target)} (ไม่ต่อ API จึงไม่ออก credential)";
        }
        else if (HasApis(a))
        {
            // คำขอแบบใหม่: Sandbox ออกไปแล้วตอน IT เตรียมเสร็จ — ตอนอนุมัติจึงออก Production เพิ่ม
            await EnsureCredentialAsync(a, CredEnv.Sandbox);
            await EnsureCredentialAsync(a, CredEnv.Production);
            note = "Deployment request approved. Production credential issued; IT handles deployment separately.";
        }
        else note = "Deployment request approved. IT handles deployment separately.";
        Log(a, LogActionType.Publish, actor, note);
        return true;
    }

    /// <summary>
    /// ทำให้ credential ของ env นี้ตรงกับหมวด API ที่ขอ: ออกให้หมวดที่ยังไม่มี และเพิกถอนหมวดที่ไม่ได้ขอแล้ว
    /// คืนรายชื่อหมวดที่ออกใหม่ (ยังไม่ SaveChanges)
    /// </summary>
    private async Task<List<string>> EnsureCredentialAsync(Application a, string env)
    {
        var wanted = ApiCategories(a);
        var active = await db.AppCredentials.Where(c => c.ApplicationId == a.Id && c.Env == env && !c.Revoked).ToListAsync();

        foreach (var stale in active.Where(c => !wanted.Contains(c.Category)))
            stale.Revoked = true;

        var issued = new List<string>();
        foreach (var category in wanted.Where(cat => !active.Any(c => c.Category == cat)))
        {
            var cred = CredentialGenerator.NewAppCredential(env, category);
            cred.ApplicationId = a.Id;
            db.AppCredentials.Add(cred);
            issued.Add(category);
        }
        return issued;
    }

    /// <summary>
    /// ปรับ credential ของทุก env ที่ใช้ได้ตอนนี้ให้ครบตามหมวด API (เช่น หลังแก้รายการ API หรือย้ายจาก token เดียวต่อแอป)
    /// คืนจำนวน token ที่ออกใหม่ (ยังไม่ SaveChanges)
    /// </summary>
    public async Task<int> SyncCredentialsAsync(Application a, string actor)
    {
        var total = 0;
        foreach (var env in new[] { CredEnv.Sandbox, CredEnv.Production })
        {
            if (!CredentialAllowed(a, env).Ok) continue;
            if (env == CredEnv.Production && a.Status != AppStatus.Active) continue;
            var hasAny = await db.AppCredentials.AnyAsync(c => c.ApplicationId == a.Id && c.Env == env);
            // แตะเฉพาะ env ที่เคยออก token แล้ว — ไม่ออก env ใหม่ข้ามขั้นตอนอนุมัติ
            if (!hasAny) continue;
            var issued = await EnsureCredentialAsync(a, env);
            if (issued.Count == 0) continue;
            total += issued.Count;
            Log(a, LogActionType.Update, actor, $"ออก {env} credential แยกตามหมวด API: {string.Join(", ", issued)}");
        }
        return total;
    }

    private async Task<int> RevokeAllCredentialsAsync(Application a)
    {
        var active = await db.AppCredentials.Where(c => c.ApplicationId == a.Id && !c.Revoked).ToListAsync();
        foreach (var c in active) c.Revoked = true;
        return active.Count;
    }

    private static bool HasApis(Application a) => !string.IsNullOrWhiteSpace(a.ProductsCsv);

    private void Log(Application a, string action, string actor, string? note) =>
        db.AppLogEntries.Add(new AppLogEntry
        {
            ApplicationId = a.Id, ActionType = action, OccurredAt = DateTime.UtcNow, Actor = actor, Note = note,
        });
}
