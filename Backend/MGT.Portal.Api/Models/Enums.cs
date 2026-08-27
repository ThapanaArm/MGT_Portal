namespace MGT.Portal.Api.Models;

public static class AppType
{
    public const string Registered = "registered";
    public const string Verify = "verify";
    public const string Official = "official";
}

public static class AppStatus
{
    public const string Draft = "draft";
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Suspended = "suspended";
}

public static class CredEnv
{
    public const string Sandbox = "sandbox";
    public const string Production = "production";
}

/// <summary>ระดับในองค์กร — ใช้กำหนดขอบเขตการเห็นข้อมูลเริ่มต้นของผู้ใช้</summary>
public static class OrgLevel
{
    public const string Employee = "employee";     // เห็นเฉพาะข้อมูลของตัวเอง
    public const string Manager = "manager";       // เห็นข้อมูลของทีมตัวเอง
    public const string Management = "management"; // เห็นข้อมูลทั้งหมด
}

/// <summary>
/// ขอบเขตข้อมูลระดับแถว (row-level) — คนละชั้นกับ Scope ซึ่งคุมว่าเรียก endpoint ไหนได้
/// Scope = "เรียก API นี้ได้ไหม" / DataScope = "เห็นข้อมูลของใครได้บ้าง"
/// </summary>
public static class DataScope
{
    public const string Self = "self";
    public const string Team = "team";
    public const string All = "all";

    /// <summary>ขอบเขตเริ่มต้นตามระดับองค์กร — ไม่รู้จักระดับไหน ถือว่าแคบสุดไว้ก่อน (deny by default)</summary>
    public static string FromLevel(string level) => level switch
    {
        OrgLevel.Management => All,
        OrgLevel.Manager => Team,
        _ => Self,
    };

    public static bool IsValid(string? value) => value is Self or Team or All;
}

public static class LogActionType
{
    public const string Create = "create";
    public const string Review = "review";
    public const string Update = "update";
    public const string Publish = "publish";
    public const string Unpublish = "unpublish";
}
