using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Models;

namespace MGT.Portal.Api.Data;

public class PortalDbContext(DbContextOptions<PortalDbContext> options) : DbContext(options)
{
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ApiCategory> ApiCategories => Set<ApiCategory>();
    public DbSet<ApiEndpoint> ApiEndpoints => Set<ApiEndpoint>();
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<AppScreenshot> AppScreenshots => Set<AppScreenshot>();
    public DbSet<AppCredential> AppCredentials => Set<AppCredential>();
    public DbSet<CommitteeMember> CommitteeMembers => Set<CommitteeMember>();
    public DbSet<AppVote> AppVotes => Set<AppVote>();
    public DbSet<AppLogEntry> AppLogEntries => Set<AppLogEntry>();
    public DbSet<ApiToken> ApiTokens => Set<ApiToken>();
    public DbSet<AccessGrant> AccessGrants => Set<AccessGrant>();
    public DbSet<Team> Teams => Set<Team>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Role>().HasIndex(r => r.Key).IsUnique();
        b.Entity<User>().HasIndex(u => u.Email).IsUnique();
        b.Entity<ApiCategory>().HasIndex(c => c.Key).IsUnique();

        b.Entity<ApiEndpoint>()
            .HasOne(e => e.Category)
            .WithMany(c => c.Endpoints)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Application>()
            .HasOne(a => a.Owner)
            .WithMany()
            .HasForeignKey(a => a.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<AppScreenshot>()
            .HasOne(s => s.Application)
            .WithMany(a => a.Screenshots)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<AppCredential>()
            .HasOne(c => c.Application)
            .WithMany(a => a.Credentials)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<AppVote>()
            .HasOne(v => v.Application)
            .WithMany(a => a.Votes)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<AppVote>()
            .HasOne(v => v.CommitteeMember)
            .WithMany(m => m.Votes)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<AppLogEntry>()
            .HasOne(l => l.Application)
            .WithMany(a => a.Log)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<ApiToken>()
            .HasOne(t => t.User)
            .WithMany()
            .OnDelete(DeleteBehavior.Cascade);

        // Prevent a committee member from voting twice within the same review cycle.
        b.Entity<AppVote>().HasIndex(v => new { v.ApplicationId, v.CommitteeMemberId, v.ReviewCycle }).IsUnique();

        b.Entity<AccessGrant>()
            .HasOne(g => g.User)
            .WithMany()
            .HasForeignKey(g => g.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<AccessGrant>()
            .HasOne(g => g.GrantedByUser)
            .WithMany()
            .HasForeignKey(g => g.GrantedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<AccessGrant>()
            .HasOne(g => g.Category)
            .WithMany()
            .HasForeignKey(g => g.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<AccessGrant>().HasIndex(g => new { g.UserId, g.Revoked });

        b.Entity<Team>().HasIndex(t => t.Key).IsUnique();

        // ผู้ใช้ที่ยังไม่ถูกจัดทีมได้ (TeamId = null) และการลบทีมต้องไม่ลบผู้ใช้ตาม
        b.Entity<User>()
            .HasOne(u => u.Team)
            .WithMany(t => t.Members)
            .HasForeignKey(u => u.TeamId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
