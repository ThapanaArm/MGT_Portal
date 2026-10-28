using System.Net.Mail;
using System.Text.Json;

namespace MGT.Portal.Api.Modules.Apps;

public record DeveloperPreparation(string Email, bool GitReady = false, bool ApiReady = false);
public record DevelopmentRequest(string Stage = "draft", string TargetTier = "tier2",
    DeveloperPreparation[]? Developers = null, string? Branch = null, string? Commit = null);
public record DevelopmentAccessRequest(string TargetTier, string[] Emails, bool Submit = false);
public record PreparationRequest(string Github, DeveloperPreparation[] Developers, bool Complete = false);
public record DeploymentRequest(string Branch, string Commit);

public static class DevelopmentProcess
{
    public static DevelopmentRequest? Read(Application app)
    {
        if (app.DevelopmentJson is null) return null; // Existing reviews retain their original history.
        var request = JsonSerializer.Deserialize<DevelopmentRequest>(app.DevelopmentJson)!;
        if (app.Status is "active" or "suspended") return request with { Stage = "approved" };
        if (request.Stage == "review" && app.Status == "draft") return request with { Stage = "development" };
        return request;
    }
    public static void Write(Application app, DevelopmentRequest request) =>
        app.DevelopmentJson = JsonSerializer.Serialize(request);

    public static bool ValidEmail(string email) => email.Length <= 254 &&
        MailAddress.TryCreate(email, out var address) && address.Address == email &&
        email.EndsWith("@megachem.co.th", StringComparison.OrdinalIgnoreCase);

    public static bool ValidRepository(string url) => url.Length <= 2048 &&
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" &&
        !string.IsNullOrWhiteSpace(uri.Host) && string.IsNullOrEmpty(uri.UserInfo);
}
