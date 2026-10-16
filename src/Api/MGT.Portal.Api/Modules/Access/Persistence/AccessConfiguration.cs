using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Access;

internal sealed class AccessGrantConfiguration : IEntityTypeConfiguration<AccessGrant>
{
    public void Configure(EntityTypeBuilder<AccessGrant> b)
    {
        b.HasOne(g => g.User)
            .WithMany()
            .HasForeignKey(g => g.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(g => g.GrantedByUser)
            .WithMany()
            .HasForeignKey(g => g.GrantedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(g => g.Category)
            .WithMany()
            .HasForeignKey(g => g.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(g => new { g.UserId, g.Revoked });
    }
}

internal sealed class ApiTokenConfiguration : IEntityTypeConfiguration<ApiToken>
{
    public void Configure(EntityTypeBuilder<ApiToken> b)
    {
        b.HasOne(t => t.User)
            .WithMany()
            .OnDelete(DeleteBehavior.Cascade);
    }
}
