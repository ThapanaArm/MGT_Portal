using System.Net.Mail;
using System.Text.Json;

namespace MGT.Portal.Api.Modules.Apps;

public record DeveloperPreparation(string Email, bool GitReady = false, bool ApiReady = false);
public record DevelopmentRequest(string Stage = "draft", string TargetTier = "tier2",
    DeveloperPreparation[]? Developers = null, string? Branch = null, string? Commit = null,
    string? DeployedBy = null, DateTime? DeployedAt = null, string? LiveBy = null, DateTime? LiveAt = null,
    string? Version = null, string? ChangeSummary = null, int? ParentApplicationId = null,
    int? PendingUpdateId = null, ReleaseRecord[]? Releases = null,
    PendingDeveloperChange[]? PendingDevelopers = null);
/// <summary>คำขอเพิ่ม/ลบคน dev หลังส่งคำขอแล้ว — รอ IT อนุมัติ (IT เปิด/ปิดสิทธิ์ Git ก่อนกดอนุมัติ)</summary>
public record PendingDeveloperChange(string Email, string Action, string RequestedBy, DateTime RequestedAt);
public record DeveloperChangeRequest(string Email, string Action);
public record DeveloperChangeDecision(string Email, bool Approve);
public record ReleaseRecord(int RequestId, string? Version, string? ChangeSummary, string? Branch, string? Commit, string? DeployedBy, DateTime? DeployedAt, string? LiveBy, DateTime? LiveAt);
public record SystemUpdateRequest(string Version, string ChangeSummary, string Branch, string Commit);
public record DevelopmentAccessRequest(string TargetTier, string[] Emails, bool Submit = false);
public record PreparationRequest(string Github, DeveloperPreparation[] Developers, bool Complete = false);
/// <summary>ผู้ขอกดขอ deploy — ไม่ต้องใส่ Git (IT ใส่เองที่ deployment-source) ถ้าส่งมาจะถูกตรวจรูปแบบ</summary>
public record DeploymentRequest(string? Branch = null, string? Commit = null);
/// <summary>IT ใส่ branch และ commit ที่จะ deploy</summary>
public record DeploymentSourceRequest(string Branch, string Commit);
/// <summary>ผู้ขอเพิ่ม/แก้รูป screenshot ระหว่างพัฒนา (ก่อนกดขอ deploy) — ส่งรูปทั้งชุด (data URL)</summary>
public record ScreenshotsRequest(List<string>? Screenshots);
public record DeploymentStatusRequest(string Stage, DateTime? ExpectedUpdatedAt = null);

public static class DevelopmentProcess
{
    public static DevelopmentRequest? Read(Application app)
    {
        if (app.DevelopmentJson is null) return null; // Existing reviews retain their original history.
        var request = JsonSerializer.Deserialize<DevelopmentRequest>(app.DevelopmentJson)!;
        if (app.Status == "suspended") return request with { Stage = "suspended" };
        if (app.Status == "rejected") return request with { Stage = "rejected" };
        if (app.Status == "active") return request with { Stage = request.Stage is "deployed" or "live" ? request.Stage : "awaiting-deployment" };
        // ส่งขอ deploy แล้วแต่ถูกขอให้แก้ (IT หรือกรรมการ) → รอผู้ขอแก้แล้วส่งใหม่
        if (request.Stage == "review" && app.Status == "draft") return request with { Stage = "changes" };
        return request;
    }
    /// <summary>ค่าที่เก็บจริงใน DevelopmentJson (ไม่แปลง Stage ตามสถานะ App) — ใช้ตอนจะแก้แล้วเขียนกลับ</summary>
    public static DevelopmentRequest? ReadStored(Application app) =>
        app.DevelopmentJson is null ? null : JsonSerializer.Deserialize<DevelopmentRequest>(app.DevelopmentJson);

    /// <summary>ผู้ขอกำลังพัฒนา (ครั้งแรก หรือแก้ตามที่ถูกขอ) — ส่งขอ deploy ได้ และใช้ Sandbox credential ได้</summary>
    public static bool IsDeveloping(string? stage) => stage is "development" or "changes";

    public static void Write(Application app, DevelopmentRequest request) =>
        app.DevelopmentJson = JsonSerializer.Serialize(request);

    public static bool ValidEmail(string email) => email.Length <= 254 &&
        MailAddress.TryCreate(email, out var address) && address.Address == email &&
        email.EndsWith("@megachem.co.th", StringComparison.OrdinalIgnoreCase);

    public static bool ValidRepository(string url) => url.Length <= 2048 &&
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
        !string.IsNullOrWhiteSpace(uri.Host) && string.IsNullOrEmpty(uri.UserInfo);
}
