using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Catalog;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Audit;

public static class AuditCapture
{
    private static readonly HashSet<string> SecretFields = new(StringComparer.OrdinalIgnoreCase)
        { "PasswordHash", "TokenHash", "TokenId", "TokenSecret", "Value", "Prefix", "ResponseJson", "RequestHash", "IdempotencyKey", "ImageData", "Image", "ReqBody", "RespExample", "ParamsJson", "RespFieldsJson" };
    private static readonly HashSet<string> SecretJsonNames = new(StringComparer.OrdinalIgnoreCase)
        { "password", "passwordHash", "token", "tokenId", "tokenSecret", "tokenHash", "secret", "apiKey", "authorization", "accessToken", "refreshToken", "clientSecret" };
    private static bool Supported(object entity) => entity is Application or AppScreenshot or AppCredential or AppReviewer or AppVote or AppCodeReview
        or User or Role or Team or SaleGroup or UserPlatformId or UserToken or ApiToken or AccessGrant or UserApiPermission or ApiCategory or ApiEndpoint or GatewayWriteRecord or DisplayNameOption or UserSyncLevelMapping;

    public static List<AuditLog> Capture(DbContext db, HttpContext? http)
    {
        db.ChangeTracker.DetectChanges();
        if (db.ChangeTracker.Entries<AuditLog>().Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Audit records are append-only and cannot be modified or deleted.");
        var entries = db.ChangeTracker.Entries().Where(e => Supported(e.Entity) && e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList();
        var logs = new List<AuditLog>();
        var batch = Guid.NewGuid();
        var actorId = int.TryParse(http?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (int?)null;
        if (actorId is null && http?.Items[GatewayUserPermissionFilter.UserIdItem] is int gatewayId) actorId = gatewayId;
        var actor = http?.User.FindFirstValue(ClaimTypes.Email) ?? http?.User.Identity?.Name ?? (actorId is null ? "system" : $"user:{actorId}");
        foreach (var entry in entries)
        {
            var changed = entry.Properties.Where(p => !p.IsTemporary && p.Metadata.Name is not ("LastUsedAt" or "UpdatedAt" or "LastSyncedAt") && !SecretFields.Contains(p.Metadata.Name)
                && (entry.State != EntityState.Modified || p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))).ToList();
            var secretChanged = entry.Properties.Where(p => SecretFields.Contains(p.Metadata.Name)
                && (entry.State != EntityState.Modified || p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))).Select(p => p.Metadata.Name).ToList();
            if (changed.Count == 0 && secretChanged.Count == 0) continue;
            var before = entry.State == EntityState.Added ? null : Snapshot(changed, original: true);
            var after = entry.State == EntityState.Deleted ? null : Snapshot(changed, original: false);
            // Sensitive fields are never copied; names only indicate that a credential/image changed.
            if (secretChanged.Count > 0) { if (before is not null) before["RedactedFields"] = secretChanged; if (after is not null) after["RedactedFields"] = secretChanged; }
            var app = entry.Entity as Application;
            var appProperty = entry.Metadata.FindProperty("ApplicationId");
            int? appId = app?.Id;
            if (app is not null && entry.Property("Id").IsTemporary) appId = null;
            if (appProperty is not null && !entry.Property("ApplicationId").IsTemporary) appId = entry.Property("ApplicationId").CurrentValue as int?;
            if (app is null && entry.Metadata.FindNavigation("Application") is not null) app = entry.Reference("Application").CurrentValue as Application;
            if (app is null && appId is > 0) app = db.ChangeTracker.Entries<Application>().Select(e => e.Entity).FirstOrDefault(a => a.Id == appId);
            var keyProperties = entry.Metadata.FindPrimaryKey()?.Properties.Select(p => entry.Property(p.Name)).Where(p => !p.IsTemporary).ToList() ?? [];
            var identity = keyProperties.Count == 0 ? null : string.Join("/", keyProperties.Select(p => p.CurrentValue?.ToString()));
            var key = keyProperties.ToDictionary(p => p.Metadata.Name, p => p.CurrentValue);
            foreach (var name in new[] { "UserId", "ReviewerUserId", "ResourceKey", "CategoryId", "ReviewCycle", "Platform", "ExternalId", "Email", "Key" })
                if (entry.Metadata.FindProperty(name) is not null && !entry.Property(name).IsTemporary) key[name] = entry.Property(name).CurrentValue;
            var previousStage = entry.Entity is Application && entry.State != EntityState.Added ? Stage(entry.OriginalValues["DevelopmentJson"] as string, entry.OriginalValues["Status"] as string) : null;
            var newStage = entry.Entity is Application && entry.State != EntityState.Deleted ? Stage(entry.CurrentValues["DevelopmentJson"] as string, entry.CurrentValues["Status"] as string) : null;
            logs.Add(new AuditLog {
                BatchId = batch, OccurredAt = DateTime.UtcNow, ActorUserId = actorId, Actor = Trim(actor, 320) ?? "system",
                Application = app is not null && entry.State != EntityState.Deleted ? app : null,
                ApplicationId = appId is > 0 ? appId : null, ApplicationName = Trim(app?.Name ?? (entry.Entity as GatewayWriteRecord)?.ApplicationName, 500),
                EntityType = entry.Metadata.ClrType.Name, EntityId = Trim(identity, 320), EntityKeyJson = JsonSerializer.Serialize(key),
                EventName = EventName(entry, previousStage, newStage), Action = entry.State.ToString(),
                Result = entry.Entity is GatewayWriteRecord write ? entry.State == EntityState.Deleted ? "Failed" : write.StatusCode == 0 ? "Pending" : write.StatusCode is >= 200 and < 300 ? "Succeeded" : "Failed" : "Succeeded",
                PreviousStage = previousStage, NewStage = newStage,
                ChangedFieldsJson = JsonSerializer.Serialize(changed.Select(p => p.Metadata.Name).Concat(secretChanged).Order()),
                BeforeJson = before is null ? null : JsonSerializer.Serialize(before), AfterJson = after is null ? null : JsonSerializer.Serialize(after),
                RequestMethod = http?.Request.Method, RequestPath = Trim(http?.Request.Path.Value, 2048), CorrelationId = Trim(http?.TraceIdentifier, 128),
            });
        }
        return logs;
    }

    private static Dictionary<string, object?> Snapshot(List<PropertyEntry> properties, bool original) => properties.ToDictionary(p => p.Metadata.Name,
        p => Sanitize(p.Metadata.Name, original ? p.OriginalValue : p.CurrentValue));
    private static object? Sanitize(string name, object? value)
    {
        if (value is not string text) return value;
        if (name == "Github" || name == "Links") return "[link omitted]";
        if (name == "DevelopmentJson")
        {
            try {
                var node = JsonNode.Parse(text); Redact(node); return node;
            } catch (JsonException) { return "[unparseable content omitted]"; }
        }
        return text;
    }
    private static void Redact(JsonNode? node)
    {
        if (node is JsonObject obj) foreach (var key in obj.Select(p => p.Key).ToList()) {
            if (SecretJsonNames.Contains(key)) obj[key] = "[redacted]"; else Redact(obj[key]);
        }
        else if (node is JsonArray array) foreach (var child in array) Redact(child);
    }
    private static string? Stage(string? json, string? status)
    { try { return json is null ? null : DevelopmentProcess.Read(new Application { DevelopmentJson = json, Status = status ?? "draft" })?.Stage; } catch (JsonException) { return null; } }
    private static string EventName(EntityEntry entry, string? previousStage, string? newStage)
    {
        var action = entry.State == EntityState.Added ? "created" : entry.State == EntityState.Deleted ? "deleted" : "updated";
        return entry.Entity switch {
            Application when action == "created" => "application.created",
            Application when previousStage != newStage => $"application.stage.{newStage ?? "cleared"}",
            Application => $"application.{action}",
            AppReviewer => action == "deleted" ? "reviewer.removed" : "reviewer.assigned",
            AppVote vote => action == "deleted" ? "committee.vote_removed" : $"committee.{(vote.Approved ? "approved" : "changes_requested")}",
            AppCodeReview review => action == "deleted" ? "code_review.withdrawn" : $"code_review.{(review.Approved ? "approved" : "changes_requested")}",
            AppCredential => $"credential.{action}", UserApiPermission => $"api_permission.{action}",
            AccessGrant grant => grant.Revoked ? "access_grant.revoked" : $"access_grant.{action}",
            UserToken token => token.RevokedAt is not null ? "user_token.revoked" : $"user_token.{action}",
            GatewayWriteRecord write => action == "deleted" ? "gateway.write.abandoned" : write.StatusCode == 0 ? "gateway.write.started" : write.StatusCode is >= 200 and < 300 ? "gateway.write.succeeded" : "gateway.write.failed",
            _ => $"{entry.Metadata.ClrType.Name.ToLowerInvariant()}.{action}"
        };
    }
    private static string? Trim(string? value, int max) => value?.Length > max ? value[..max] : value;
}
