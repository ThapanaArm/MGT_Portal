namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// ระดับของ App — กำหนดว่าต้องผ่านอะไรบ้างก่อน Active และได้ credential ที่ Gateway หรือไม่
///   Register : User ทั่วไปสร้าง, ไม่ต่อ API, ต้องได้เสียงอนุมัติ 3 ใน 5 ของกรรมการ (ไม่มี IT code review)
///   Verify   : User ทั่วไปสร้าง, ต่อ API ได้, ต้องได้เสียงกรรมการครบทุกคน (5/5, คำขอก่อน 11 พ.ย. 2026 = 3/3) + IT รีวิวโค้ด
///   Official : ทีม IT สร้าง, ต่อ API ได้, ขั้นตอนเหมือน Verify
/// กรรมการกด Reject (ต้องใส่เหตุผล) ได้ — เมื่อเสียง Reject ทำให้ไม่มีทางได้เสียงอนุมัติครบ คำขอถูกปิดเป็น Rejected
/// ค่าที่เก็บในคอลัมน์ Applications.Type / ReviewTarget
/// </summary>
public static class AppTier
{
    public const string Tier1 = "tier1";
    public const string Tier2 = "tier2";
    public const string Tier3 = "tier3";

    public static bool IsValid(string? tier) => tier is Tier1 or Tier2 or Tier3;

    /// <summary>
    /// จำนวนคนในคณะกรรมการชุดเดียวของ Portal (CommitteeMembers) — ทุกคำขอใช้ชุดนี้
    /// Application.CommitteeSize ของคำขอ = 5 หรือ 4 ถ้าผู้ขอเป็นกรรมการเอง (ไม่ลงความเห็นคำขอของตัวเอง)
    /// </summary>
    public const int CommitteeSize = 5;

    /// <summary>Register ต้องได้เสียงอนุมัติ 3 เสียง (จากกรรมการ 5 คน)</summary>
    public const int RegisterVotes = 3;

    /// <summary>
    /// จำนวนเสียงอนุมัติที่ต้องได้ก่อน Active — Register 3 ใน 5 (ไม่เกินจำนวนกรรมการของคำขอ),
    /// Verify / Official ต้องครบทุกคนในคณะกรรมการของ App (committeeSize ของคำขอนั้น)
    /// </summary>
    public static int RequiredVotes(string tier, int committeeSize) => tier == Tier1 ? Math.Min(RegisterVotes, committeeSize) : committeeSize;

    /// <summary>
    /// จำนวนเสียง Reject ที่ทำให้คำขอถูกปิด = เมื่อเสียงที่เหลือไม่มีทางอนุมัติครบแล้ว
    /// (Verify / Official: 1 เสียง · Register กรรมการ 5 คน: 3 เสียง)
    /// </summary>
    public static int RejectionsToClose(string tier, int committeeSize) => committeeSize - RequiredVotes(tier, committeeSize) + 1;

    /// <summary>ต้องผ่าน IT code review ก่อน Active หรือไม่</summary>
    public static bool RequiresCodeReview(string tier) => tier != Tier1;

    /// <summary>ขอใช้ API และได้ credential ที่ Gateway ได้หรือไม่</summary>
    public static bool CanUseApis(string tier) => tier != Tier1;
}

/// <summary>ใครใช้ App ได้ — ผู้สร้างเลือกในคำขอ แล้ว IT นำไปตั้งใน Entra ID (Assignment required)</summary>
public static class AppAudience
{
    public const string Self = "self";
    public const string Department = "department";
    public const string Company = "company";

    public static bool IsValid(string? audience) => audience is Self or Department or Company;
}

public static class AppStatus
{
    public const string Draft = "draft";
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Suspended = "suspended";
    /// <summary>กรรมการปฏิเสธ — ปิดคำขอถาวร แก้ไข/ส่งใหม่ไม่ได้ ต้องสร้างคำขอใหม่</summary>
    public const string Rejected = "rejected";
}

public static class LogActionType
{
    public const string Create = "create";
    public const string Review = "review";
    public const string Update = "update";
    public const string Publish = "publish";
    public const string Unpublish = "unpublish";
}
