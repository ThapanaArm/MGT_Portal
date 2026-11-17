using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>
/// แอปส่ง User token ของคนที่ใช้แอปมาคู่กับ Token ID/Secret — Gateway กรอง SaleOrder ตามสิทธิ์ของคนนั้น
/// Management เห็นทั้งหมด · Manager เห็นทั้งแผนก · Sales Manager เห็นทั้ง Sale group · Employee เห็นของตัวเอง
/// </summary>
public class GatewayUserScopeTests
{
    private sealed class Org
    {
        public required PortalDbContext Db { get; init; }
        public Dictionary<string, string> Tokens { get; } = new();
        public required AppCredential Credential { get; init; }
    }

    /// <summary>ทีมขาย (sales) มี sale1, sale2, salemgr (กลุ่ม SG-N) และ sale3 (กลุ่ม SG-S) · ทีมการเงินมี fin</summary>
    private static async Task<Org> SeedAsync()
    {
        var db = new PortalDbContext(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var salesTeam = new Team { Key = "sales", Name = "Sales" };
        var financeTeam = new Team { Key = "finance", Name = "Finance" };
        var north = new SaleGroup { Key = "SG-N", Name = "North" };
        var south = new SaleGroup { Key = "SG-S", Name = "South" };
        var role = new Role { Key = "sales", Name = "Sales", ScopesCsv = "sales.read,sales.write" };
        User Person(string email, string level, Team team, SaleGroup? group, string? sapId) => new()
        {
            Email = email, Level = level, Team = team, SaleGroup = group, Role = role,
            PlatformIds = sapId is null ? [] : [new UserPlatformId { Platform = "sap", ExternalId = sapId }, new UserPlatformId { Platform = "zoho", ExternalId = "z-" + sapId }],
        };
        db.Users.AddRange(
            Person("sale1@megachem.co.th", OrgLevel.Employee, salesTeam, north, "5001"),
            Person("sale2@megachem.co.th", OrgLevel.Employee, salesTeam, north, "5002"),
            Person("salemgr@megachem.co.th", OrgLevel.SalesManager, salesTeam, north, "5009"),
            Person("sale3@megachem.co.th", OrgLevel.Employee, salesTeam, south, "5003"),
            Person("salesdir@megachem.co.th", OrgLevel.Manager, salesTeam, null, null),
            Person("fin@megachem.co.th", OrgLevel.Employee, financeTeam, null, "7001"),
            Person("cfo@megachem.co.th", OrgLevel.Management, financeTeam, null, null),
            Person("nocode@megachem.co.th", OrgLevel.Employee, salesTeam, null, null));
        var app = new Application { Name = "Sales Dashboard", ProductsCsv = "sales", Status = AppStatus.Active, Type = AppTier.Tier2, OwnerUserId = 1 };
        var cred = CredentialGenerator.NewAppCredential(CredEnv.Sandbox, "sales");
        cred.Application = app;
        db.AppCredentials.Add(cred);
        await db.SaveChangesAsync();

        var org = new Org { Db = db, Credential = cred };
        foreach (var user in await db.Users.ToListAsync())
        {
            var value = UserTokenGenerator.New();
            db.UserTokens.Add(new UserToken { UserId = user.Id, Name = "test", Prefix = UserTokenGenerator.Display(value), TokenHash = UserTokenGenerator.Hash(value), CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(30) });
            org.Tokens[user.Email.Split('@')[0]] = value;
        }
        await db.SaveChangesAsync();
        return org;
    }

    private static Task<GatewayUserResult> Resolve(Org org, string? token, string platform = "sap") =>
        new GatewayUserContext(org.Db, new DataBoundaryResolver(org.Db)).ResolveAsync(token, platform, CancellationToken.None);

    [Fact]
    public async Task Each_level_sees_the_right_owners()
    {
        var org = await SeedAsync();

        var employee = (await Resolve(org, org.Tokens["sale1"])).User!;
        Assert.False(employee.SeesAll);
        Assert.Equal(new[] { "5001" }, employee.OwnerIds);

        var salesManager = (await Resolve(org, org.Tokens["salemgr"])).User!;
        Assert.Equal(DataScope.SaleGroup, salesManager.Scope);
        Assert.Equal("SG-N", salesManager.SaleGroupKey);
        Assert.Equal(new[] { "5001", "5002", "5009" }, salesManager.OwnerIds.Order());

        var manager = (await Resolve(org, org.Tokens["salesdir"])).User!;
        Assert.Equal(DataScope.Team, manager.Scope);
        Assert.Equal(new[] { "5001", "5002", "5003", "5009" }, manager.OwnerIds.Order()); // ทั้งแผนกขาย ไม่รวมการเงิน
        Assert.Null(manager.SaleGroupKey);

        Assert.True((await Resolve(org, org.Tokens["cfo"])).User!.SeesAll);
        Assert.Equal(new[] { "z-5001" }, (await Resolve(org, org.Tokens["sale1"], "zoho")).User!.OwnerIds); // รหัสแต่ละระบบไม่เท่ากัน
    }

    [Fact]
    public async Task Missing_unknown_expired_and_revoked_tokens_are_rejected()
    {
        var org = await SeedAsync();
        Assert.False((await Resolve(org, null)).Ok);
        Assert.False((await Resolve(org, "mgtu_not-a-real-token")).Ok);

        var token = await org.Db.UserTokens.FirstAsync(t => t.TokenHash == UserTokenGenerator.Hash(org.Tokens["sale1"]));
        token.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        await org.Db.SaveChangesAsync();
        Assert.False((await Resolve(org, org.Tokens["sale1"])).Ok);

        token.ExpiresAt = DateTime.UtcNow.AddDays(1);
        token.RevokedAt = DateTime.UtcNow;
        await org.Db.SaveChangesAsync();
        Assert.False((await Resolve(org, org.Tokens["sale1"])).Ok);
    }

    [Fact]
    public async Task Token_hash_is_stored_not_the_token()
    {
        var org = await SeedAsync();
        Assert.DoesNotContain(await org.Db.UserTokens.Select(t => t.TokenHash).ToListAsync(), hash => hash.StartsWith(UserTokenGenerator.Prefix));
        Assert.True((await Resolve(org, org.Tokens["sale1"])).Ok);
        Assert.NotNull((await org.Db.UserTokens.FirstAsync(t => t.TokenHash == UserTokenGenerator.Hash(org.Tokens["sale1"]))).LastUsedAt);
    }

    // ---- Gateway: SaleOrder ใน Supabase ----

    private sealed class CaptureHandler : HttpMessageHandler
    {
        public List<string> Urls { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Urls.Add(request.RequestUri!.AbsoluteUri);
            var res = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("[]", System.Text.Encoding.UTF8, "application/json") };
            res.Content.Headers.TryAddWithoutValidation("Content-Range", "0-0/0");
            return Task.FromResult(res);
        }
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri("https://example.supabase.co/rest/v1/") };
    }

    private static async Task<(IActionResult Result, CaptureHandler Http)> ListAs(Org org, string? who)
    {
        var http = new CaptureHandler();
        var controller = new SalesGatewayController(new GatewayAuth(org.Db), new GatewayUserContext(org.Db, new DataBoundaryResolver(org.Db)),
            new SupabaseSaleOrderClient(new Factory(http)), NullLogger<SalesGatewayController>.Instance);
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers[GatewayAuth.TokenIdHeader] = org.Credential.TokenId;
        ctx.Request.Headers[GatewayAuth.TokenSecretHeader] = org.Credential.TokenSecret;
        if (who is not null) ctx.Request.Headers[GatewayUserContext.Header] = org.Tokens[who];
        controller.ControllerContext = new ControllerContext { HttpContext = ctx };
        return (await controller.ListOrders(null, null, null, null), http);
    }

    [Fact]
    public async Task Sale_order_list_is_filtered_by_the_user_in_the_token()
    {
        var org = await SeedAsync();

        var (noUser, noUserHttp) = await ListAs(org, null);
        Assert.Equal(StatusCodes.Status401Unauthorized, Assert.IsType<ObjectResult>(noUser).StatusCode);
        Assert.Empty(noUserHttp.Urls);

        var (_, employee) = await ListAs(org, "sale1");
        Assert.Contains("Sales_Employee_Id=in.%28%225001%22%29", Assert.Single(employee.Urls));

        var (_, salesManager) = await ListAs(org, "salemgr");
        var url = Assert.Single(salesManager.Urls);
        Assert.Contains("Sale_Group=in.%28%22SG-N%22%29", url);
        Assert.DoesNotContain("Sales_Employee_Id=", url);

        var (_, cfo) = await ListAs(org, "cfo");
        Assert.DoesNotContain("Sales_Employee_Id=", Assert.Single(cfo.Urls));
        Assert.DoesNotContain("Sale_Group=", cfo.Urls[0]);

        var (result, nobody) = await ListAs(org, "nocode"); // ไม่มีรหัสพนักงานในระบบ → ไม่เห็นข้อมูลเลย
        Assert.Empty(nobody.Urls);
        var page = Assert.IsType<GatewayPage<SaleOrderDto>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Empty(page.Data);
        Assert.Equal(DataScope.Self, page.Meta.DataScope);
    }
}
