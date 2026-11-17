using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// กรรมการของ App หนึ่ง — แต่ละ App มีกรรมการของตัวเอง (Application.CommitteeSize คน: ใหม่ 5, คำขอเดิม 3) (ไม่ใช้ชุดเดียวกันทุก App)
/// IT เลือกและเปลี่ยนได้ทุกเมื่อผ่าน ApplicationWorkflow.SetReviewersAsync
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
