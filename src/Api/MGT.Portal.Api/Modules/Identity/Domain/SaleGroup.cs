namespace MGT.Portal.Api.Modules.Identity;

/// <summary>
/// กลุ่มพนักงานขาย — ผู้ใช้ระดับ Sales Manager เห็นข้อมูลของทุกคนใน Sale group ตัวเอง
/// IT ใส่ข้อมูลเองด้วย SQL (ตาราง SaleGroups และคอลัมน์ Users.SaleGroupId)
/// </summary>
public class SaleGroup
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";

    public ICollection<User> Members { get; set; } = new List<User>();
}
