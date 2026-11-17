using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Identity;

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> b) => b.HasIndex(r => r.Key).IsUnique();
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.HasIndex(u => u.Email).IsUnique();

        // ผู้ใช้ที่ยังไม่ถูกจัดทีมได้ (TeamId = null) และการลบทีมต้องไม่ลบผู้ใช้ตาม
        b.HasOne(u => u.Team)
            .WithMany(t => t.Members)
            .HasForeignKey(u => u.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasOne(u => u.SaleGroup)
            .WithMany(g => g.Members)
            .HasForeignKey(u => u.SaleGroupId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> b) => b.HasIndex(t => t.Key).IsUnique();
}

internal sealed class SaleGroupConfiguration : IEntityTypeConfiguration<SaleGroup>
{
    public void Configure(EntityTypeBuilder<SaleGroup> b)
    {
        b.Property(g => g.Key).HasMaxLength(50);
        b.Property(g => g.Name).HasMaxLength(200);
        b.HasIndex(g => g.Key).IsUnique();
    }
}

internal sealed class UserPlatformIdConfiguration : IEntityTypeConfiguration<UserPlatformId>
{
    public void Configure(EntityTypeBuilder<UserPlatformId> b)
    {
        b.Property(p => p.Platform).HasMaxLength(32);
        b.Property(p => p.ExternalId).HasMaxLength(100);
        b.HasOne(p => p.User).WithMany(u => u.PlatformIds).HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        // รหัสหนึ่งในระบบหนึ่งเป็นของผู้ใช้ได้คนเดียว
        b.HasIndex(p => new { p.Platform, p.ExternalId }).IsUnique();
    }
}

internal sealed class UserTokenConfiguration : IEntityTypeConfiguration<UserToken>
{
    public void Configure(EntityTypeBuilder<UserToken> b)
    {
        b.Property(t => t.Name).HasMaxLength(100);
        b.Property(t => t.Prefix).HasMaxLength(16);
        b.Property(t => t.TokenHash).HasMaxLength(64);
        b.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(t => t.TokenHash).IsUnique();
    }
}
