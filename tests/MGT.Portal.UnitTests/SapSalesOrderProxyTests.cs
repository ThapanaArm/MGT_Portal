using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
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

/// <summary>SAP API_SALES_ORDER_SRV แบบ passthrough ที่ /api/v1/sales/sap/* — ทดสอบด้วย SAP จำลอง (ไม่ต่อ SAP จริง)</summary>
public class SapSalesOrderProxyTests
{
    private const string SapBase = "https://my423387-api.s4hana.cloud.sap/sap/opu/odata/sap/API_SALES_ORDER_SRV/";

    // ---------- SAP จำลอง ----------

    private sealed class FakeSap : HttpMessageHandler
    {
        public List<(HttpMethod Method, string PathAndQuery, string? Body, Dictionary<string, string> Headers)> Calls { get; } = [];
        public Func<HttpRequestMessage, string?, HttpResponseMessage>? OnWrite { get; set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var body = req.Content is null ? null : await req.Content.ReadAsStringAsync(ct);
            var headers = req.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
            var pq = Uri.UnescapeDataString(req.RequestUri!.PathAndQuery.Replace("/sap/opu/odata/sap/API_SALES_ORDER_SRV/", ""));
            Calls.Add((req.Method, pq, body, headers));

            if (req.Method == HttpMethod.Get && headers.TryGetValue("x-csrf-token", out var f) && f == "Fetch")
            {
                var res = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"d":{"results":[]}}""") };
                res.Headers.Add("x-csrf-token", "TOKEN-1");
                res.Headers.Add("Set-Cookie", "SAP_SESSIONID_X=abc; path=/");
                return res;
            }
            if (req.Method == HttpMethod.Get)
            {
                var json = "{\"d\":{\"__metadata\":{\"uri\":\"" + SapBase + "A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')\",\"etag\":\"W/\\\"etag-10\\\"\"},\"SalesOrder\":\"1234\",\"SalesOrderItem\":\"10\"}}";
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
            }
            return OnWrite?.Invoke(req, body) ?? new HttpResponseMessage(HttpStatusCode.NoContent);
        }
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri(SapBase) };
    }

    // ---------- ตัวช่วย ----------

    private sealed class Rig
    {
        public required PortalDbContext Db { get; init; }
        public required FakeSap Sap { get; init; }
        public required AppCredential Cred { get; init; }
        public required IConfiguration Config { get; init; }

        public async Task<(IActionResult Result, HttpResponse Response)> SendAsync(
            string method, string path, string? query = null, string? body = null, string? key = null, string? ifMatch = null, AppCredential? cred = null)
        {
            var ctx = new DefaultHttpContext();
            var r = ctx.Request;
            r.Method = method;
            r.Scheme = "https";
            r.Host = new HostString("portal.megachem.co.th");
            r.Path = "/" + SapSalesOrderProxyController.RoutePrefix + path;
            r.QueryString = query is null ? QueryString.Empty : new QueryString(query);
            var c = cred ?? Cred;
            r.Headers[GatewayAuth.TokenIdHeader] = c.TokenId;
            r.Headers[GatewayAuth.TokenSecretHeader] = c.TokenSecret;
            if (key is not null) r.Headers[GatewayIdempotency.Header] = key;
            if (ifMatch is not null) r.Headers.IfMatch = ifMatch;
            r.Body = new MemoryStream(Encoding.UTF8.GetBytes(body ?? ""));

            var controller = new SapSalesOrderProxyController(
                new GatewayAuth(Db), new GatewayIdempotency(Db), new SapODataProxy(new Factory(Sap), Config), Config,
                NullLogger<SapSalesOrderProxyController>.Instance)
            {
                ControllerContext = new ControllerContext { HttpContext = ctx },
            };
            return (await controller.Handle(CancellationToken.None), ctx.Response);
        }
    }

    private static async Task<Rig> NewRigAsync(bool enableApprove = false)
    {
        var db = new PortalDbContext(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var app = new Application
        {
            Name = "Sales Mobile App", ProductsCsv = "sales", Status = AppStatus.Active, Type = AppTier.Tier2,
            OwnerUserId = 1, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        db.Applications.Add(app);
        var cred = CredentialGenerator.NewAppCredential(CredEnv.Sandbox, "sales");
        cred.Application = app;
        db.AppCredentials.Add(cred);
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Sap:SalesOrganization"] = "1010",
            ["Sap:DistributionChannel"] = "10",
            ["Sap:OrganizationDivision"] = "00",
            ["Gateway:Sap:EnableApprove"] = enableApprove ? "true" : "false",
        }).Build();
        return new Rig { Db = db, Sap = new FakeSap(), Cred = cred, Config = config };
    }

    private static int Status(IActionResult r) => r switch
    {
        ContentResult c => c.StatusCode ?? 200,
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,
        _ => throw new InvalidOperationException(r.GetType().Name),
    };

    private static string Message(IActionResult r) => JsonSerializer.Serialize(((ObjectResult)r).Value);

    private static HttpResponseMessage Created(string so) => new(HttpStatusCode.Created)
    {
        Content = new StringContent("{\"d\":{\"__metadata\":{\"uri\":\"" + SapBase + "A_SalesOrder('" + so + "')\"},\"SalesOrder\":\"" + so + "\"}}", Encoding.UTF8, "application/json"),
    };

    // ---------- รายการ operation ----------

    [Fact]
    public void Operation_list_covers_the_whole_spec_and_blocks_delete_and_batch()
    {
        Assert.Equal(158, SapSalesOrderOperations.All.Count);
        Assert.Equal(98, SapSalesOrderOperations.All.Count(o => o.Scope == SapScope.Read));
        Assert.All(SapSalesOrderOperations.All.Where(o => o.Method == "DELETE"), o => Assert.True(o.IsBlocked));
        Assert.True(SapSalesOrderOperations.Find("POST", "/$batch")!.Operation.IsBlocked);
        Assert.All(SapSalesOrderOperations.All, o => Assert.True(o.AuditName.Length <= 50));
    }

    [Theory]
    [InlineData("GET", "/A_SalesOrder", SapScope.Read)]
    [InlineData("POST", "/A_SalesOrder", SapScope.Create)]
    [InlineData("GET", "/A_SalesOrder('1234')/to_Item", SapScope.Read)]
    [InlineData("POST", "/A_SalesOrder('1234')/to_Partner", SapScope.Update)]
    [InlineData("PATCH", "/A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')", SapScope.Update)]
    [InlineData("POST", "/releaseApprovalRequest", SapScope.Approve)]
    [InlineData("GET", "/$metadata", SapScope.Read)]
    public void Finds_operation_and_scope(string method, string path, string scope)
    {
        var match = SapSalesOrderOperations.Find(method, path);
        Assert.NotNull(match);
        Assert.Equal(scope, match.Operation.Scope);
    }

    [Fact]
    public void Extracts_keys_from_path()
    {
        var match = SapSalesOrderOperations.Find("GET", "/A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')/to_Partner")!;
        Assert.Equal("1234", match.Keys["SalesOrder"]);
        Assert.Equal("10", match.Keys["SalesOrderItem"]);
        Assert.Null(SapSalesOrderOperations.Find("GET", "/A_SalesOrder('1234')/to_Nothing"));
    }

    [Fact]
    public void Query_gets_default_top_on_collections_and_rejects_unknown_options()
    {
        var list = SapSalesOrderOperations.Find("GET", "/A_SalesOrder")!.Operation;
        var single = SapSalesOrderOperations.Find("GET", "/A_SalesOrder('1')")!.Operation;

        Assert.Equal("?%24top=100", SapODataProxy.BuildQuery(list, "").Query);
        Assert.Equal("?%24select=SalesOrder", SapODataProxy.BuildQuery(single, "?$select=SalesOrder&$format=xml").Query);
        Assert.NotNull(SapODataProxy.BuildQuery(list, "?$top=5000").Error);
        Assert.NotNull(SapODataProxy.BuildQuery(list, "?sap-client=200").Error);
    }

    // ---------- อ่าน ----------

    [Fact]
    public async Task Get_is_forwarded_with_query_and_hides_the_sap_url()
    {
        var rig = await NewRigAsync();

        var (result, response) = await rig.SendAsync("GET", "/A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')", "?$select=SalesOrder,SalesOrderItem");

        Assert.Equal(200, Status(result));
        var call = Assert.Single(rig.Sap.Calls);
        Assert.Equal("A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')?$select=SalesOrder,SalesOrderItem", call.PathAndQuery);
        var body = ((ContentResult)result).Content!;
        Assert.DoesNotContain("s4hana.cloud.sap", body);
        Assert.Contains("https://portal.megachem.co.th/api/v1/sales/sap/A_SalesOrderItem(", body);
        Assert.Equal(SapScope.Read, response.Headers[SapSalesOrderProxyController.ScopeHeader].ToString());
    }

    [Theory]
    [InlineData("DELETE", "/A_SalesOrder('1234')", 403)]
    [InlineData("POST", "/$batch", 403)]
    [InlineData("GET", "/A_Customer", 404)]
    [InlineData("PUT", "/A_SalesOrder('1234')", 405)]
    public async Task Blocked_unknown_and_wrong_method_never_reach_sap(string method, string path, int status)
    {
        var rig = await NewRigAsync();

        var (result, _) = await rig.SendAsync(method, path, key: "k1");

        Assert.Equal(status, Status(result));
        Assert.Empty(rig.Sap.Calls);
    }

    // ---------- เขียน ----------

    [Fact]
    public async Task Create_fills_org_defaults_and_then_the_app_may_change_its_own_order()
    {
        var rig = await NewRigAsync();
        rig.Sap.OnWrite = (req, _) => req.Method == HttpMethod.Post ? Created("1234") : new HttpResponseMessage(HttpStatusCode.NoContent);

        var (created, _) = await rig.SendAsync("POST", "/A_SalesOrder",
            body: """{"SoldToParty":"1000123","to_Item":[{"Material":"CHM-010","RequestedQuantity":"1000"}]}""", key: "create-1");
        Assert.Equal(201, Status(created));
        using (var doc = JsonDocument.Parse(rig.Sap.Calls.Single(c => c.Method == HttpMethod.Post).Body!))
        {
            Assert.Equal("1010", doc.RootElement.GetProperty("SalesOrganization").GetString());
            Assert.Equal("OR", doc.RootElement.GetProperty("SalesOrderType").GetString());
        }

        // แก้รายการของ SO ที่แอปสร้างเอง — ไม่ส่ง If-Match มา Gateway อ่าน ETag ให้
        var (patched, response) = await rig.SendAsync("PATCH", "/A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')",
            body: """{"RequestedQuantity":"1200"}""", key: "patch-1");
        Assert.Equal(204, Status(patched));
        var patch = rig.Sap.Calls.Single(c => c.Method == HttpMethod.Patch);
        Assert.Equal("W/\"etag-10\"", patch.Headers["If-Match"]);
        Assert.Equal("TOKEN-1", patch.Headers["x-csrf-token"]);
        Assert.Equal(SapScope.Update, response.Headers[SapSalesOrderProxyController.ScopeHeader].ToString());
    }

    [Fact]
    public async Task Changing_an_order_the_app_did_not_create_is_forbidden()
    {
        var rig = await NewRigAsync();

        var (result, _) = await rig.SendAsync("POST", "/A_SalesOrder('9999')/to_Text",
            body: """{"LongTextID":"0001","Language":"EN","LongText":"x"}""", key: "k1");

        Assert.Equal(403, Status(result));
        Assert.Empty(rig.Sap.Calls);
    }

    [Fact]
    public async Task Entity_set_post_takes_the_sales_order_from_the_body()
    {
        var rig = await NewRigAsync();

        var (result, _) = await rig.SendAsync("POST", "/A_SalesOrderItem",
            body: """{"SalesOrder":"9999","Material":"CHM-010"}""", key: "k1");

        Assert.Equal(403, Status(result)); // ไม่ใช่ SO ของแอปนี้
        Assert.Equal("9999", SapSalesOrderProxyController.SalesOrderOf(new Dictionary<string, string>(),
            JsonNode.Parse("""{"SalesOrder":"9999"}""")!.AsObject(), null));
    }

    [Fact]
    public async Task Patch_with_rejection_reason_counts_as_cancel()
    {
        var rig = await NewRigAsync();
        rig.Sap.OnWrite = (req, _) => req.Method == HttpMethod.Post ? Created("1234") : new HttpResponseMessage(HttpStatusCode.NoContent);
        await rig.SendAsync("POST", "/A_SalesOrder", body: """{"SoldToParty":"1000123"}""", key: "create-1");

        var (_, response) = await rig.SendAsync("PATCH", "/A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')",
            body: """{"SalesDocumentRjcnReason":"Z1"}""", key: "cancel-1", ifMatch: "W/\"etag-10\"");

        Assert.Equal(SapScope.Cancel, response.Headers[SapSalesOrderProxyController.ScopeHeader].ToString());
    }

    [Fact]
    public async Task Org_fields_that_differ_from_config_are_rejected()
    {
        var rig = await NewRigAsync();

        var (result, _) = await rig.SendAsync("POST", "/A_SalesOrder", body: """{"SoldToParty":"1","SalesOrganization":"2020"}""", key: "k1");

        Assert.Equal(422, Status(result));
        Assert.Empty(rig.Sap.Calls);
    }

    [Fact]
    public async Task Approval_actions_are_off_by_default()
    {
        var rig = await NewRigAsync();

        var (result, _) = await rig.SendAsync("POST", "/releaseApprovalRequest", "?SalesOrder='1234'", key: "k1");

        Assert.Equal(403, Status(result));
        Assert.Contains("Flow", Message(result));
        Assert.Empty(rig.Sap.Calls);
    }

    [Fact]
    public async Task Write_without_idempotency_key_is_rejected()
    {
        var rig = await NewRigAsync();

        var (result, _) = await rig.SendAsync("POST", "/A_SalesOrder", body: """{"SoldToParty":"1"}""");

        Assert.Equal(400, Status(result));
        Assert.Empty(rig.Sap.Calls);
    }

    [Fact]
    public async Task Retrying_a_create_with_the_same_key_replays_without_calling_sap_again()
    {
        var rig = await NewRigAsync();
        rig.Sap.OnWrite = (_, _) => Created("1234");
        const string body = """{"SoldToParty":"1000123"}""";

        var (first, _) = await rig.SendAsync("POST", "/A_SalesOrder", body: body, key: "create-1");
        var (second, response) = await rig.SendAsync("POST", "/A_SalesOrder", body: body, key: "create-1");

        Assert.Equal(201, Status(second));
        Assert.Equal(((ContentResult)first).Content, ((ContentResult)second).Content);
        Assert.Equal("true", response.Headers["Idempotent-Replayed"].ToString());
        Assert.Single(rig.Sap.Calls, c => c.Method == HttpMethod.Post);
    }

    [Fact]
    public async Task Sap_validation_error_is_returned_and_key_can_be_retried()
    {
        var rig = await NewRigAsync();
        rig.Sap.OnWrite = (_, _) => new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("""{"error":{"message":{"value":"Sold-to party 1 not defined for sales area 1010/10/00"}}}"""),
        };

        var (result, _) = await rig.SendAsync("POST", "/A_SalesOrder", body: """{"SoldToParty":"1"}""", key: "k1");

        Assert.Equal(400, Status(result));
        Assert.Contains("sales area", Message(result));
        Assert.Empty(rig.Db.GatewayWriteRecords); // SAP ยังไม่เปลี่ยนอะไร — ส่งซ้ำด้วย key เดิมได้
    }
}
