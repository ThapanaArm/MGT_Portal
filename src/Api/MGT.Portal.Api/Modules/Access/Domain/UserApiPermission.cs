using MGT.Portal.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Access;

public class UserApiPermission
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string ResourceKey { get; set; } = "";
    public string ReadScope { get; set; } = "none";
    public string WriteScope { get; set; } = "none";
}

internal sealed class UserApiPermissionConfiguration : IEntityTypeConfiguration<UserApiPermission>
{
    public void Configure(EntityTypeBuilder<UserApiPermission> b)
    {
        b.Property(p => p.ResourceKey).HasMaxLength(200);
        b.Property(p => p.ReadScope).HasMaxLength(16);
        b.Property(p => p.WriteScope).HasMaxLength(16);
        b.HasIndex(p => new { p.UserId, p.ResourceKey }).IsUnique();
        b.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
