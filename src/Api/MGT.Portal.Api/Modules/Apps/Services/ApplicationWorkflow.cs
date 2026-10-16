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

    /// <summary>รายการ API ของ App ที่ Active/Pending แก้ไม่ได้ — ต้องผ่านกรรมการใหม่ก่อน</summary>
    public static WorkflowResult CanChangeProducts(Application a, string newProductsCsv)
    {
        if (a.Status is AppStatus.Draft or AppStatus.Suspended) return WorkflowResult.Success;

        var current = a.ProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).OrderBy(x => x);
        var next = newProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).OrderBy(x => x);
        return current.SequenceEqual(next)
            ? WorkflowResult.Success
            : WorkflowResult.Fail("แก้รายการ API ได้เฉพาะตอน Draft หรือ Suspended — การขอ API เพิ่มต้องส่งให้กรรมการพิจารณาใหม่");
    }

    public async Task<WorkflowResult> SendForReviewAsync(Application a, string targetTier, string actor)
    {
        if (!AppTier.IsValid(targetTier))
            return WorkflowResult.Fail("ระดับ (Tier) ไม่ถูกต้อง");
        if (a.Status is not (AppStatus.Draft or AppStatus.Suspended))
            return WorkflowResult.Fail("ส่งตรวจสอบได้เฉพาะ Application สถานะ Draft หรือ Suspended");
        if (!AppTier.CanUseApis(targetTier) && HasApis(a))
            return WorkflowResult.Fail("Tier 1 ขอใช้ API ไม่ได้ — นำ API ออกจากคำขอ หรือเลือก Tier 2");

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
    public async Task<WorkflowResult> ToggleVoteAsync(Application a, int committeeMemberId, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("Application นี้ไม่ได้อยู่ระหว่างการตรวจสอบ");
        if (AppTier.RequiredVotes(a.ReviewTarget ?? a.Type) == 0)
            return WorkflowResult.Fail("ระดับนี้ไม่ต้องใช้การโหวตของกรรมการ");
        if (!await db.CommitteeMembers.AnyAsync(m => m.Id == committeeMemberId))
            return WorkflowResult.Fail("ไม่พบกรรมการที่ระบุ");

        var existing = await db.AppVotes.FirstOrDefaultAsync(v =>
            v.ApplicationId == a.Id && v.CommitteeMemberId == committeeMemberId && v.ReviewCycle == a.ReviewCycle);
        if (existing is null)
            db.AppVotes.Add(new AppVote { ApplicationId = a.Id, CommitteeMemberId = committeeMemberId, ReviewCycle = a.ReviewCycle, Approved = true });
        else
            existing.Approved = !existing.Approved;
        await db.SaveChangesAsync();

        if (await TryCompleteReviewAsync(a, actor))
            await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    /// <summary>IT บันทึกผลรีวิวโค้ดของรอบปัจจุบัน (บันทึกซ้ำ = แก้ผลเดิม)</summary>
    public async Task<WorkflowResult> RecordCodeReviewAsync(Application a, bool approved, string? note, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("Application นี้ไม่ได้อยู่ระหว่างการตรวจสอบ");
        if (!AppTier.RequiresCodeReview(a.ReviewTarget ?? a.Type))
            return WorkflowResult.Fail("ระดับนี้ไม่ต้องผ่าน IT code review");

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

        if (approved && await TryCompleteReviewAsync(a, actor))
            await db.SaveChangesAsync();
        return WorkflowResult.Success;
    }

    public async Task<WorkflowResult> RejectAsync(Application a, string actor)
    {
        if (a.Status != AppStatus.Pending)
            return WorkflowResult.Fail("Application นี้ไม่ได้อยู่ระหว่างการตรวจสอบ");

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
            return WorkflowResult.Fail("ระงับได้เฉพาะ Application ที่ Active");

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
            return WorkflowResult.Fail("เผยแพร่อีกครั้งได้เฉพาะ Application ที่ถูกระงับ (Suspended)");

        a.Status = AppStatus.Active;
        a.UpdatedAt = DateTime.UtcNow;
        if (AppTier.CanUseApis(a.Type))
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
            v.ApplicationId == a.Id && v.ReviewCycle == a.ReviewCycle && v.Approved);
        if (votes < need) return false;

        if (AppTier.RequiresCodeReview(target) && !await db.AppCodeReviews.AnyAsync(r =>
                r.ApplicationId == a.Id && r.ReviewCycle == a.ReviewCycle && r.Approved))
            return false;

        a.Type = target;
        a.Status = AppStatus.Active;
        a.ReviewTarget = null;
        a.UpdatedAt = DateTime.UtcNow;

        string note;
        if (AppTier.CanUseApis(target))
        {
            await EnsureCredentialAsync(a, CredEnv.Sandbox);
            await EnsureCredentialAsync(a, CredEnv.Production);
            note = $"อนุมัติระดับ {TierLabel(target)}: กรรมการ {votes}/3 เสียง และ IT รีวิวโค้ดผ่าน — ออก credential ให้อัตโนมัติ";
        }
        else
        {
            // Tier 1 ไม่มีสิทธิ์เรียก API — ถ้าเคยมี credential จาก Tier เดิมให้ปิดทิ้ง
            await RevokeAllCredentialsAsync(a);
            note = $"อนุมัติอัตโนมัติระดับ {TierLabel(target)} (ไม่ต่อ API จึงไม่ออก credential)";
        }
        Log(a, LogActionType.Publish, actor, note);
        return true;
    }

    private async Task EnsureCredentialAsync(Application a, string env)
    {
        if (await db.AppCredentials.AnyAsync(c => c.ApplicationId == a.Id && c.Env == env && !c.Revoked)) return;
        var cred = CredentialGenerator.NewAppCredential(env);
        cred.ApplicationId = a.Id;
        db.AppCredentials.Add(cred);
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
