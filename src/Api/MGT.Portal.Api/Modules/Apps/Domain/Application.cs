using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

public class Application
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Subdomain { get; set; } = "";
    public string Github { get; set; } = "";

    /// <summary>Comma-separated ApiCategory keys this app consumes (e.g. "sales,inventory").</summary>
    public string ProductsCsv { get; set; } = "";

    public string Status { get; set; } = AppStatus.Draft;
    /// <summary>Tier ที่ได้รับอนุมัติแล้ว (tier1 / tier2 / tier3) — ดู AppTier</summary>
    public string Type { get; set; } = AppTier.Tier1;
    /// <summary>Tier ที่ขอในรอบรีวิวปัจจุบัน (null เมื่อไม่ได้อยู่ระหว่างรีวิว)</summary>
    public string? ReviewTarget { get; set; }
    public int ReviewCycle { get; set; } = 0;

    public string? Image { get; set; } // data URL or file path
    public string Icon { get; set; } = "📦";

    /// <summary>ใครใช้ App ได้ (self / department / company) — ดู AppAudience</summary>
    public string Audience { get; set; } = AppAudience.Self;

    public int OwnerUserId { get; set; }
    public User Owner { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<AppScreenshot> Screenshots { get; set; } = new List<AppScreenshot>();
    public ICollection<AppCredential> Credentials { get; set; } = new List<AppCredential>();
    public ICollection<AppVote> Votes { get; set; } = new List<AppVote>();
    public ICollection<AppLogEntry> Log { get; set; } = new List<AppLogEntry>();
    public ICollection<AppCodeReview> CodeReviews { get; set; } = new List<AppCodeReview>();
}

public class AppScreenshot
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public string ImageData { get; set; } = ""; // data URL
    public int SortOrder { get; set; }
}

public class AppCredential
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public string Env { get; set; } = CredEnv.Sandbox;
    public string TokenId { get; set; } = "";
    public string TokenSecret { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public bool Revoked { get; set; }
}

public class AppVote
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public int CommitteeMemberId { get; set; }
    public CommitteeMember CommitteeMember { get; set; } = null!;
    /// <summary>Which review cycle this vote belongs to — cleared/incremented each time the app is resubmitted.</summary>
    public int ReviewCycle { get; set; }
    public bool Approved { get; set; }
}

public class AppLogEntry
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public string ActionType { get; set; } = LogActionType.Create;
    public DateTime OccurredAt { get; set; }
    public string Actor { get; set; } = "";
    public string? Note { get; set; }
}

/// <summary>ผล IT code review ของ App Tier 2/3 — หนึ่งรายการต่อรอบรีวิว (แยกจากการโหวตของกรรมการ)</summary>
public class AppCodeReview
{
    public int Id { get; set; }
    public int ApplicationId { get; set; }
    public Application Application { get; set; } = null!;
    public int ReviewCycle { get; set; }
    public bool Approved { get; set; }
    public string ReviewerEmail { get; set; } = "";
    public string? Note { get; set; }
    public DateTime ReviewedAt { get; set; }
}
