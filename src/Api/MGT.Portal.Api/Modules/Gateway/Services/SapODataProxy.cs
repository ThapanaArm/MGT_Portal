using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.WebUtilities;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>ผลจาก SAP ที่ส่งต่อให้แอป — Body เป็น JSON ของ SAP (OData V2) ที่เปลี่ยน URL ของ SAP เป็น URL ของ Gateway แล้ว</summary>
public sealed record SapProxyResponse(int StatusCode, string Body, string ContentType, string? ETag, string? CreatedSalesOrder);

/// <summary>
/// ส่งต่อคำขอ OData ของ API_SALES_ORDER_SRV ไป SAP ตรง ๆ (passthrough) เฉพาะ operation ที่อยู่ใน SapSalesOrderOperations
/// ใช้ communication user และ HttpClient ชุดเดียวกับ SapSalesOrderClient (Sap:* / Sap:Production:*)
/// - คำขอเขียนขอ x-csrf-token + cookie ให้เอง
/// - PATCH ที่แอปไม่ส่ง If-Match: อ่าน ETag ล่าสุดจาก SAP ให้
/// - POST A_SalesOrder: เติม Sales Org / Dist. Channel / Division / Order Type จาก config (แอปส่งค่าอื่นไม่ได้)
/// - GET แบบ collection: ไม่ส่ง $top จะได้ DefaultTop แถว, สูงสุด MaxTop
/// </summary>
public class SapODataProxy(IHttpClientFactory factory, IConfiguration config)
{
    public const int DefaultTop = 100;
    public const int MaxTop = 1000;

    private static readonly string[] AllowedQueryOptions =
        ["$filter", "$select", "$expand", "$orderby", "$top", "$skip", "$inlinecount", "$skiptoken", "SalesOrder", "sap-language"];

    private static readonly (string Field, string Config, string? Default)[] OrgFields =
    [
        ("SalesOrderType", "SalesOrderType", "OR"),
        ("SalesOrganization", "SalesOrganization", null),
        ("DistributionChannel", "DistributionChannel", null),
        ("OrganizationDivision", "OrganizationDivision", null),
    ];

    /// <summary>ตรวจและปรับ query string — คืน error ถ้าใช้ option ที่ไม่รองรับหรือ $top เกิน</summary>
    public static (string? Query, string? Error) BuildQuery(SapOperation op, string? rawQuery)
    {
        var parsed = QueryHelpers.ParseQuery(rawQuery);
        var parts = new List<string>();
        foreach (var (key, values) in parsed)
        {
            if (key.Equals("$format", StringComparison.OrdinalIgnoreCase)) continue; // Gateway ตอบ JSON เสมอ
            var known = AllowedQueryOptions.FirstOrDefault(k => k.Equals(key, StringComparison.OrdinalIgnoreCase));
            if (known is null)
                return (null, $"ไม่รองรับ query option '{key}' — ใช้ได้: {string.Join(", ", AllowedQueryOptions)}");
            if (known == "$top")
            {
                if (!int.TryParse(values.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var top) || top < 0 || top > MaxTop)
                    return (null, $"$top ต้องเป็นตัวเลข 0 ถึง {MaxTop}");
            }
            foreach (var v in values)
                parts.Add($"{Uri.EscapeDataString(known)}={Uri.EscapeDataString(v ?? "")}");
        }
        if (op.IsCollection && !parsed.Keys.Any(k => k.Equals("$top", StringComparison.OrdinalIgnoreCase)))
            parts.Add($"%24top={DefaultTop}");
        return (parts.Count == 0 ? "" : "?" + string.Join("&", parts), null);
    }

    /// <summary>เติมค่าองค์กรจาก config ลง body ของ POST A_SalesOrder — คืน error ถ้าแอปส่งค่าที่ไม่ตรง</summary>
    public string? ApplyOrgDefaults(string env, JsonObject body)
    {
        var section = SapSalesOrderClient.ConfigSection(env);
        var missing = new List<string>();
        foreach (var (field, key, fallback) in OrgFields)
        {
            var expected = config[$"{section}:{key}"] is { Length: > 0 } v ? v.Trim() : fallback;
            if (expected is null) { missing.Add($"{section}:{key}"); continue; }

            var sent = body[field] is JsonValue jv && jv.TryGetValue<string>(out var s) ? s.Trim() : null;
            if (!string.IsNullOrEmpty(sent) && !string.Equals(sent, expected, StringComparison.OrdinalIgnoreCase))
                return $"{field} ถูกกำหนดโดย Gateway ({expected}) ไม่ต้องส่ง หรือส่งค่าเดียวกัน";
            body[field] = expected;
        }
        if (missing.Count > 0)
            throw new SapException(503, "ยังไม่ได้ตั้งค่า " + string.Join(", ", missing), notConfigured: true);
        return null;
    }

    public async Task<SapProxyResponse> ReadAsync(string env, string path, string query, string publicBase, CancellationToken ct)
    {
        var http = Client(env);
        var isMetadata = path.Equals(SapSalesOrderOperations.Metadata.Template, StringComparison.OrdinalIgnoreCase);
        using var req = new HttpRequestMessage(HttpMethod.Get, Relative(path) + query);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(isMetadata ? "application/xml" : "application/json"));
        using var res = await SapSalesOrderClient.SendAsync(http, req, mayHaveChanged: false, ct);
        if (!res.IsSuccessStatusCode)
            throw await ToExceptionAsync(res, mayHaveChanged: false, ct);
        return await ToResponseAsync(http, res, publicBase, created: false, ct);
    }

    public async Task<SapProxyResponse> WriteAsync(
        string env, HttpMethod method, string path, string query, JsonNode? body, string? ifMatch, string publicBase,
        bool isCreateOrder, CancellationToken ct)
    {
        var http = Client(env);
        var session = await SapSalesOrderClient.FetchCsrfAsync(http, ct);

        if (method == HttpMethod.Patch && string.IsNullOrWhiteSpace(ifMatch))
            ifMatch = await CurrentETagAsync(http, path, ct);

        using var req = new HttpRequestMessage(method, Relative(path) + query);
        if (body is not null)
            req.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        req.Headers.Add("x-csrf-token", session.Token);
        if (session.Cookies.Length > 0) req.Headers.Add("Cookie", session.Cookies);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrWhiteSpace(ifMatch)) req.Headers.TryAddWithoutValidation("If-Match", ifMatch);

        using var res = await SapSalesOrderClient.SendAsync(http, req, mayHaveChanged: true, ct);
        if (!res.IsSuccessStatusCode)
            throw await ToExceptionAsync(res, mayHaveChanged: (int)res.StatusCode >= 500, ct);
        return await ToResponseAsync(http, res, publicBase, isCreateOrder, ct);
    }

    // ---- ภายใน ----

    private HttpClient Client(string env)
    {
        var http = factory.CreateClient(SapSalesOrderClient.HttpClientName(env));
        if (http.BaseAddress is null)
            throw new SapException(503, $"ยังไม่ได้ตั้งค่า {SapSalesOrderClient.ConfigSection(env)}:Url / User / Password", notConfigured: true);
        return http;
    }

    /// <summary>path จาก Gateway ขึ้นต้นด้วย / แต่ BaseAddress ของ SAP ลงท้ายด้วย /API_SALES_ORDER_SRV/ จึงตัด / หน้าออก</summary>
    private static string Relative(string path) => path.TrimStart('/');

    private static async Task<string?> CurrentETagAsync(HttpClient http, string path, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, Relative(path));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var res = await SapSalesOrderClient.SendAsync(http, req, mayHaveChanged: false, ct);
        if (!res.IsSuccessStatusCode)
            throw await ToExceptionAsync(res, mayHaveChanged: false, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        try
        {
            using var doc = JsonDocument.Parse(text);
            var d = doc.RootElement.TryGetProperty("d", out var inner) ? inner : doc.RootElement;
            if (d.TryGetProperty("__metadata", out var meta) && meta.TryGetProperty("etag", out var etag) && etag.GetString() is { Length: > 0 } e)
                return e;
        }
        catch (JsonException) { }
        return res.Headers.ETag?.ToString();
    }

    private static async Task<SapProxyResponse> ToResponseAsync(
        HttpClient http, HttpResponseMessage res, string publicBase, bool created, CancellationToken ct)
    {
        var text = res.Content is null ? "" : await res.Content.ReadAsStringAsync(ct);
        // ซ่อน URL ของ SAP — __metadata.uri และ __next ชี้กลับมาที่ Gateway แทน
        var sapBase = http.BaseAddress!.AbsoluteUri;
        if (text.Length > 0) text = text.Replace(sapBase, publicBase, StringComparison.OrdinalIgnoreCase);

        string? createdSo = null;
        if (created && text.Length > 0)
        {
            try
            {
                using var doc = JsonDocument.Parse(text);
                var d = doc.RootElement.TryGetProperty("d", out var inner) ? inner : doc.RootElement;
                if (d.TryGetProperty("SalesOrder", out var so) && so.ValueKind == JsonValueKind.String) createdSo = so.GetString();
            }
            catch (JsonException) { }
            if (createdSo is null)
                throw new SapException(502, "SAP สร้าง Sales Order แล้วแต่ไม่ได้ส่งเลขที่ SO กลับมา", mayHaveChanged: true);
        }

        var contentType = res.Content?.Headers.ContentType?.MediaType ?? "application/json";
        return new SapProxyResponse((int)res.StatusCode, text, contentType, res.Headers.ETag?.ToString(), createdSo);
    }

    /// <summary>
    /// ส่ง status ของ SAP ต่อให้แอปตามจริงสำหรับ 4xx ที่เป็นความผิดของคำขอ (400 / 404 / 409 / 412 / 428)
    /// ส่วน 401/403 คือ communication user ของ Gateway มีปัญหา และ 5xx คือ SAP ล้ม → 502
    /// </summary>
    private static async Task<SapException> ToExceptionAsync(HttpResponseMessage res, bool mayHaveChanged, CancellationToken ct)
    {
        var body = await res.Content.ReadAsStringAsync(ct);
        var sap = SapOData.ErrorMessage(body);
        return res.StatusCode switch
        {
            HttpStatusCode.BadRequest => new SapException(400, sap ?? "SAP ไม่รับคำขอนี้", mayHaveChanged),
            HttpStatusCode.NotFound => new SapException(404, sap ?? "ไม่พบข้อมูลนี้ใน SAP", mayHaveChanged),
            HttpStatusCode.Conflict => new SapException(409, sap ?? "ข้อมูลขัดแย้งกับที่มีใน SAP", mayHaveChanged),
            HttpStatusCode.PreconditionFailed or HttpStatusCode.PreconditionRequired =>
                new SapException(409, "ข้อมูลถูกแก้ใน SAP ระหว่างนี้ (ETag ไม่ตรง) อ่านใหม่แล้วส่งอีกครั้ง", mayHaveChanged),
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                new SapException(502, "SAP ปฏิเสธ communication user ของ Gateway (ตรวจ User/Password และ Communication Arrangement)" + (sap is null ? "" : ": " + sap), mayHaveChanged),
            _ => new SapException(502, $"SAP ตอบ {(int)res.StatusCode}" + (sap is null ? "" : ": " + sap), mayHaveChanged),
        };
    }
}
