namespace MGT.Portal.Api.Modules.Identity;

/// <summary>
/// User token — ผูกกับผู้ใช้คนเดียว แอปส่งมาคู่กับ Token ID/Secret ของแอป (header X-User-Token)
/// เพื่อให้ Gateway กรองข้อมูลตามสิทธิ์ของคนที่ใช้แอปอยู่ — เก็บเฉพาะ hash, เห็นค่าจริงครั้งเดียวตอนสร้าง
/// </summary>
public class UserToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Name { get; set; } = "";
    /// <summary>ตัวอักษรต้นของ token ไว้แสดงให้จำได้ (ไม่ใช่ความลับ)</summary>
    public string Prefix { get; set; } = "";
    /// <summary>SHA-256 ของ token (hex)</summary>
    public string TokenHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}
