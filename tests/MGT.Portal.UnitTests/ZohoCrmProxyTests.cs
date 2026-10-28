using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>Zoho CRM (Deals / Quotes / Sales_Orders) ผ่าน /api/v1/sales/zoho/* — ทดสอบด้วย Zoho จำลอง (ไม่ต่อ Zoho จริง)</summary>
public class ZohoCrmProxyTests
{
    // ---------- Zoho จำลอง ----------

    private sealed class FakeZoho : HttpMessageHandler
    {
        public List<(HttpMethod Method, string Url, string? Body, string? Auth)> Calls { get; } = [];
        public int TokenRequests { get; private set; }
        public string TokenResponse { get; set; } = """{"access_token":"T1","expires_in":3600,"api_domain":"https://www.zohoapis.com","token_type":"Bearer"}""";
        public Queue<HttpResponseMessage> ApiResponses { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var url = Uri.UnescapeDataString(req.RequestUri!.ToString());
            var body = req.Content is null ? null : await req.Content.ReadAsStringAsync(ct);
            if (url.Contains("/oauth/v2/token"))
            {
                TokenRequests++;
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(TokenResponse) };
            }
            Calls.Add((req.Method, url, body, req.Headers.TryGetValues("Authorization", out var a) ? a.First() : null));
            return ApiResponses.Count > 0 ? ApiResponses.Dequeue() : Ok("""{"data":[{"id":"1"}],"info":{"count":1,"more_records":false}}""");
        }
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private static HttpResponseMessage Ok(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Created(string id) =>
        Ok($$"""{"data":[{"code":"SUCCESS","details":{"id":"{{id}}","Modified_Time":"2026-10-27T10:00:00+07:00"},"message":"record added","status":"success"}]}""", HttpStatusCode.Created);

    private sealed class Rig
    {
        public required PortalDbContext Db { get; init; }
        public required FakeZoho Zoho { get; init; }
        public required ZohoTokenStore Tokens { get; init; }
        public required Dictionary<string, AppCredential> Creds { get; init; }
        public required IConfiguration Config { get; init; }

        public async Task<IActionResult> SendAsync(string method, string path, string? query = null, string? body = null, string? key = null, string env = CredEnv.Sandbox)
        {
            var ctx = new DefaultHttpContext();
            var r = ctx.Request;
            r.Method = method;
            r.Path = "/" + ZohoCrmProxyController.RoutePrefix + path;
            r.QueryString = query is null ? QueryString.Empty : new QueryString(query);
            r.Headers[GatewayAuth.TokenIdHeader] = Creds[env].TokenId;
            r.Headers[GatewayAuth.TokenSecretHeader] = Creds[env].TokenSecret;
            if (key is not null) r.Headers[GatewayIdempotency.Header] = key;
            r.Body = new MemoryStream(Encoding.UTF8.GetBytes(body ?? ""));
            var controller = new ZohoCrmProxyController(
                new GatewayAuth(Db), new GatewayIdempotency(Db), new ZohoCrmClient(new Factory(Zoho), Config, Tokens), Config,
                NullLogger<ZohoCrmProxyController>.Instance)
            {
                ControllerContext = new ControllerContext { HttpContext = ctx },
            };
            return await controller.Handle(CancellationToken.None);
        }
    }

    private static async Task<Rig> NewRigAsync(bool configured = true)
    {
        var db = new PortalDbContext(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var app = new Application
        {
            Name = "Deal Tracker", ProductsCsv = "sales", Status = AppStatus.Active, Type = AppTier.Tier2,
            OwnerUserId = 1, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        db.Applications.Add(app);
        var creds = new Dictionary<string, AppCredential>();
        foreach (var env in new[] { CredEnv.Sandbox, CredEnv.Production })
        {
            var cred = CredentialGenerator.NewAppCredential(env, "sales");
            cred.Application = app;
            db.AppCredentials.Add(cred);
            creds[env] = cred;
        }
        await db.SaveChangesAsync();

        var values = new Dictionary<string, string?>();
        if (configured)
        {
            foreach (var (section, domain) in new[] { ("sandbox", "https://sandbox.zohoapis.com"), ("prod", "https://www.zohoapis.com") })
            {
                values[$"ZohoConfig:{section}:ClientId"] = $"1000.{section}";
                values[$"ZohoConfig:{section}:ClientSecret"] = "secret";
                values[$"ZohoConfig:{section}:RefreshToken"] = "refresh";
                values[$"ZohoConfig:{section}:AccountsUrl"] = "https://accounts.zoho.com";
                values[$"ZohoConfig:{section}:ApiDomain"] = domain;
            }
        }
        return new Rig
        {
            Db = db, Zoho = new FakeZoho(), Tokens = new ZohoTokenStore(), Creds = creds,
            Config = new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
        };
    }

    private static int Status(IActionResult r) => r switch
    {
        ContentResult c => c.StatusCode ?? 200,
        ObjectResult o => o.StatusCode ?? 200,
        _ => throw new InvalidOperationException(r.GetType().Name),
    };

    private static string Text(IActionResult r) => r is ContentResult c ? c.Content ?? "" : JsonSerializer.Serialize(((ObjectResult)r).Value);

    // ---------- เส้นที่เปิด ----------

    [Theory]
    [InlineData("GET", "/Deals", null, ZohoAction.List, "sales.deal.read")]
    [InlineData("GET", "/deals/6421337000000123456", null, ZohoAction.Get, "sales.deal.read")]
    [InlineData("GET", "/Quotes/search", "?criteria=(Quote_Stage:equals:Draft)", ZohoAction.Search, "sales.quote.read")]
    [InlineData("GET", "/settings/fields", "?module=sales_orders", ZohoAction.Fields, "sales.order.read")]
    [InlineData("POST", "/Sales_Orders", null, ZohoAction.Create, "sales.order.create")]
    [InlineData("PUT", "/Quotes/6421337000000123456", null, ZohoAction.Update, "sales.quote.update")]
    public void Resolves_supported_operations(string method, string path, string? query, ZohoAction action, string scope)
    {
        var op = ZohoOperations.Resolve(method, path, query).Operation;
        Assert.NotNull(op);
        Assert.Equal(action, op.Action);
        Assert.Equal(scope, op.Scope);
    }

    [Theory]
    [InlineData("DELETE", "/Deals/1", null, 403)]
    [InlineData("PUT", "/Deals", null, 405)]
    [InlineData("GET", "/Leads", null, 404)]
    [InlineData("GET", "/Deals/search", null, 400)]
    [InlineData("GET", "/Deals/abc", null, 400)]
    [InlineData("GET", "/settings/fields", "?module=Leads", 400)]
    public void Rejects_everything_else(string method, string path, string? query, int status)
    {
        var res = ZohoOperations.Resolve(method, path, query);
        Assert.Null(res.Operation);
        Assert.Equal(status, res.Status);
    }

    [Fact]
    public void List_gets_default_fields_and_page_size()
    {
        var op = ZohoOperations.Resolve("GET", "/Deals", null).Operation!;
        var (q, error) = ZohoOperations.BuildQuery(op, "");
        Assert.Null(error);
        Assert.Contains("fields=Deal_Name%2CStage", q);
        Assert.Contains("per_page=50", q);
        Assert.NotNull(ZohoOperations.BuildQuery(op, "?per_page=500").Error);
        Assert.NotNull(ZohoOperations.BuildQuery(op, "?delete=1").Error);
    }

    // ---------- อ่าน ----------

    [Fact]
    public async Task Get_uses_sandbox_domain_and_reuses_the_access_token()
    {
        var rig = await NewRigAsync();

        var first = await rig.SendAsync("GET", "/Deals", "?fields=Deal_Name,Stage&per_page=10");
        var second = await rig.SendAsync("GET", "/Deals/6421337000000123456");

        Assert.Equal(200, Status(first));
        Assert.Equal(200, Status(second));
        Assert.Equal(1, rig.Zoho.TokenRequests);
        Assert.Equal("https://sandbox.zohoapis.com/crm/v8/Deals?fields=Deal_Name,Stage&per_page=10", rig.Zoho.Calls[0].Url);
        Assert.Equal("Zoho-oauthtoken T1", rig.Zoho.Calls[0].Auth);
    }

    [Fact]
    public async Task Production_token_uses_the_prod_config()
    {
        var rig = await NewRigAsync();

        await rig.SendAsync("GET", "/Quotes/1", env: CredEnv.Production);

        Assert.StartsWith("https://www.zohoapis.com/crm/v8/Quotes/1", rig.Zoho.Calls.Single().Url);
    }

    [Fact]
    public async Task Empty_result_becomes_an_empty_list()
    {
        var rig = await NewRigAsync();
        rig.Zoho.ApiResponses.Enqueue(new HttpResponseMessage(HttpStatusCode.NoContent));

        var result = await rig.SendAsync("GET", "/Sales_Orders");

        Assert.Equal(200, Status(result));
        Assert.Contains("\"data\":[]", Text(result));
    }

    [Fact]
    public async Task Expired_token_is_refreshed_once_and_retried()
    {
        var rig = await NewRigAsync();
        rig.Zoho.ApiResponses.Enqueue(Ok("""{"code":"INVALID_TOKEN","message":"invalid oauth token","status":"error"}""", HttpStatusCode.Unauthorized));

        var result = await rig.SendAsync("GET", "/Deals/1");

        Assert.Equal(200, Status(result));
        Assert.Equal(2, rig.Zoho.TokenRequests);
        Assert.Equal(2, rig.Zoho.Calls.Count);
    }

    [Fact]
    public async Task Missing_config_returns_503_without_calling_zoho()
    {
        var rig = await NewRigAsync(configured: false);

        var result = await rig.SendAsync("GET", "/Deals");

        Assert.Equal(503, Status(result));
        Assert.Contains("ZohoConfig:sandbox:ClientId", Text(result));
        Assert.Empty(rig.Zoho.Calls);
    }

    [Fact]
    public async Task Bad_refresh_token_is_reported_as_gateway_error()
    {
        var rig = await NewRigAsync();
        rig.Zoho.TokenResponse = """{"error":"invalid_code"}""";

        var result = await rig.SendAsync("GET", "/Deals");

        Assert.Equal(502, Status(result));
        Assert.Contains("invalid_code", Text(result));
    }

    // ---------- เขียน ----------

    [Fact]
    public async Task App_can_update_records_it_created_but_not_others()
    {
        var rig = await NewRigAsync();
        rig.Zoho.ApiResponses.Enqueue(Created("6421337000000999001"));

        var created = await rig.SendAsync("POST", "/Deals", body: """{"data":[{"Deal_Name":"Test","Stage":"Qualification"}],"trigger":["workflow"]}""", key: "create-1");
        Assert.Equal(201, Status(created));
        Assert.Equal(HttpMethod.Post, rig.Zoho.Calls[0].Method);
        Assert.Contains("\"trigger\":[\"workflow\"]", rig.Zoho.Calls[0].Body);

        var own = await rig.SendAsync("PUT", "/Deals/6421337000000999001", body: """{"data":[{"Stage":"Closed Won"}]}""", key: "update-1");
        Assert.Equal(200, Status(own));

        var other = await rig.SendAsync("PUT", "/Deals/6421337000000000002", body: """{"data":[{"Stage":"Closed Won"}]}""", key: "update-2");
        Assert.Equal(403, Status(other));
        Assert.Equal(2, rig.Zoho.Calls.Count);
    }

    [Fact]
    public async Task Retry_with_same_key_replays_without_calling_zoho()
    {
        var rig = await NewRigAsync();
        rig.Zoho.ApiResponses.Enqueue(Created("6421337000000999001"));
        const string body = """{"data":[{"Subject":"Q-1"}]}""";

        var first = await rig.SendAsync("POST", "/Quotes", body: body, key: "k1");
        var second = await rig.SendAsync("POST", "/Quotes", body: body, key: "k1");

        Assert.Equal(Text(first), Text(second));
        Assert.Single(rig.Zoho.Calls);
    }

    [Fact]
    public async Task Zoho_validation_error_is_returned_with_details_and_key_can_be_retried()
    {
        var rig = await NewRigAsync();
        rig.Zoho.ApiResponses.Enqueue(Ok("""{"data":[{"code":"MANDATORY_NOT_FOUND","details":{"api_name":"Account_Name"},"message":"required field not found","status":"error"}]}""", HttpStatusCode.BadRequest));

        var result = await rig.SendAsync("POST", "/Sales_Orders", body: """{"data":[{"Subject":"SO-1"}]}""", key: "k1");

        Assert.Equal(400, Status(result));
        Assert.Contains("MANDATORY_NOT_FOUND", Text(result));
        Assert.Contains("Account_Name", Text(result));
        Assert.Empty(rig.Db.GatewayWriteRecords);
    }

    [Theory]
    [InlineData("""{"Deal_Name":"x"}""")]
    [InlineData("""{"data":[]}""")]
    [InlineData("""{"data":[{"Deal_Name":"x"}],"duplicate_check_fields":["Deal_Name"]}""")]
    public async Task Body_must_be_zoho_data_array(string body)
    {
        var rig = await NewRigAsync();

        var result = await rig.SendAsync("POST", "/Deals", body: body, key: "k1");

        Assert.Equal(400, Status(result));
        Assert.Empty(rig.Zoho.Calls);
    }

    [Fact]
    public async Task Write_without_idempotency_key_is_rejected()
    {
        var rig = await NewRigAsync();

        var result = await rig.SendAsync("POST", "/Deals", body: """{"data":[{"Deal_Name":"x"}]}""");

        Assert.Equal(400, Status(result));
        Assert.Empty(rig.Zoho.Calls);
    }
}
