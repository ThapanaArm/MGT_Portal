using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>ทดสอบการคุยกับ SAP API_SALES_ORDER_SRV ด้วย SAP จำลอง (ไม่ต่อ SAP จริง)</summary>
public class SapSalesOrderClientTests
{
    private const string Base = "https://sap.test/sap/opu/odata/sap/API_SALES_ORDER_SRV/";

    private sealed class FakeSap : HttpMessageHandler
    {
        public List<(HttpMethod Method, string Path, string? Body, Dictionary<string, string> Headers)> Calls { get; } = [];
        public Func<HttpRequestMessage, string?, HttpResponseMessage>? OnWrite { get; set; }
        public string OrderJson { get; set; } = OrderBody("1234", ("10", null), ("20", null));

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage req, CancellationToken ct)
        {
            var body = req.Content is null ? null : await req.Content.ReadAsStringAsync(ct);
            var headers = req.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
            var path = req.RequestUri!.PathAndQuery.Replace("/sap/opu/odata/sap/API_SALES_ORDER_SRV/", "");
            Calls.Add((req.Method, Uri.UnescapeDataString(path), body, headers));

            if (req.Method == HttpMethod.Get && headers.TryGetValue("x-csrf-token", out var fetch) && fetch == "Fetch")
            {
                var res = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"d":{"results":[]}}""") };
                res.Headers.Add("x-csrf-token", "TOKEN-1");
                res.Headers.Add("Set-Cookie", "SAP_SESSIONID_X=abc; path=/; secure; HttpOnly");
                res.Headers.Add("Set-Cookie", "sap-usercontext=sap-client=100; path=/");
                return res;
            }
            if (req.Method == HttpMethod.Get)
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(OrderJson, Encoding.UTF8, "application/json") };
            return OnWrite?.Invoke(req, body) ?? new HttpResponseMessage(HttpStatusCode.NoContent);
        }
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri(Base) };
    }

    private static string OrderBody(string so, params (string Item, string? Rejection)[] items)
    {
        var list = items.Select(i => new Dictionary<string, object?>
        {
            ["__metadata"] = new { etag = $"W/\"etag-item-{i.Item}\"" },
            ["SalesOrder"] = so, ["SalesOrderItem"] = i.Item, ["Material"] = "CHM-010",
            ["RequestedQuantity"] = "1000.000", ["RequestedQuantityUnit"] = "KG", ["NetAmount"] = "208604.80",
            ["SalesDocumentRjcnReason"] = i.Rejection ?? "",
        });
        return JsonSerializer.Serialize(new
        {
            d = new Dictionary<string, object?>
            {
                ["__metadata"] = new { etag = "W/\"etag-header\"" },
                ["SalesOrder"] = so, ["SalesOrderType"] = "OR", ["SoldToParty"] = "1000123",
                ["PurchaseOrderByCustomer"] = "PO-001", ["RequestedDeliveryDate"] = "/Date(1793491200000)/",
                ["TotalNetAmount"] = "417209.60", ["TransactionCurrency"] = "THB", ["OverallSDProcessStatus"] = "A",
                ["to_Item"] = new { results = list },
            },
        });
    }

    private static SapSalesOrderClient Client(FakeSap sap, string? rejection = "Z1") =>
        new(new Factory(sap), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Sap:SalesOrganization"] = "1010",
            ["Sap:DistributionChannel"] = "10",
            ["Sap:OrganizationDivision"] = "00",
            ["Sap:RejectionReason"] = rejection,
        }).Build());

    [Fact]
    public async Task Create_fetches_csrf_then_posts_with_org_defaults_token_and_session_cookie()
    {
        var sap = new FakeSap
        {
            OnWrite = (_, _) => new HttpResponseMessage(HttpStatusCode.Created) { Content = new StringContent(OrderBody("1234", ("10", null))) },
        };

        var result = await Client(sap).CreateAsync(CredEnv.Sandbox,
            new CreateSalesOrderRequest("1000123", "PO-001", new DateOnly(2026, 11, 1), [new CreateSalesOrderItem("CHM-010", 1000, null)]), default);

        var post = sap.Calls.Single(c => c.Method == HttpMethod.Post);
        Assert.Equal("A_SalesOrder", post.Path);
        Assert.Equal("TOKEN-1", post.Headers["x-csrf-token"]);
        Assert.Equal("SAP_SESSIONID_X=abc; sap-usercontext=sap-client=100", post.Headers["Cookie"]);

        using var doc = JsonDocument.Parse(post.Body!);
        var root = doc.RootElement;
        Assert.Equal("OR", root.GetProperty("SalesOrderType").GetString());
        Assert.Equal("1010", root.GetProperty("SalesOrganization").GetString());
        Assert.Equal("/Date(1793491200000)/", root.GetProperty("RequestedDeliveryDate").GetString());
        var item = root.GetProperty("to_Item")[0];
        Assert.Equal("1000", item.GetProperty("RequestedQuantity").GetString());
        Assert.Equal("KG", item.GetProperty("RequestedQuantityUnit").GetString());

        Assert.Equal("1234", result.SalesOrder);
        Assert.Equal("2026-11-01", result.RequestedDeliveryDate);
        Assert.Equal(417209.60m, result.TotalNetAmount);
        Assert.Equal(2, result.Items.Count); // อ่านกลับจาก SAP หลังสร้าง
    }

    [Fact]
    public async Task Cancel_rejects_only_open_items_using_each_items_etag()
    {
        var sap = new FakeSap { OrderJson = OrderBody("1234", ("10", null), ("20", "Z1"), ("30", null)) };

        await Client(sap).CancelAsync(CredEnv.Sandbox, "1234", null, default);

        var patches = sap.Calls.Where(c => c.Method == HttpMethod.Patch).ToList();
        Assert.Equal(["A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='10')", "A_SalesOrderItem(SalesOrder='1234',SalesOrderItem='30')"], patches.Select(p => p.Path));
        Assert.Equal("W/\"etag-item-10\"", patches[0].Headers["If-Match"]);
        Assert.Contains("\"SalesDocumentRjcnReason\":\"Z1\"", patches[0].Body);
    }

    [Fact]
    public async Task Cancel_without_rejection_reason_is_a_configuration_error_and_writes_nothing()
    {
        var sap = new FakeSap();
        var ex = await Assert.ThrowsAsync<SapException>(() => Client(sap, rejection: null).CancelAsync(CredEnv.Sandbox, "1234", null, default));
        Assert.Equal(503, ex.StatusCode);
        Assert.True(ex.NotConfigured);
        Assert.Empty(sap.Calls);
    }

    [Fact]
    public async Task Update_with_unknown_item_fails_before_writing()
    {
        var sap = new FakeSap();
        var ex = await Assert.ThrowsAsync<SapException>(() => Client(sap).UpdateAsync(CredEnv.Sandbox, "1234",
            new UpdateSalesOrderRequest("PO-002", null, [new UpdateSalesOrderItem("90", 5)]), default));
        Assert.Equal(422, ex.StatusCode);
        Assert.False(ex.MayHaveChanged);
        Assert.DoesNotContain(sap.Calls, c => c.Method == HttpMethod.Patch);
    }

    [Fact]
    public async Task Sap_rejection_on_first_write_is_safe_to_retry_but_after_a_write_it_is_not()
    {
        var sap = new FakeSap
        {
            OnWrite = (req, _) => req.RequestUri!.AbsolutePath.Contains("SalesOrderItem='20'")
                ? new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("""{"error":{"message":{"value":"Item 20 is already delivered"}}}""") }
                : new HttpResponseMessage(HttpStatusCode.NoContent),
        };

        var ex = await Assert.ThrowsAsync<SapException>(() => Client(sap).CancelAsync(CredEnv.Sandbox, "1234", null, default));
        Assert.Equal(422, ex.StatusCode);
        Assert.True(ex.MayHaveChanged); // รายการ 10 ถูกยกเลิกไปแล้ว
        Assert.Contains("Item 20 is already delivered", ex.Message);
    }

    [Fact]
    public async Task Create_rejected_by_sap_is_safe_to_retry()
    {
        var sap = new FakeSap
        {
            OnWrite = (_, _) => new HttpResponseMessage(HttpStatusCode.BadRequest) { Content = new StringContent("""{"error":{"message":{"value":"Sold-to party 1000123 is blocked"}}}""") },
        };
        var ex = await Assert.ThrowsAsync<SapException>(() => Client(sap).CreateAsync(CredEnv.Sandbox,
            new CreateSalesOrderRequest("1000123", null, null, [new CreateSalesOrderItem("CHM-010", 1, "kg")]), default));
        Assert.Equal(422, ex.StatusCode);
        Assert.False(ex.MayHaveChanged);
        Assert.Equal("Sold-to party 1000123 is blocked", ex.Message);
    }

    [Fact]
    public async Task Sap_server_error_on_create_may_have_created_the_order()
    {
        var sap = new FakeSap { OnWrite = (_, _) => new HttpResponseMessage(HttpStatusCode.InternalServerError) };
        var ex = await Assert.ThrowsAsync<SapException>(() => Client(sap).CreateAsync(CredEnv.Sandbox,
            new CreateSalesOrderRequest("1000123", null, null, [new CreateSalesOrderItem("CHM-010", 1, null)]), default));
        Assert.Equal(502, ex.StatusCode);
        Assert.True(ex.MayHaveChanged);
    }
}
