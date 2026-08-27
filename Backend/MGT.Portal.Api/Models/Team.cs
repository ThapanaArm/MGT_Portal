namespace MGT.Portal.Api.Models;

/// <summary>
/// หน่วยงาน/ทีมที่ใช้เป็นขอบเขตข้อมูลสำหรับผู้ใช้ระดับ Manager.
/// แยกจาก Role โดยตั้งใจ — Role คุมว่า "เรียก API ไหนได้" ส่วน Team คุมว่า "เห็นข้อมูลของใครได้"
/// องค์กรหนึ่งแผนกอาจมีหลายทีมได้ จึงไม่ผูกติดกับ Role แบบหนึ่งต่อหนึ่ง
/// </summary>
public class Team
{
    public int Id { get; set; }
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";

    public ICollection<User> Members { get; set; } = new List<User>();
}
