namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// ระดับของ App — กำหนดว่าต้องผ่านอะไรบ้างก่อน Active และได้ credential ที่ Gateway หรือไม่
///   Tier 1 แอปส่วนตัว  : User ทั่วไปสร้าง, ไม่ต่อ API, อนุมัติอัตโนมัติ
///   Tier 2 แอปภายใน   : User ทั่วไปสร้าง, ต่อ API ได้, ต้องได้กรรมการ 3 เสียง + IT รีวิวโค้ด
///   Tier 3 แอป Official: ทีม IT สร้าง, ต่อ API ได้, ขั้นตอนเหมือน Tier 2
/// ค่าที่เก็บในคอลัมน์ Applications.Type / ReviewTarget
/// </summary>
public static class AppTier
{
    public const string Tier1 = "tier1";
    public const string Tier2 = "tier2";
    public const string Tier3 = "tier3";

    public static bool IsValid(string? tier) => tier is Tier1 or Tier2 or Tier3;

    /// <summary>จำนวนเสียงกรรมการที่ต้องได้ก่อน Active</summary>
    public static int RequiredVotes(string tier) => tier == Tier1 ? 0 : 3;

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
}

public static class LogActionType
{
    public const string Create = "create";
    public const string Review = "review";
    public const string Update = "update";
    public const string Publish = "publish";
    public const string Unpublish = "unpublish";
}
