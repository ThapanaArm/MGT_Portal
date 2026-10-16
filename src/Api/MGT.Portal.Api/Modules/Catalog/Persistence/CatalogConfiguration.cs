using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Catalog;

internal sealed class ApiCategoryConfiguration : IEntityTypeConfiguration<ApiCategory>
{
    public void Configure(EntityTypeBuilder<ApiCategory> b) => b.HasIndex(c => c.Key).IsUnique();
}

internal sealed class ApiEndpointConfiguration : IEntityTypeConfiguration<ApiEndpoint>
{
    public void Configure(EntityTypeBuilder<ApiEndpoint> b)
    {
        b.HasOne(e => e.Category)
            .WithMany(c => c.Endpoints)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
