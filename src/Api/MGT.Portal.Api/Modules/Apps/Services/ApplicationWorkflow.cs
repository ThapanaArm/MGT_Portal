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
/// เกณฑ์ของแต่ละ Tier อยู่ใน AppTier: Tier 1 ผ่านทันที, Tier 2/3 ต้องได้กรรมการ 3 เสียง + IT รีวิวโค้ดผ่าน
/// credential ที่ Gateway ออกให้เฉพาะ Tier ที่ใช้ API ได้ และถูกปิดทันทีเมื่อ App ถูกระงับ
/// Sandbox ออกตั้งแต่ IT เตรียม repo เสร็จ ส่วน Production ออกหลังอนุมัติ (ดู CredentialAllowed)
/// credential แยกตามหมวด API ที่ขอ (ProductsCsv) — ขอ 2 หมวดได้ 2 token ต่อ env
/// </summary>
public class ApplicationWorkflow(PortalDbContext db)
{
    public static string TierLabel(string tier) => tier switch
    {
        AppTier.Tier1 => "Tier 1",
        AppTier.Tier2 => "Tier 2",
        AppTier.Tier3 => "Tier 3",
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
        if (a.Status == AppStatus.Active)
            return AppTier.CanUseApis(a.Type)
                ? WorkflowResult.Success
                : WorkflowResult.Fail("Tier 1 applications do not use APIs and have no credentials");
        if (env == CredEnv.Production)
            return WorkflowResult.Fail("Production credentials are issued only after the application is approved");

        var state = DevelopmentProcess.Read(a);
        if (state?.Stage is not ("development" or "review"))
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

    /// <summary>กรรมการกดโหวต — กดซ้ำคือสลับ อนุมัติ/ยกเลิก ของรอบปัจจุบัน</summary>
    public async Task<WorkflowResult> RecordVoteAsync(Application a, int userId, bool approved, string? note, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("This application is not awaiting review");
        if (AppTier.RequiredVotes(a.ReviewTarget ?? a.Type) == 0)
            return WorkflowResult.Fail("This tier does not require committee votes");
        var member = await db.CommitteeMembers.Include(m => m.User).SingleOrDefaultAsync(m => m.UserId == userId);
        if (member?.User is null || !string.Equals(member.User.Email, actor, StringComparison.OrdinalIgnoreCase))
            return WorkflowResult.Fail("Only an assigned committee member can record their own decision");
        if (!approved && string.IsNullOrWhiteSpace(note))
            return WorkflowResult.Fail("Enter a reason for requesting changes");
        var committeeMemberId = member.Id;

        var existing = await db.AppVotes.FirstOrDefaultAsync(v =>
            v.ApplicationId == a.Id && v.CommitteeMemberId == committeeMemberId && v.ReviewCycle == a.ReviewCycle);
        if (existing is not null && existing.ActorEmail is not null && !string.Equals(existing.ActorEmail, actor, StringComparison.OrdinalIgnoreCase))
            return WorkflowResult.Fail("This committee seat already has a decision from a different account in this review cycle");
        if (existing is null)
        {
            existing = new AppVote { ApplicationId = a.Id, CommitteeMemberId = committeeMemberId, ReviewCycle = a.ReviewCycle };
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

    /// <summary>IT บันทึกผลรีวิวโค้ดของรอบปัจจุบัน (บันทึกซ้ำ = แก้ผลเดิม)</summary>
    public async Task<WorkflowResult> RecordCodeReviewAsync(Application a, bool approved, string? note, string actor)
    {
        if (!approved && string.IsNullOrWhiteSpace(note))
            return WorkflowResult.Fail("Enter the changes required by IT code review");
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("This application is not awaiting review");
        if (!AppTier.RequiresCodeReview(a.ReviewTarget ?? a.Type))
            return WorkflowResult.Fail("This tier does not require IT code review");

        var review = await db.AppCodeReviews.FirstOrDefaultAsync(r => r.ApplicationId == a.Id && r.ReviewCycle == a.ReviewCycle);
        if (review is null)
        {
            review = new AppCodeReview { ApplicationId = a.Id, ReviewCycle = a.ReviewCycle };
            db.AppCodeReviews.Add(review);
        }
        review.Approved = approved;
        review.Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        review.ReviewerEmail = actor;
        review.ReviewedAt = DateTime.UtcNow;

        Log(a, LogActionType.Update, actor, approved ? "IT code review: ผ่าน" : $"IT code review: ไม่ผ่าน{(review.Note is null ? "" : $" — {review.Note}")}");
        await db.SaveChangesAsync();

        if (!approved && a.DevelopmentJson is not null) return await RejectAsync(a, actor);
        if (approved && await TryCompleteReviewAsync(a, actor))
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
        if (AppTier.CanUseApis(a.Type) && (a.DevelopmentJson is null || HasApis(a)))
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
        var need = AppTier.RequiredVotes(target);
        var votes = need == 0 ? 0 : await db.AppVotes.CountAsync(v =>
            v.ApplicationId == a.Id && v.ReviewCycle == a.ReviewCycle && v.Approved && v.ActorEmail != null && v.DecidedAt != null);
        if (votes < need) return false;

        if (AppTier.RequiresCodeReview(target) && !await db.AppCodeReviews.AnyAsync(r =>
                r.ApplicationId == a.Id && r.ReviewCycle == a.ReviewCycle && r.Approved))
            return false;

        a.Type = target;
        a.Status = AppStatus.Active;
        a.ReviewTarget = null;
        a.UpdatedAt = DateTime.UtcNow;

        string note;
        if (AppTier.CanUseApis(target) && a.DevelopmentJson is null)
        {
            await EnsureCredentialAsync(a, CredEnv.Sandbox);
            await EnsureCredentialAsync(a, CredEnv.Production);
            note = $"อนุมัติระดับ {TierLabel(target)}: กรรมการ {votes}/3 เสียง และ IT รีวิวโค้ดผ่าน — ออก credential ให้อัตโนมัติ";
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
