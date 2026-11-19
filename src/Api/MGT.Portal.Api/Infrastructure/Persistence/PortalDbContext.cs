using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Catalog;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Modules.Audit;
using MGT.Portal.Api.Modules.Scheduling;

namespace MGT.Portal.Api.Infrastructure.Persistence;

/// <summary>
/// DbContext เดียวของ Portal (ขั้นที่ 1 ของ modular monolith)
/// การตั้งค่าตาราง/ความสัมพันธ์ของแต่ละ module อยู่ใน Modules/*/Persistence/*Configuration.cs
/// และถูกโหลดอัตโนมัติด้วย ApplyConfigurationsFromAssembly
/// </summary>
public class PortalDbContext(DbContextOptions<PortalDbContext> options, IHttpContextAccessor? httpContext = null) : DbContext(options)
{
    // Identity
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<SaleGroup> SaleGroups => Set<SaleGroup>();
    public DbSet<UserPlatformId> UserPlatformIds => Set<UserPlatformId>();
    public DbSet<UserToken> UserTokens => Set<UserToken>();
    public DbSet<DisplayNameOption> DisplayNameOptions => Set<DisplayNameOption>();
    public DbSet<UserSyncLevelMapping> UserSyncLevelMappings => Set<UserSyncLevelMapping>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Catalog
    public DbSet<ApiCategory> ApiCategories => Set<ApiCategory>();
    public DbSet<ApiEndpoint> ApiEndpoints => Set<ApiEndpoint>();

    // Apps (รวมการรีวิวโดยคณะกรรมการ)
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<AppScreenshot> AppScreenshots => Set<AppScreenshot>();
    public DbSet<AppCredential> AppCredentials => Set<AppCredential>();
    public DbSet<AppLogEntry> AppLogEntries => Set<AppLogEntry>();
    public DbSet<AppReviewer> AppReviewers => Set<AppReviewer>();
    public DbSet<CommitteeMember> CommitteeMembers => Set<CommitteeMember>();
    public DbSet<AppVote> AppVotes => Set<AppVote>();
    public DbSet<AppCodeReview> AppCodeReviews => Set<AppCodeReview>();

    // Scheduling (ปฏิทิน IT)
    public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();

    // Access
    public DbSet<AccessGrant> AccessGrants => Set<AccessGrant>();
    public DbSet<UserApiPermission> UserApiPermissions => Set<UserApiPermission>();
    public DbSet<ApiToken> ApiTokens => Set<ApiToken>();

    // Gateway (audit log + Idempotency-Key ของคำขอเขียน)
    public DbSet<GatewayWriteRecord> GatewayWriteRecords => Set<GatewayWriteRecord>();

    protected override void OnModelCreating(ModelBuilder b)
        => b.ApplyConfigurationsFromAssembly(typeof(PortalDbContext).Assembly);

    private List<AuditLog> PrepareAudit()
    {
        if (ChangeTracker.Entries<AuditLog>().Any(e => e.State is EntityState.Modified or EntityState.Deleted))
            throw new InvalidOperationException("Audit records are append-only and cannot be modified or deleted.");
        // Design-time contexts and existing isolated domain tests have no request accessor.
        if (httpContext is null) return [];
        var logs = AuditCapture.Capture(this, httpContext.HttpContext);
        AuditLogs.AddRange(logs);
        return logs;
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        var logs = PrepareAudit();
        try { return base.SaveChanges(acceptAllChangesOnSuccess); }
        catch { foreach (var log in logs) Entry(log).State = EntityState.Detached; throw; }
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        var logs = PrepareAudit();
        try { return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken); }
        catch { foreach (var log in logs) Entry(log).State = EntityState.Detached; throw; }
    }
}
