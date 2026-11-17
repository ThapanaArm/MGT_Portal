using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>Idempotency-Key ของคำขอเขียนผ่าน Gateway และการแปลงค่า OData V2 ของ SAP</summary>
public class GatewayWriteTests
{
    [Fact]
    public async Task Replay_cannot_disclose_another_users_write_response()
    {
        await using var db = NewDb();
        var http = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        var accessor = new Microsoft.AspNetCore.Http.HttpContextAccessor { HttpContext = http };
        var idempotency = new GatewayIdempotency(db, accessor);
        var hash = GatewayIdempotency.Hash(GatewayWriteOperation.CreateSalesOrder, null, Order(1));
        http.Items[GatewayUserPermissionFilter.UserIdItem] = 10;
        var first = await idempotency.BeginAsync(Caller, GatewayWriteOperation.CreateSalesOrder, "shared-key", null, hash, default);
        Assert.Equal(10, first.Record.RequestUserId);
        await idempotency.CompleteAsync(first.Record, 201, new { salesOrder = "123" }, "123");
        http.Items[GatewayUserPermissionFilter.UserIdItem] = 20;
        var other = await idempotency.BeginAsync(Caller, GatewayWriteOperation.CreateSalesOrder, "shared-key", null, hash, default);
        Assert.Equal(WriteStartKind.KeyReused, other.Kind);
        http.Items[GatewayUserPermissionFilter.UserIdItem] = 10;
        Assert.Equal(WriteStartKind.Replay, (await idempotency.BeginAsync(Caller, GatewayWriteOperation.CreateSalesOrder, "shared-key", null, hash, default)).Kind);
    }
    private static readonly GatewayCaller Caller = new(7, "Sales Mobile App", CredEnv.Sandbox);

    private static PortalDbContext NewDb() => new(new DbContextOptionsBuilder<PortalDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static CreateSalesOrderRequest Order(decimal qty = 1000) =>
        new("1000123", "PO-001", new DateOnly(2026, 11, 1), [new CreateSalesOrderItem("CHM-010", qty, "KG")]);

    [Fact]
    public async Task New_key_starts_and_same_request_replays_after_completion()
    {
        await using var db = NewDb();
        var idem = new GatewayIdempotency(db);
        var hash = GatewayIdempotency.Hash(GatewayWriteOperation.CreateSalesOrder, null, Order());

        var first = await idem.BeginAsync(Caller, GatewayWriteOperation.CreateSalesOrder, "key-1", null, hash, default);
        Assert.Equal(WriteStartKind.Started, first.Kind);

        var during = await idem.BeginAsync(Caller, GatewayWriteOperation.CreateSalesOrder, "key-1", null, hash, default);
        Assert.Equal(WriteStartKind.InProgress, during.Kind);

        await idem.CompleteAsync(first.Record, 201, new { data = new { salesOrder = "1234" } }, "1234");
        var again = await idem.BeginAsync(Caller, GatewayWriteOperation.CreateSalesOrder, "key-1", null, hash, default);
        Assert.Equal(WriteStartKind.Replay, again.Kind);
        Assert.Contains("1234", again.Record.ResponseJson);
    }

    [Fact]
    public async Task Same_key_with_different_body_is_rejected()
    {
        await using var db = NewDb();
        var idem = new GatewayIdempotency(db);
        var op = GatewayWriteOperation.CreateSalesOrder;

        await idem.BeginAsync(Caller, op, "key-1", null, GatewayIdempotency.Hash(op, null, Order(1000)), default);
        var other = await idem.BeginAsync(Caller, op, "key-1", null, GatewayIdempotency.Hash(op, null, Order(2000)), default);

        Assert.Equal(WriteStartKind.KeyReused, other.Kind);
    }

    [Fact]
    public async Task Keys_are_scoped_per_application_and_env()
    {
        await using var db = NewDb();
        var idem = new GatewayIdempotency(db);
        var op = GatewayWriteOperation.CreateSalesOrder;
        var hash = GatewayIdempotency.Hash(op, null, Order());

        await idem.BeginAsync(Caller, op, "key-1", null, hash, default);
        var otherApp = await idem.BeginAsync(Caller with { ApplicationId = 8 }, op, "key-1", null, hash, default);
        var otherEnv = await idem.BeginAsync(Caller with { Env = CredEnv.Production }, op, "key-1", null, hash, default);

        Assert.Equal(WriteStartKind.Started, otherApp.Kind);
        Assert.Equal(WriteStartKind.Started, otherEnv.Kind);
    }

    [Fact]
    public async Task Abandoned_key_can_be_retried()
    {
        await using var db = NewDb();
        var idem = new GatewayIdempotency(db);
        var op = GatewayWriteOperation.CreateSalesOrder;
        var hash = GatewayIdempotency.Hash(op, null, Order());

        var first = await idem.BeginAsync(Caller, op, "key-1", null, hash, default);
        await idem.AbandonAsync(first.Record);
        var retry = await idem.BeginAsync(Caller, op, "key-1", null, hash, default);

        Assert.Equal(WriteStartKind.Started, retry.Kind);
    }

    [Fact]
    public async Task Only_the_creating_app_in_the_same_env_may_change_an_order()
    {
        await using var db = NewDb();
        var idem = new GatewayIdempotency(db);
        var op = GatewayWriteOperation.CreateSalesOrder;
        var start = await idem.BeginAsync(Caller, op, "key-1", null, GatewayIdempotency.Hash(op, null, Order()), default);
        await idem.CompleteAsync(start.Record, 201, new { }, "1234");

        Assert.True(await idem.CreatedByAsync(Caller, "1234", default));
        Assert.False(await idem.CreatedByAsync(Caller with { ApplicationId = 8 }, "1234", default));
        Assert.False(await idem.CreatedByAsync(Caller with { Env = CredEnv.Production }, "1234", default));
        Assert.False(await idem.CreatedByAsync(Caller, "9999", default));
    }

    [Fact]
    public async Task Failed_create_does_not_grant_change_rights()
    {
        await using var db = NewDb();
        var idem = new GatewayIdempotency(db);
        var op = GatewayWriteOperation.CreateSalesOrder;
        var start = await idem.BeginAsync(Caller, op, "key-1", null, GatewayIdempotency.Hash(op, null, Order()), default);
        await idem.CompleteAsync(start.Record, 504, new { message = "timeout" }, "1234");

        Assert.False(await idem.CreatedByAsync(Caller, "1234", default));
    }

    [Theory]
    [InlineData("/Date(1793491200000)/", "2026-11-01")]
    [InlineData("/Date(1793491200000+0000)/", "2026-11-01")]
    [InlineData(null, null)]
    public void Parses_odata_v2_dates(string? raw, string? expected) =>
        Assert.Equal(expected, SapOData.ParseDate(raw));

    [Fact]
    public void Writes_odata_v2_dates_as_utc_midnight() =>
        Assert.Equal("/Date(1793491200000)/", SapOData.ToDate(new DateOnly(2026, 11, 1)));

    [Theory]
    [InlineData("10", "10")]
    [InlineData("000010", "10")]
    [InlineData("0", "0")]
    public void Normalizes_item_numbers(string raw, string expected) =>
        Assert.Equal(expected, SapOData.NormalizeItem(raw));

    [Fact]
    public void Reads_sap_error_messages()
    {
        const string body = """{"error":{"code":"V1/320","message":{"lang":"en","value":"Material CHM-999 does not exist"},"innererror":{"errordetails":[{"message":"Material CHM-999 does not exist"},{"message":"Sold-to party 1000123 is blocked"}]}}}""";
        Assert.Equal("Material CHM-999 does not exist | Sold-to party 1000123 is blocked", SapOData.ErrorMessage(body));
        Assert.Null(SapOData.ErrorMessage("<html>gateway error</html>"));
    }
}
