using System.Net;
using Microsoft.Extensions.Configuration;
using MGT.Portal.Api.Modules.Gateway;

namespace MGT.Portal.UnitTests;

/// <summary>
/// SaleOrder ย้ายไปอยู่ schema saleorder_data ของ Supabase — Gateway ต้องบอก PostgREST ด้วย header Accept-Profile
/// และอ่านคอลัมน์เจ้าของ / Sale group กลับมาด้วย
/// </summary>
public class SupabaseSaleOrderClientTests
{
    private sealed class Capture : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }
        public string Body { get; init; } = "[]";

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            var res = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(Body, System.Text.Encoding.UTF8, "application/json") };
            res.Content.Headers.TryAddWithoutValidation("Content-Range", "0-0/1");
            return Task.FromResult(res);
        }
    }

    private sealed class Factory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri("https://example.supabase.co/rest/v1/") };
    }

    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    private static readonly SaleOrderQuery AnyQuery = new(null, null, null, null, 50, 0);

    [Fact]
    public async Task Reads_the_configured_schema_and_table()
    {
        var http = new Capture();
        var client = new SupabaseSaleOrderClient(new Factory(http),
            Config(("Gateway:SaleOrder:Schema", "saleorder_data"), ("Gateway:SaleOrder:Table", "SaleOrder")));

        await client.ListAsync("sandbox", AnyQuery, CancellationToken.None);

        Assert.Equal("/rest/v1/SaleOrder", http.Request!.RequestUri!.AbsolutePath);
        Assert.Equal("saleorder_data", Assert.Single(http.Request.Headers.GetValues("Accept-Profile")));
    }

    [Fact]
    public async Task Without_a_schema_no_profile_header_is_sent()
    {
        var http = new Capture();
        await new SupabaseSaleOrderClient(new Factory(http)).ListAsync("sandbox", AnyQuery, CancellationToken.None);

        Assert.False(http.Request!.Headers.Contains("Accept-Profile"));
    }

    [Theory]
    [InlineData("Gateway:SaleOrder:Schema", "saleorder_data;drop")]
    [InlineData("Gateway:SaleOrder:Table", "SaleOrder?select=*")]
    public async Task Rejects_names_that_are_not_identifiers(string key, string value)
    {
        var client = new SupabaseSaleOrderClient(new Factory(new Capture()), Config((key, value)));

        var ex = await Assert.ThrowsAsync<SupabaseException>(() => client.ListAsync("sandbox", AnyQuery, CancellationToken.None));
        Assert.True(ex.NotConfigured);
    }

    [Fact]
    public async Task Returns_owner_and_sale_group()
    {
        var http = new Capture
        {
            Body = """
                   [{"Transaction_ID":"TST-000001","Invoice_Date":"2025-08-23","Year":2025,"Customer_Name":"Test Customer 15 Co., Ltd.",
                     "Product_Code":"CH-2001","Chemical_Name":"Citric Acid Anhydrous","Chemical_Category":"Food Additive","Quantity_kg":500,
                     "Sales_Amount_THB":22725.00,"Gross_Profit_THB":4545.00,"Owner_Id":"90000105","Sales_Employee_Name":"Test Sales Rep B","Group_Key":"SG-FOOD"}]
                   """,
        };
        var client = new SupabaseSaleOrderClient(new Factory(http));

        var (rows, total) = await client.ListAsync("sandbox", AnyQuery, CancellationToken.None);

        var row = Assert.Single(rows);
        Assert.Equal(("90000105", "Test Sales Rep B", "SG-FOOD"), (row.SalesEmployeeId, row.SalesEmployeeName, row.SaleGroup));
        Assert.Equal(1, total);
        Assert.Contains("Owner_Id:Sales_Employee_Id", Uri.UnescapeDataString(http.Request!.RequestUri!.AbsoluteUri));
    }
}
