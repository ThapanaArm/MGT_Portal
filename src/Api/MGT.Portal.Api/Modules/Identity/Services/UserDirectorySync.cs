using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Audit;

namespace MGT.Portal.Api.Modules.Identity;

public record DirectoryLevelChoice(string SourceRole, string? Level);
public record DirectoryRolePreview(string SourceRole, int Users, string? Level, bool Administrator);
public record DirectoryPreview(int Total, List<DirectoryRolePreview> Roles, string SalesOrganization, int Inactive = 0);
public record DirectorySyncRequest(List<DirectoryLevelChoice> LevelMappings, string SalesOrganization);
public record DirectorySyncIssue(string Email, string Reason);
public record DirectorySyncResult(int Total, int Created, int Updated, int Unchanged, int Skipped, List<DirectorySyncIssue> Issues, bool RequiresSignIn = false, string SalesOrganization = "", int Deleted = 0);

public sealed class UserDirectorySync(PortalDbContext db, IUserDirectorySource source, IHttpContextAccessor http)
{
    public static void ValidateSalesOrganization(string? salesOrganization)
    {
        if (salesOrganization is not ("1000" or "2000")) throw new ArgumentException("Select SalesOrganization 1000 or 2000");
    }
    public static string Normalize(string? value) => (value ?? "").Trim().ToUpperInvariant();
    public static bool IsAdministrator(string role) => Normalize(role) is "ADMIN" or "ADMINISTRATOR";
    public static string? DefaultLevel(string role) => Normalize(role) switch {
        "MANAGER" or "LEADER" or "MANAGEMENT" or "ADMIN" or "ADMINISTRATOR" => OrgLevel.Management,
        "USER" or "EMPLOYEE" => OrgLevel.Employee,
        _ => null,
    };
    public async Task<string?> SyncedLevelAsync(string role, CancellationToken ct)
    {
        var normalized = Normalize(role);
        return await db.UserSyncLevelMappings.Where(x => x.NormalizedSourceRole == normalized).Select(x => x.Level).FirstOrDefaultAsync(ct) ?? DefaultLevel(role);
    }
    public async Task<DirectoryPreview> PreviewAsync(string salesOrganization, CancellationToken ct)
    {
        ValidateSalesOrganization(salesOrganization);
        var rows = await source.ReadAsync(salesOrganization, ct);
        var mappings = await db.UserSyncLevelMappings.AsNoTracking().ToDictionaryAsync(x => x.NormalizedSourceRole, x => x.Level, ct);
        return new(rows.Count, rows.Where(row => row.IsActive).GroupBy(row => Normalize(row.UserRole)).OrderBy(group => group.Key).Select(group => new DirectoryRolePreview(
            group.First().UserRole.Trim(), group.Count(), mappings.GetValueOrDefault(group.Key) ?? DefaultLevel(group.Key), IsAdministrator(group.Key))).ToList(), salesOrganization, rows.Count(row => !row.IsActive));
    }
    public async Task<DirectorySyncResult> SyncAsync(DirectorySyncRequest request, CancellationToken ct)
    {
        ValidateSalesOrganization(request.SalesOrganization);
        if (request.LevelMappings is null || request.LevelMappings.Any(x => string.IsNullOrWhiteSpace(x.SourceRole) || x.SourceRole.Trim().Length > 100 || !OrgLevel.IsValid(x.Level))
            || request.LevelMappings.GroupBy(x => Normalize(x.SourceRole)).Any(group => group.Count() > 1))
            throw new ArgumentException("Provide one valid level mapping for each source role");
        var rows = await source.ReadAsync(request.SalesOrganization, ct);
        var storedMappings = await db.UserSyncLevelMappings.ToListAsync(ct);
        var choices = storedMappings.ToDictionary(x => x.NormalizedSourceRole, x => x.Level);
        foreach (var choice in request.LevelMappings) choices[Normalize(choice.SourceRole)] = choice.Level!;
        var users = await db.Users.Include(u => u.Role).Include(u => u.Team).Include(u => u.SaleGroup).ToListAsync(ct);
        if (users.GroupBy(user => Normalize(user.Email)).Any(group => group.Count() > 1))
            throw new InvalidOperationException("Portal contains duplicate email addresses. Resolve them before syncing.");
        var signedInId = int.TryParse(http.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var actorIdValue) ? actorIdValue : 0;
        var signedIn = users.FirstOrDefault(user => user.Id == signedInId);
        var previousSignedInHash = signedIn?.PasswordHash;
        var previousSignedInRole = signedIn?.Role.Key;
        var byEmail = users.ToDictionary(user => Normalize(user.Email));
        var teams = await db.Teams.ToListAsync(ct); var groups = await db.SaleGroups.ToListAsync(ct); var roles = await db.Roles.ToListAsync(ct);
        var duplicateEmails = rows.GroupBy(row => Normalize(row.Email)).Where(group => group.Count() > 1).Select(group => group.Key).ToHashSet();
        var issues = new List<DirectorySyncIssue>();
        var created = 0; var updated = 0; var unchanged = 0; var skipped = 0; var deleted = 0;
        void Skip(string email, string reason) { skipped++; if (issues.Count < 200) issues.Add(new(email, reason)); }
        foreach (var row in rows)
        {
            ct.ThrowIfCancellationRequested();
            var email = row.Email.Trim().ToLowerInvariant();
            if (email.Length > 254 || !MailAddress.TryCreate(email, out var address) || address.Address != email) { Skip(email, "Invalid email address"); continue; }
            if (duplicateEmails.Contains(Normalize(email))) { Skip(email, "Duplicate email in Ms_User; all duplicates were skipped"); continue; }
            if (!row.IsActive)
            {
                if (!byEmail.TryGetValue(Normalize(email), out var inactive)) { unchanged++; continue; }
                if (await db.Applications.AnyAsync(x => x.OwnerUserId == inactive.Id, ct)
                    || await db.AppReviewers.AnyAsync(x => x.UserId == inactive.Id, ct)
                    || await db.AppVotes.AnyAsync(x => x.ReviewerUserId == inactive.Id, ct)
                    || await db.AccessGrants.AnyAsync(x => x.GrantedByUserId == inactive.Id && x.UserId != inactive.Id, ct))
                {
                    Skip(email, "Cannot delete: this Portal user owns applications, reviews, or grants. Reassign these references first.");
                    continue;
                }
                db.AccessGrants.RemoveRange(await db.AccessGrants.Where(x => x.UserId == inactive.Id).ToListAsync(ct));
                db.Users.Remove(inactive);
                deleted++;
                continue;
            }
            var rawRole = row.UserRole.Trim();
            var level = choices.GetValueOrDefault(Normalize(rawRole)) ?? DefaultLevel(rawRole);
            if (rawRole.Length > 100 || !OrgLevel.IsValid(level)) { Skip(email, "Map this UserRole to a level before syncing"); continue; }
            var isSales = SalesDepartment.IsSales(row.Department);
            if (string.IsNullOrWhiteSpace(row.Department) || row.Department.Trim().Length > 200 || isSales && row.Division.Trim().Length > 200) { Skip(email, "A department is required and department/sales division names must be 200 characters or fewer"); continue; }
            if (string.IsNullOrEmpty(row.Password) || Encoding.UTF8.GetByteCount(row.Password) > 72) { Skip(email, "Password is missing or exceeds the supported 72-byte length"); continue; }
            byEmail.TryGetValue(Normalize(email), out var user);
            var isNew = user is null;
            var targetLevel = user?.Level ?? level!;
            if (targetLevel == OrgLevel.SalesManager && (!isSales || string.IsNullOrWhiteSpace(row.Division))) { Skip(email, "Sales manager level requires the Sales department and a division"); continue; }
            var team = FindTeam(teams, row.Department);
            if (team is null) { team = new() { Key = Key(row.Department), Name = row.Department.Trim() }; db.Teams.Add(team); teams.Add(team); }
            SaleGroup? group = null;
            if (isSales && !string.IsNullOrWhiteSpace(row.Division)) {
                group = groups.FirstOrDefault(x => Normalize(x.Key) == Normalize(row.Division) || Normalize(x.Name) == Normalize(row.Division));
                if (group is null) { group = new() { Key = row.Division.Trim().Length <= 50 ? row.Division.Trim() : Key(row.Division), Name = row.Division.Trim() }; db.SaleGroups.Add(group); groups.Add(group); }
            }
            if (user is null) { user = new() { Email = email }; db.Users.Add(user); byEmail.Add(Normalize(email), user); }
            var passwordChanged = !PasswordMatches(row.Password!, user.PasswordHash);
            var targetRole = user.Role;
            if (isNew || user.Role.Key == "admin" || IsAdministrator(rawRole)) {
                var roleKey = IsAdministrator(rawRole) ? "admin" : "employee";
                targetRole = roles.FirstOrDefault(x => x.Key == roleKey);
                if (targetRole is null) { targetRole = new() { Key = roleKey, Name = roleKey == "admin" ? "Administrator" : "Employee", ScopesCsv = roleKey == "admin" ? "*" : "" }; db.Roles.Add(targetRole); roles.Add(targetRole); }
            }
            var changed = passwordChanged || !ReferenceEquals(user.Team, team) || !ReferenceEquals(user.SaleGroup, group)
                || user.Level != targetLevel || !ReferenceEquals(user.Role, targetRole);
            user.Team = team; user.SaleGroup = group; user.Level = targetLevel;
            user.Role = targetRole;
            if (passwordChanged) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(row.Password!);
            if (isNew) created++; else if (changed) updated++; else unchanged++;
            // Existing DisplayName, Level and individual API permissions remain managed in Portal.
        }
        foreach (var choice in request.LevelMappings) {
            var normalized = Normalize(choice.SourceRole);
            var mapping = storedMappings.FirstOrDefault(x => x.NormalizedSourceRole == normalized);
            if (mapping is null) { mapping = new() { SourceRole = choice.SourceRole.Trim(), NormalizedSourceRole = normalized }; db.UserSyncLevelMappings.Add(mapping); }
            mapping.Level = choice.Level!;
        }
        var result = new DirectorySyncResult(rows.Count, created, updated, unchanged, skipped, issues, SalesOrganization: request.SalesOrganization, Deleted: deleted);
        var actor = http.HttpContext?.User;
        db.AuditLogs.Add(new AuditLog {
            BatchId = Guid.NewGuid(), OccurredAt = DateTime.UtcNow, EntityType = "UserDirectory", EventName = "users.sync.completed", Action = "Sync",
            ActorUserId = int.TryParse(actor?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var actorId) ? actorId : null,
            Actor = actor?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "system",
            AfterJson = System.Text.Json.JsonSerializer.Serialize(new { Source = "MGT_Datawarehouse.dbo.Ms_User", result.SalesOrganization, result.Total, result.Created, result.Updated, result.Unchanged, result.Skipped, result.Deleted }),
            RequestMethod = http.HttpContext?.Request.Method, RequestPath = http.HttpContext?.Request.Path.Value, CorrelationId = http.HttpContext?.TraceIdentifier,
        });
        await db.SaveChangesAsync(ct);
        return result with { RequiresSignIn = signedIn is not null &&
            (db.Entry(signedIn).State == EntityState.Detached || signedIn.PasswordHash != previousSignedInHash || signedIn.Role.Key != previousSignedInRole) };
    }
    private static Team? FindTeam(List<Team> teams, string name) => teams.FirstOrDefault(x => Normalize(x.Key) == Normalize(name) || Normalize(x.Name) == Normalize(name));
    private static string Key(string name) => "dw-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(name))))[..20].ToLowerInvariant();
    private static bool PasswordMatches(string password, string hash) { if (string.IsNullOrEmpty(hash)) return false; try { return BCrypt.Net.BCrypt.Verify(password, hash); } catch { return false; } }
}

