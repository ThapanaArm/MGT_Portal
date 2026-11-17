using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Identity;

public sealed class DisplayNameOption
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string NormalizedName { get; set; } = "";
}
public sealed class UserSyncLevelMapping
{
    public int Id { get; set; }
    public string SourceRole { get; set; } = "";
    public string NormalizedSourceRole { get; set; } = "";
    public string Level { get; set; } = OrgLevel.Employee;
}
internal sealed class DisplayNameOptionConfiguration : IEntityTypeConfiguration<DisplayNameOption>
{
    public void Configure(EntityTypeBuilder<DisplayNameOption> b)
    {
        b.Property(x => x.Name).HasMaxLength(160);
        b.Property(x => x.NormalizedName).HasMaxLength(160);
        b.HasIndex(x => x.NormalizedName).IsUnique();
        b.HasData(new DisplayNameOption { Id = 1, Name = "Sales Administrative", NormalizedName = "SALES ADMINISTRATIVE" },
            new DisplayNameOption { Id = 2, Name = "Human Resources Staff", NormalizedName = "HUMAN RESOURCES STAFF" });
    }
}
internal sealed class UserSyncLevelMappingConfiguration : IEntityTypeConfiguration<UserSyncLevelMapping>
{
    public void Configure(EntityTypeBuilder<UserSyncLevelMapping> b)
    {
        b.Property(x => x.SourceRole).HasMaxLength(100);
        b.Property(x => x.NormalizedSourceRole).HasMaxLength(100);
        b.Property(x => x.Level).HasMaxLength(32);
        b.HasIndex(x => x.NormalizedSourceRole).IsUnique();
    }
}
