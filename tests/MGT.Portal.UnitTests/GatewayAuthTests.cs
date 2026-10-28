using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>
/// ทดสอบด่านตรวจ Token ID/Secret ของ Gateway — Sandbox ใช้ได้ตั้งแต่ IT เตรียมเสร็จ,
/// Production ใช้ได้หลังอนุมัติ, ต้องเป็น Tier 2/3 และแอปต้องขอ API หมวดนั้นไว้
/// </summary>
public class GatewayAuthTests
{
    private const string Category = "sales";

    private static PortalDbContext NewDb() => new(new DbContextOptionsBuilder<PortalDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task<AppCredential> SeedAsync(PortalDbContext db,
        string status = AppStatus.Active, string tier = AppTier.Tier2, string products = "sales,inventory",
        string env = CredEnv.Sandbox, bool revoked = false, string? developmentStage = null, string category = Category)
    {
        var app = new Application
        {
            Name = "Sales Dashboard", ProductsCsv = products, Status = status, Type = tier,
            OwnerUserId = 1, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        if (developmentStage is not null)
            DevelopmentProcess.Write(app, new DevelopmentRequest(developmentStage, AppTier.Tier2));
        db.Applications.Add(app);
        var cred = CredentialGenerator.NewAppCredential(env, category);
        cred.Application = app;
        cred.Revoked = revoked;
        db.AppCredentials.Add(cred);
        await db.SaveChangesAsync();
        return cred;
    }

    private static HttpRequest Request(string? tokenId, string? tokenSecret)
    {
        var ctx = new DefaultHttpContext();
        if (tokenId is not null) ctx.Request.Headers[GatewayAuth.TokenIdHeader] = tokenId;
        if (tokenSecret is not null) ctx.Request.Headers[GatewayAuth.TokenSecretHeader] = tokenSecret;
        return ctx.Request;
    }

    private static Task<GatewayAuthResult> Authenticate(PortalDbContext db, string? id, string? secret) =>
        new GatewayAuth(db).AuthenticateAsync(Request(id, secret), Category, CancellationToken.None);

    [Fact]
    public async Task Active_tier2_app_with_sales_and_sandbox_credential_passes()
    {
        using var db = NewDb();
        var cred = await SeedAsync(db);

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.True(result.Ok);
        Assert.Equal("Sales Dashboard", result.Caller!.ApplicationName);
        Assert.Equal(CredEnv.Sandbox, result.Caller.Env);
    }

    [Fact]
    public async Task Missing_headers_returns_401()
    {
        using var db = NewDb();
        await SeedAsync(db);

        var result = await Authenticate(db, null, null);

        Assert.False(result.Ok);
        Assert.Equal(StatusCodes.Status401Unauthorized, result.StatusCode);
    }

    [Fact]
    public async Task Wrong_secret_returns_401()
    {
        using var db = NewDb();
        var cred = await SeedAsync(db);

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret + "x");

        Assert.Equal(StatusCodes.Status401Unauthorized, result.StatusCode);
    }

    [Fact]
    public async Task Revoked_credential_returns_401()
    {
        using var db = NewDb();
        var cred = await SeedAsync(db, revoked: true);

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.Equal(StatusCodes.Status401Unauthorized, result.StatusCode);
    }

    [Theory]
    [InlineData(AppStatus.Pending, AppTier.Tier2, "sales")]   // ยังไม่ผ่านการอนุมัติ
    [InlineData(AppStatus.Suspended, AppTier.Tier2, "sales")] // ถูกระงับ
    [InlineData(AppStatus.Active, AppTier.Tier1, "sales")]    // Tier 1 ใช้ API ไม่ได้
    [InlineData(AppStatus.Active, AppTier.Tier2, "purchase")] // ไม่ได้ขอหมวด sales
    public async Task App_not_allowed_for_sales_returns_403(string status, string tier, string products)
    {
        using var db = NewDb();
        var cred = await SeedAsync(db, status, tier, products);

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
    }

    [Fact]
    public async Task Token_of_another_requested_category_is_rejected()
    {
        // แอปขอทั้ง sales และ inventory แต่ใช้ token ของ inventory เรียก API sales ไม่ได้
        using var db = NewDb();
        var cred = await SeedAsync(db, category: "inventory");

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        Assert.Contains("inventory", result.Error);
    }

    [Theory]
    [InlineData("development")]
    [InlineData("review")]
    public async Task Sandbox_credential_works_while_the_app_is_being_developed(string stage)
    {
        using var db = NewDb();
        var status = stage == "review" ? AppStatus.Pending : AppStatus.Draft;
        var cred = await SeedAsync(db, status, AppTier.Tier1, developmentStage: stage);

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.True(result.Ok);
    }

    [Fact]
    public async Task Sandbox_credential_is_rejected_before_IT_completes_preparation()
    {
        using var db = NewDb();
        var cred = await SeedAsync(db, AppStatus.Draft, AppTier.Tier1, developmentStage: "setup");

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
    }

    [Fact]
    public async Task Production_credential_works_after_approval()
    {
        using var db = NewDb();
        var cred = await SeedAsync(db, env: CredEnv.Production);

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.True(result.Ok);
        Assert.Equal(CredEnv.Production, result.Caller!.Env);
    }

    [Fact]
    public async Task Production_credential_is_rejected_before_approval()
    {
        using var db = NewDb();
        var cred = await SeedAsync(db, AppStatus.Pending, AppTier.Tier1, env: CredEnv.Production, developmentStage: "review");

        var result = await Authenticate(db, cred.TokenId, cred.TokenSecret);

        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
    }
}
