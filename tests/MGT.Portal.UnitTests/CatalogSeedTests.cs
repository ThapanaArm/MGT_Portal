using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Catalog;

namespace MGT.Portal.UnitTests;

public class CatalogSeedTests
{
    private static PortalDbContext NewDb() =>
        new(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static ApiCategory AddPurchase(PortalDbContext db)
    {
        var cat = new ApiCategory { Key = "purchase", Name = "Purchase", BasePath = "/api/v1/purchase", Description = "", RateLimit = "" };
        db.ApiCategories.Add(cat);
        db.SaveChanges();
        return cat;
    }

    [Fact]
    public void Purchase_seed_adds_all_cards_once()
    {
        using var db = NewDb();
        var cat = AddPurchase(db);

        var first = CatalogSeed.AddMissingFromResource(db, CatalogSeed.PurchaseResource);
        var second = CatalogSeed.AddMissingFromResource(db, CatalogSeed.PurchaseResource);

        Assert.False(first.CategoryMissing);
        Assert.Equal(45, first.Added);
        Assert.Equal(0, second.Added);
        Assert.Equal(45, second.Existing);
        Assert.Equal(45, db.ApiEndpoints.Count(e => e.CategoryId == cat.Id));
    }

    [Fact]
    public void Purchase_seed_never_changes_existing_cards()
    {
        using var db = NewDb();
        var cat = AddPurchase(db);
        db.ApiEndpoints.Add(new ApiEndpoint
        {
            CategoryId = cat.Id, Method = "GET", Path = "/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder",
            Summary = "แก้โดย Admin", Scope = "purchase.order.read",
        });
        db.SaveChanges();

        var result = CatalogSeed.AddMissingFromResource(db, CatalogSeed.PurchaseResource);

        Assert.Equal(44, result.Added);
        var card = db.ApiEndpoints.Single(e => e.Path == "/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder" && e.Method == "GET");
        Assert.Equal("แก้โดย Admin", card.Summary);
    }

    [Fact]
    public void Purchase_seed_skips_when_category_is_missing()
    {
        using var db = NewDb();

        var result = CatalogSeed.AddMissingFromResource(db, CatalogSeed.PurchaseResource);

        Assert.True(result.CategoryMissing);
        Assert.Equal(0, result.Added);
        Assert.Empty(db.ApiEndpoints);
    }

    [Fact]
    public void Purchase_cards_are_valid_for_the_catalog_page()
    {
        using var db = NewDb();
        AddPurchase(db);
        CatalogSeed.AddMissingFromResource(db, CatalogSeed.PurchaseResource);

        foreach (var e in db.ApiEndpoints)
        {
            Assert.StartsWith("/sap/API_", e.Path);
            Assert.Matches("^purchase\\.[a-z_]+\\.(read|create|update|cancel|approve)$", e.Scope);
            Assert.StartsWith("fa:", e.Icon);
            Assert.NotEmpty(JsonHelpers.ParseRows(e.ParamsJson));
            Assert.NotEmpty(JsonHelpers.ParseRows(e.RespFieldsJson));
            using var _ = JsonDocument.Parse(e.RespExample);
            if (e.ReqBody is not null) { using var __ = JsonDocument.Parse(e.ReqBody); }
        }
    }
}
