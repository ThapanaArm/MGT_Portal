using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// SAP ตอบไม่สำเร็จ หรือยังไม่ได้ตั้งค่า — StatusCode คือ status ที่ Gateway จะตอบแอป
/// MayHaveChanged = true เมื่อ SAP อาจเปลี่ยนข้อมูลไปแล้ว (timeout หลังส่ง, 5xx, หรือพังกลางทางหลังเขียนไปบางส่วน)
/// ถ้า false แปลว่า SAP ยังไม่ได้เปลี่ยนอะไร ส่งซ้ำด้วย Idempotency-Key เดิมได้
/// </summary>
public class SapException(int statusCode, string message, bool mayHaveChanged = false, bool notConfigured = false)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public bool MayHaveChanged { get; } = mayHaveChanged;
    public bool NotConfigured { get; } = notConfigured;

    public SapException AsMayHaveChanged() =>
        MayHaveChanged ? this : new SapException(StatusCode,
            Message + " — คำขอนี้เขียนเข้า SAP ไปแล้วบางส่วน ตรวจ Sales Order ใน SAP ก่อนส่งใหม่", true, NotConfigured);
}

/// <summary>ค่าองค์กรใน SAP ที่ Gateway เติมให้ทุก Sales Order ของ env นั้น</summary>
public sealed record SapOrgDefaults(
    string SalesOrderType, string SalesOrganization, string DistributionChannel, string OrganizationDivision,
    string? RejectionReason);

/// <summary>แปลงค่ารูปแบบ OData V2 ของ SAP</summary>
public static partial class SapOData
{
    /// <summary>"/Date(1730419200000)/" → "2024-11-01"</summary>
    public static string? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var m = ODataDate().Match(value);
        if (!m.Success) return value;
        var ms = long.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        return DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    /// <summary>2024-11-01 → "/Date(1730419200000)/" (Edm.DateTime ของ OData V2 เป็นเวลา UTC เที่ยงคืน)</summary>
    public static string ToDate(DateOnly date)
    {
        var ms = new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).ToUnixTimeMilliseconds();
        return $"/Date({ms.ToString(CultureInfo.InvariantCulture)})/";
    }

    /// <summary>Edm.Decimal ใน OData V2 JSON เป็น string เช่น "1000.000"</summary>
    public static decimal? ParseDecimal(string? value) =>
        decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : null;

    /// <summary>เลขรายการใน SAP อาจมาเป็น "10" หรือ "000010" — เทียบกันด้วยค่าที่ตัดเลขศูนย์นำหน้าแล้ว</summary>
    public static string NormalizeItem(string item) => item.TrimStart('0') is { Length: > 0 } s ? s : "0";

    /// <summary>ดึงข้อความ error จาก body ของ SAP เช่น {"error":{"message":{"value":"..."}}}</summary>
    public static string? ErrorMessage(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("error", out var error)) return null;
            var messages = new List<string>();
            if (error.TryGetProperty("message", out var msg))
            {
                var text = msg.ValueKind switch
                {
                    JsonValueKind.Object when msg.TryGetProperty("value", out var v) && v.ValueKind == JsonValueKind.String => v.GetString(),
                    JsonValueKind.String => msg.GetString(),
                    _ => null,
                };
                if (!string.IsNullOrWhiteSpace(text)) messages.Add(text);
            }
            if (error.TryGetProperty("innererror", out var inner) &&
                inner.TryGetProperty("errordetails", out var details) && details.ValueKind == JsonValueKind.Array)
            {
                foreach (var d in details.EnumerateArray().Take(5))
                    if (d.TryGetProperty("message", out var dm) && dm.ValueKind == JsonValueKind.String && dm.GetString() is { Length: > 0 } t && !messages.Contains(t))
                        messages.Add(t);
            }
            return messages.Count == 0 ? null : string.Join(" | ", messages);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    [GeneratedRegex(@"/Date\((-?\d+)(?:[+-]\d+)?\)/")]
    private static partial Regex ODataDate();
}

/// <summary>
/// เขียน Sales Order เข้า SAP S/4HANA Cloud ผ่าน API_SALES_ORDER_SRV (OData V2, Communication Arrangement SAP_COM_0109)
///   sandbox    : Sap:Url / Sap:User / Sap:Password  (SAP UAT / Test tenant)
///   production : Sap:Production:Url / Sap:Production:User / Sap:Production:Password
/// ทุกการเขียนต้องขอ x-csrf-token ก่อน และใช้ cookie ของ session เดียวกัน การแก้ใช้ ETag (If-Match) ที่อ่านล่าสุด
/// </summary>
public class SapSalesOrderClient(IHttpClientFactory factory, IConfiguration config)
{
    public const string ServicePath = "sap/opu/odata/sap/API_SALES_ORDER_SRV/";
    public static string HttpClientName(string env) => $"sap-{env}";
    public static string ConfigSection(string env) => env == CredEnv.Production ? "Sap:Production" : "Sap";

    private static readonly MediaTypeWithQualityHeaderValue Json = new("application/json");

    internal sealed record SapSession(string Token, string Cookies);
    private sealed record SapOrder(JsonElement Entity, string? ETag);

    public async Task<SalesOrderResult> CreateAsync(string env, CreateSalesOrderRequest req, CancellationToken ct)
    {
        var (http, org) = Resolve(env);
        var session = await FetchCsrfAsync(http, ct);

        var body = new JsonObject
        {
            ["SalesOrderType"] = org.SalesOrderType,
            ["SalesOrganization"] = org.SalesOrganization,
            ["DistributionChannel"] = org.DistributionChannel,
            ["OrganizationDivision"] = org.OrganizationDivision,
            ["SoldToParty"] = req.SoldToParty.Trim(),
        };
        if (!string.IsNullOrWhiteSpace(req.CustomerPurchaseOrder)) body["PurchaseOrderByCustomer"] = req.CustomerPurchaseOrder.Trim();
        if (req.RequestedDeliveryDate is DateOnly date) body["RequestedDeliveryDate"] = SapOData.ToDate(date);

        var items = new JsonArray();
        foreach (var item in req.Items)
        {
            items.Add(new JsonObject
            {
                ["Material"] = item.ProductCode.Trim(),
                ["RequestedQuantity"] = item.Quantity.ToString(CultureInfo.InvariantCulture),
                ["RequestedQuantityUnit"] = string.IsNullOrWhiteSpace(item.Unit) ? "KG" : item.Unit.Trim().ToUpperInvariant(),
            });
        }
        body["to_Item"] = items;

        string salesOrder;
        JsonElement created;
        using (var res = await WriteAsync(http, session, HttpMethod.Post, "A_SalesOrder", body, null, ct))
        {
            created = await ReadEntityAsync(res, ct);
            salesOrder = Str(created, "SalesOrder") ?? throw new SapException(502, "SAP สร้าง Sales Order แล้วแต่ไม่ได้ส่งเลขที่ SO กลับมา", mayHaveChanged: true);
        }

        // SO ถูกสร้างแล้ว — ถ้าอ่านซ้ำไม่สำเร็จก็ยังต้องตอบสำเร็จ ใช้ข้อมูลจากคำตอบของการสร้างแทน
        try
        {
            return Map((await GetAsync(http, salesOrder, ct)).Entity);
        }
        catch (SapException)
        {
            return Map(created);
        }
    }

    public async Task<SalesOrderResult> UpdateAsync(string env, string salesOrder, UpdateSalesOrderRequest req, CancellationToken ct)
    {
        var (http, _) = Resolve(env);
        var session = await FetchCsrfAsync(http, ct);
        var current = await GetAsync(http, salesOrder, ct);

        // ตรวจเลขรายการทั้งหมดก่อนเขียนอะไรลง SAP จะได้ไม่แก้ไปครึ่งเดียว
        var itemChanges = req.Items ?? [];
        var existing = Items(current.Entity).ToDictionary(i => SapOData.NormalizeItem(i.Item));
        var missing = itemChanges.Where(i => !existing.ContainsKey(SapOData.NormalizeItem(i.Item))).Select(i => i.Item).ToList();
        if (missing.Count > 0)
            throw new SapException(422, $"ไม่พบรายการ {string.Join(", ", missing)} ใน Sales Order {salesOrder}");

        var writes = 0;
        try
        {
            if (req.HasHeaderChanges)
            {
                var header = new JsonObject();
                if (req.CustomerPurchaseOrder is not null) header["PurchaseOrderByCustomer"] = req.CustomerPurchaseOrder.Trim();
                if (req.RequestedDeliveryDate is DateOnly date) header["RequestedDeliveryDate"] = SapOData.ToDate(date);
                using (await WriteAsync(http, session, HttpMethod.Patch, OrderPath(salesOrder), header, current.ETag, ct)) { }
                writes++;
                current = await GetAsync(http, salesOrder, ct);
                existing = Items(current.Entity).ToDictionary(i => SapOData.NormalizeItem(i.Item));
            }

            foreach (var change in itemChanges)
            {
                var item = existing[SapOData.NormalizeItem(change.Item)];
                var patch = new JsonObject { ["RequestedQuantity"] = change.Quantity.ToString(CultureInfo.InvariantCulture) };
                using (await WriteAsync(http, session, HttpMethod.Patch, ItemPath(salesOrder, item.Item), patch, item.ETag, ct)) { }
                writes++;
            }
        }
        catch (SapException ex) when (writes > 0)
        {
            throw ex.AsMayHaveChanged();
        }

        return await ReadBackAsync(http, salesOrder, ct);
    }

    public async Task<SalesOrderResult> CancelAsync(string env, string salesOrder, string? reasonCode, CancellationToken ct)
    {
        var (http, org) = Resolve(env);
        var reason = string.IsNullOrWhiteSpace(reasonCode) ? org.RejectionReason : reasonCode.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new SapException(503, $"ยังไม่ได้ตั้งค่า {ConfigSection(env)}:RejectionReason (รหัสเหตุผลการปฏิเสธที่ใช้ยกเลิก SO)", notConfigured: true);

        var session = await FetchCsrfAsync(http, ct);
        var current = await GetAsync(http, salesOrder, ct);

        var writes = 0;
        try
        {
            // รายการที่ถูกปฏิเสธไปแล้วไม่ต้องแก้ซ้ำ — ยกเลิกซ้ำจึงได้ผลเดิม
            foreach (var item in Items(current.Entity).Where(i => string.IsNullOrWhiteSpace(i.RejectionReason)))
            {
                var patch = new JsonObject { ["SalesDocumentRjcnReason"] = reason };
                using (await WriteAsync(http, session, HttpMethod.Patch, ItemPath(salesOrder, item.Item), patch, item.ETag, ct)) { }
                writes++;
            }
        }
        catch (SapException ex) when (writes > 0)
        {
            throw ex.AsMayHaveChanged();
        }

        return await ReadBackAsync(http, salesOrder, ct);
    }

    // ---- ภายใน ----

    private (HttpClient Http, SapOrgDefaults Org) Resolve(string env)
    {
        var section = ConfigSection(env);
        var http = factory.CreateClient(HttpClientName(env));
        if (http.BaseAddress is null)
            throw new SapException(503, $"ยังไม่ได้ตั้งค่า {section}:Url / User / Password", notConfigured: true);

        string? Get(string key) => config[$"{section}:{key}"] is { Length: > 0 } v ? v.Trim() : null;
        var org = new SapOrgDefaults(
            Get("SalesOrderType") ?? "OR",
            Get("SalesOrganization") ?? "",
            Get("DistributionChannel") ?? "",
            Get("OrganizationDivision") ?? "",
            Get("RejectionReason"));

        var missing = new[] { ("SalesOrganization", org.SalesOrganization), ("DistributionChannel", org.DistributionChannel), ("OrganizationDivision", org.OrganizationDivision) }
            .Where(p => p.Item2.Length == 0).Select(p => $"{section}:{p.Item1}").ToList();
        if (missing.Count > 0)
            throw new SapException(503, "ยังไม่ได้ตั้งค่า " + string.Join(", ", missing), notConfigured: true);

        return (http, org);
    }

    private static string OrderPath(string salesOrder) => $"A_SalesOrder('{salesOrder}')";
    private static string ItemPath(string salesOrder, string item) => $"A_SalesOrderItem(SalesOrder='{salesOrder}',SalesOrderItem='{item}')";

    private async Task<SalesOrderResult> ReadBackAsync(HttpClient http, string salesOrder, CancellationToken ct)
    {
        try
        {
            return Map((await GetAsync(http, salesOrder, ct)).Entity);
        }
        catch (SapException ex)
        {
            // เขียนสำเร็จไปแล้ว แต่อ่านกลับไม่ได้ — ห้ามบอกแอปว่าล้มเหลว
            throw new SapException(502, "บันทึกใน SAP สำเร็จแต่อ่านข้อมูลล่าสุดกลับมาไม่ได้: " + ex.Message, mayHaveChanged: true);
        }
    }

    internal static async Task<SapSession> FetchCsrfAsync(HttpClient http, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "A_SalesOrder?$top=0");
        req.Headers.Add("x-csrf-token", "Fetch");
        req.Headers.Accept.Add(Json);
        using var res = await SendAsync(http, req, mayHaveChanged: false, ct);
        if (!res.IsSuccessStatusCode)
            throw await ToExceptionAsync(res, mayHaveChanged: false, ct);

        var token = res.Headers.TryGetValues("x-csrf-token", out var t) ? t.FirstOrDefault() : null;
        if (string.IsNullOrWhiteSpace(token))
            throw new SapException(502, "SAP ไม่ส่ง x-csrf-token กลับมา ตรวจสิทธิ์ของ communication user");

        var cookies = res.Headers.TryGetValues("Set-Cookie", out var c)
            ? string.Join("; ", c.Select(v => v.Split(';', 2)[0].Trim()))
            : "";
        return new SapSession(token, cookies);
    }

    private static async Task<SapOrder> GetAsync(HttpClient http, string salesOrder, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, OrderPath(salesOrder) + "?$expand=to_Item");
        req.Headers.Accept.Add(Json);
        using var res = await SendAsync(http, req, mayHaveChanged: false, ct);
        if (!res.IsSuccessStatusCode)
            throw await ToExceptionAsync(res, mayHaveChanged: false, ct);
        var entity = await ReadEntityAsync(res, ct);
        return new SapOrder(entity, ETagOf(entity) ?? res.Headers.ETag?.ToString());
    }

    private static async Task<HttpResponseMessage> WriteAsync(
        HttpClient http, SapSession session, HttpMethod method, string path, JsonNode body, string? etag, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(method, path)
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("x-csrf-token", session.Token);
        if (session.Cookies.Length > 0) req.Headers.Add("Cookie", session.Cookies);
        req.Headers.Accept.Add(Json);
        if (etag is not null) req.Headers.TryAddWithoutValidation("If-Match", etag);

        var res = await SendAsync(http, req, mayHaveChanged: true, ct);
        if (res.IsSuccessStatusCode) return res;
        using (res)
            throw await ToExceptionAsync(res, mayHaveChanged: (int)res.StatusCode >= 500, ct);
    }

    internal static async Task<HttpResponseMessage> SendAsync(HttpClient http, HttpRequestMessage req, bool mayHaveChanged, CancellationToken ct)
    {
        try
        {
            return await http.SendAsync(req, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new SapException(504, mayHaveChanged
                ? "SAP ไม่ตอบภายในเวลาที่กำหนด — คำขออาจถูกบันทึกแล้ว ตรวจใน SAP ก่อนส่งใหม่"
                : "SAP ไม่ตอบภายในเวลาที่กำหนด", mayHaveChanged);
        }
        catch (HttpRequestException ex)
        {
            throw new SapException(502, "เชื่อมต่อ SAP ไม่ได้: " + ex.Message, mayHaveChanged);
        }
    }

    private static async Task<SapException> ToExceptionAsync(HttpResponseMessage res, bool mayHaveChanged, CancellationToken ct)
    {
        var body = await res.Content.ReadAsStringAsync(ct);
        var sap = SapOData.ErrorMessage(body);
        return res.StatusCode switch
        {
            HttpStatusCode.BadRequest => new SapException(422, sap ?? "SAP ไม่รับข้อมูลนี้", mayHaveChanged),
            HttpStatusCode.NotFound => new SapException(404, "ไม่พบ Sales Order นี้ใน SAP", mayHaveChanged),
            HttpStatusCode.PreconditionFailed or HttpStatusCode.PreconditionRequired =>
                new SapException(409, "Sales Order ถูกแก้ใน SAP ระหว่างนี้ ลองส่งใหม่อีกครั้ง", mayHaveChanged),
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                new SapException(502, "SAP ปฏิเสธ communication user ของ Gateway (ตรวจ User/Password และ Communication Arrangement)" + (sap is null ? "" : ": " + sap), mayHaveChanged),
            _ => new SapException(502, $"SAP ตอบ {(int)res.StatusCode}" + (sap is null ? "" : ": " + sap), mayHaveChanged),
        };
    }

    /// <summary>OData V2 ห่อผลไว้ใน {"d": {...}}</summary>
    private static async Task<JsonElement> ReadEntityAsync(HttpResponseMessage res, CancellationToken ct)
    {
        var text = await res.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(text);
        var root = doc.RootElement.TryGetProperty("d", out var d) ? d : doc.RootElement;
        return root.Clone();
    }

    private sealed record SapItem(string Item, string? ETag, string? RejectionReason, JsonElement Entity);

    private static IEnumerable<SapItem> Items(JsonElement order)
    {
        if (!order.TryGetProperty("to_Item", out var nav)) yield break;
        var list = nav.ValueKind == JsonValueKind.Object && nav.TryGetProperty("results", out var r) ? r : nav;
        if (list.ValueKind != JsonValueKind.Array) yield break;
        foreach (var item in list.EnumerateArray())
            if (Str(item, "SalesOrderItem") is { } number)
                yield return new SapItem(number, ETagOf(item), Str(item, "SalesDocumentRjcnReason"), item);
    }

    private static SalesOrderResult Map(JsonElement order) => new(
        Str(order, "SalesOrder") ?? "",
        Str(order, "SalesOrderType"),
        Str(order, "SoldToParty"),
        Str(order, "PurchaseOrderByCustomer"),
        SapOData.ParseDate(Str(order, "RequestedDeliveryDate")),
        SapOData.ParseDecimal(Str(order, "TotalNetAmount")),
        Str(order, "TransactionCurrency"),
        Str(order, "OverallSDProcessStatus"),
        Items(order).Select(i => new SalesOrderItemResult(
            i.Item,
            Str(i.Entity, "Material"),
            SapOData.ParseDecimal(Str(i.Entity, "RequestedQuantity")),
            Str(i.Entity, "RequestedQuantityUnit"),
            SapOData.ParseDecimal(Str(i.Entity, "NetAmount")),
            i.RejectionReason is { Length: > 0 } reason ? reason : null)).ToList());

    private static string? ETagOf(JsonElement entity) =>
        entity.TryGetProperty("__metadata", out var meta) && meta.TryGetProperty("etag", out var etag) ? etag.GetString() : null;

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) ? v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        } : null;
}
