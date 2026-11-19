using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// คณะกรรมการรีวิวชุดเดียวของทั้ง Portal (AppTier.CommitteeSize = 5 คน) — IT ตั้งที่ PUT api/committee/members
/// ทุกคำขอใช้ชุดนี้: ตอนส่งรีวิว ApplicationWorkflow.SyncReviewersAsync คัดลอกรายชื่อลง AppReviewers ของคำขอนั้น
/// (ถ้าผู้ขอเป็นกรรมการเอง จะถูกตัดออก คำขอนั้นใช้กรรมการ 4 คน) และเมื่อ IT เปลี่ยนชุด คำขอที่รอรีวิวอยู่ถูกเปลี่ยนตามทันที
/// </summary>
public class CommitteeMember
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime AddedAt { get; set; }
    /// <summary>อีเมลของ IT ที่เพิ่มคนนี้เข้าคณะกรรมการ</summary>
    public string AddedBy { get; set; } = "";
}
