using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Apps;

internal sealed class AppReviewerConfiguration : IEntityTypeConfiguration<AppReviewer>
{
    public void Configure(EntityTypeBuilder<AppReviewer> b)
    {
        b.HasOne(r => r.Application)
            .WithMany(a => a.Reviewers)
            .HasForeignKey(r => r.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Restrict);
        b.Property(r => r.AssignedBy).HasMaxLength(256);

        // คนหนึ่งเป็นกรรมการของ App เดียวกันได้ครั้งเดียว
        b.HasIndex(r => new { r.ApplicationId, r.UserId }).IsUnique();
    }
}

internal sealed class ApplicationConfiguration : IEntityTypeConfiguration<Application>
{
    public void Configure(EntityTypeBuilder<Application> b)
    {
        b.Property(a => a.UpdatedAt).IsConcurrencyToken();
        b.HasOne(a => a.Owner)
            .WithMany()
            .HasForeignKey(a => a.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class AppScreenshotConfiguration : IEntityTypeConfiguration<AppScreenshot>
{
    public void Configure(EntityTypeBuilder<AppScreenshot> b)
    {
        b.HasOne(s => s.Application)
            .WithMany(a => a.Screenshots)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class AppCredentialConfiguration : IEntityTypeConfiguration<AppCredential>
{
    public void Configure(EntityTypeBuilder<AppCredential> b)
    {
        b.HasOne(c => c.Application)
            .WithMany(a => a.Credentials)
            .OnDelete(DeleteBehavior.Cascade);
        b.Property(c => c.Category).HasMaxLength(50);
        b.HasIndex(c => new { c.ApplicationId, c.Env, c.Category });
    }
}

internal sealed class AppLogEntryConfiguration : IEntityTypeConfiguration<AppLogEntry>
{
    public void Configure(EntityTypeBuilder<AppLogEntry> b)
    {
        b.HasOne(l => l.Application)
            .WithMany(a => a.Log)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class AppVoteConfiguration : IEntityTypeConfiguration<AppVote>
{
    public void Configure(EntityTypeBuilder<AppVote> b)
    {
        b.HasOne(v => v.Application)
            .WithMany(a => a.Votes)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(v => v.ReviewerUser)
            .WithMany()
            .HasForeignKey(v => v.ReviewerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // กรรมการหนึ่งคนโหวตได้ครั้งเดียวต่อรอบการรีวิว
        b.HasIndex(v => new { v.ApplicationId, v.ReviewerUserId, v.ReviewCycle }).IsUnique();
    }
}

internal sealed class AppCodeReviewConfiguration : IEntityTypeConfiguration<AppCodeReview>
{
    public void Configure(EntityTypeBuilder<AppCodeReview> b)
    {
        b.HasOne(r => r.Application)
            .WithMany(a => a.CodeReviews)
            .HasForeignKey(r => r.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Property(r => r.ResolvedAt).IsConcurrencyToken();
        b.Property(r => r.ReviewedAt).IsConcurrencyToken();

        // IT รีวิวได้ครั้งเดียวต่อรอบ (รีวิวซ้ำในรอบเดิม = แก้ผลเดิม)
        b.HasIndex(r => new { r.ApplicationId, r.ReviewCycle }).IsUnique();
    }
}
