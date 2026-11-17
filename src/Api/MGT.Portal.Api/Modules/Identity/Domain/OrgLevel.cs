namespace MGT.Portal.Api.Modules.Identity;

/// <summary>ระดับในองค์กร — ใช้กำหนดขอบเขตการเห็นข้อมูลเริ่มต้นของผู้ใช้</summary>
public static class OrgLevel
{
    public const string Employee = "employee";          // Sales และพนักงานทั่วไป: เห็นเฉพาะข้อมูลของตัวเอง
    public const string SalesManager = "sales_manager"; // หัวหน้า Sale group: เห็นข้อมูลทุกคนใน Sale group ตัวเอง
    public const string Manager = "manager";            // ผู้จัดการแผนก: เห็นข้อมูลทุกคนในแผนก (Team) ตัวเอง
    public const string Management = "management";      // ผู้บริหาร (CEO / CFO / CMO): เห็นข้อมูลทั้งหมด

    public static bool IsValid(string? level) => level is Employee or SalesManager or Manager or Management;
}

/// <summary>
/// ขอบเขตข้อมูลระดับแถว (row-level) — คนละชั้นกับ Scope ซึ่งคุมว่าเรียก endpoint ไหนได้
/// Scope = "เรียก API นี้ได้ไหม" / DataScope = "เห็นข้อมูลของใครได้บ้าง"
/// </summary>
public static class DataScope
{
    public const string Self = "self";
    public const string Team = "team";
    public const string SaleGroup = "salegroup";
    public const string All = "all";

    /// <summary>ขอบเขตเริ่มต้นตามระดับองค์กร — ไม่รู้จักระดับไหน ถือว่าแคบสุดไว้ก่อน (deny by default)</summary>
    public static string FromLevel(string level) => level switch
    {
        OrgLevel.Management => All,
        OrgLevel.Manager => Team,
        OrgLevel.SalesManager => SaleGroup,
        _ => Self,
    };

    public static bool IsValid(string? value) => value is Self or Team or SaleGroup or All;
}
