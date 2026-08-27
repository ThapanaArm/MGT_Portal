using System.ComponentModel.DataAnnotations.Schema;

namespace MGT.Portal.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";

    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;

    /// <summary>ทีมที่สังกัด — ใช้เป็นขอบเขตข้อมูลเมื่อผู้ใช้อยู่ระดับ Manager</summary>
    public int? TeamId { get; set; }
    public Team? Team { get; set; }

    /// <summary>ระดับในองค์กร (employee / manager / management)</summary>
    public string Level { get; set; } = OrgLevel.Employee;

    /// <summary>
    /// ขอบเขตข้อมูลเฉพาะราย — ตั้งไว้เมื่อบางตำแหน่งต้องเห็นกว้างกว่าระดับปกติ
    /// (เช่น Internal Audit ที่เป็น Employee แต่ต้องเห็นทั้งหมด) ค่า null = ใช้ตามระดับ
    /// </summary>
    public string? DataScopeOverride { get; set; }

    /// <summary>ขอบเขตที่มีผลจริง — override ชนะระดับองค์กรเสมอ</summary>
    [NotMapped]
    public string EffectiveDataScope =>
        DataScope.IsValid(DataScopeOverride) ? DataScopeOverride! : DataScope.FromLevel(Level);
}
