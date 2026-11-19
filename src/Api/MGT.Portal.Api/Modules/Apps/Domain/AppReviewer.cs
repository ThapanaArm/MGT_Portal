using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// กรรมการของ App หนึ่ง — คัดลอกจากคณะกรรมการชุดเดียว (CommitteeMember) ตอนส่งรีวิว ผ่าน ApplicationWorkflow.SyncReviewersAsync
/// เก็บรายชื่อของแต่ละคำขอไว้เป็นประวัติ (คำขอที่จบไปแล้วยังเห็นว่าใครเป็นกรรมการตอนนั้น)
/// </summary>
public class AppReviewer
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime AssignedAt { get; set; }
    /// <summary>อีเมลของผู้ที่เลือกกรรมการคนนี้</summary>
    public string AssignedBy { get; set; } = "";
}
