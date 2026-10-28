using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Catalog;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Infrastructure.Persistence;

/// <summary>
/// DbContext เดียวของ Portal (ขั้นที่ 1 ของ modular monolith)
/// การตั้งค่าตาราง/ความสัมพันธ์ของแต่ละ module อยู่ใน Modules/*/Persistence/*Configuration.cs
/// และถูกโหลดอัตโนมัติด้วย ApplyConfigurationsFromAssembly
/// </summary>
public class PortalDbContext(DbContextOptions<PortalDbContext> options) : DbContext(options)
{
    // Identity
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Team> Teams => Set<Team>();

    // Catalog
    public DbSet<ApiCategory> ApiCategories => Set<ApiCategory>();
    public DbSet<ApiEndpoint> ApiEndpoints => Set<ApiEndpoint>();

    // Apps (รวมการรีวิวโดยคณะกรรมการ)
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<AppScreenshot> AppScreenshots => Set<AppScreenshot>();
    public DbSet<AppCredential> AppCredentials => Set<AppCredential>();
    public DbSet<AppLogEntry> AppLogEntries => Set<AppLogEntry>();
    public DbSet<CommitteeMember> CommitteeMembers => Set<CommitteeMember>();
    public DbSet<AppVote> AppVotes => Set<AppVote>();
    public DbSet<AppCodeReview> AppCodeReviews => Set<AppCodeReview>();

    // Access
    public DbSet<AccessGrant> AccessGrants => Set<AccessGrant>();
    public DbSet<ApiToken> ApiTokens => Set<ApiToken>();

    // Gateway (audit log + Idempotency-Key ของคำขอเขียน)
    public DbSet<GatewayWriteRecord> GatewayWriteRecords => Set<GatewayWriteRecord>();

    protected override void OnModelCreating(ModelBuilder b)
        => b.ApplyConfigurationsFromAssembly(typeof(PortalDbContext).Assembly);
}
