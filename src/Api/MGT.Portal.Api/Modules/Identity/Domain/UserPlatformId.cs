namespace MGT.Portal.Api.Modules.Identity;

/// <summary>
/// รหัสพนักงานของผู้ใช้ในระบบภายนอก เช่น Platform = "sap", ExternalId = "50001234"
/// Gateway ใช้แปลงผู้ใช้ที่มองเห็นได้ → รหัสเจ้าของข้อมูลในแต่ละระบบ แล้วกรองข้อมูลด้วยรหัสนั้น
/// IT ใส่ข้อมูลเองด้วย SQL (ตาราง UserPlatformIds)
/// </summary>
public class UserPlatformId
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>ชื่อระบบตัวเล็ก เช่น sap, zoho</summary>
    public string Platform { get; set; } = "";
    public string ExternalId { get; set; } = "";
}
