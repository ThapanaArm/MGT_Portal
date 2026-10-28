using System.Text.Json.Serialization;

namespace MGT.Portal.Api.Modules.Gateway;

public sealed record SaleOrderQuery(int? Year, string? Customer, string? ProductCode, string? Category, int Limit, int Offset);

public sealed record SaleOrderDto(
    string? TransactionId, string? InvoiceDate, int? Year, string? CustomerName, string? ProductCode,
    string? ChemicalName, string? ChemicalCategory, long? QuantityKg, decimal? SalesAmountThb, decimal? GrossProfitThb);

/// <summary>Supabase ตอบไม่สำเร็จ หรือยังไม่ได้ตั้งค่า Supabase:Url / Supabase:Key</summary>
public class SupabaseException(string message, bool notConfigured = false) : Exception(message)
{
    public bool NotConfigured { get; } = notConfigured;
}

/// <summary>
/// อ่านตาราง SaleOrder ผ่าน Supabase REST (PostgREST) แยกโปรเจกต์ตาม env ของ credential
///   sandbox    : Supabase:Url / Supabase:Key
///   production : Supabase:Production:Url / Supabase:Production:Key
/// </summary>
public class SupabaseSaleOrderClient(IHttpClientFactory factory)
{
    public static string HttpClientName(string env) => $"supabase-{env}";

    private const string Columns =
        "Transaction_ID,Invoice_Date,Year,Customer_Name,Product_Code,Chemical_Name,Chemical_Category,Quantity_kg,Sales_Amount_THB,Gross_Profit_THB";

    public async Task<(List<SaleOrderDto> Rows, long? Total)> ListAsync(string env, SaleOrderQuery q, CancellationToken ct)
    {
        var http = factory.CreateClient(HttpClientName(env));
        if (http.BaseAddress is null)
            throw new SupabaseException($"ยังไม่ได้ตั้งค่า Supabase ของ {env}", notConfigured: true);

        var qs = new List<string>
        {
            "select=" + Columns,
            "order=Transaction_ID.asc",
            $"limit={q.Limit}",
            $"offset={q.Offset}",
        };
        if (q.Year is int year) qs.Add($"Year=eq.{year}");
        if (Clean(q.Customer) is { } customer) qs.Add("Customer_Name=ilike." + Uri.EscapeDataString($"*{customer}*"));
        if (Clean(q.ProductCode) is { } product) qs.Add("Product_Code=eq." + Uri.EscapeDataString(product));
        if (Clean(q.Category) is { } category) qs.Add("Chemical_Category=eq." + Uri.EscapeDataString(category));

        using var req = new HttpRequestMessage(HttpMethod.Get, "SaleOrder?" + string.Join('&', qs));
        req.Headers.Add("Prefer", "count=exact");

        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            throw new SupabaseException($"Supabase ตอบ {(int)res.StatusCode}: {body}");
        }

        var rows = await res.Content.ReadFromJsonAsync<List<SupabaseSaleOrderRow>>(ct) ?? [];
        return (rows.Select(r => r.ToDto()).ToList(), ReadTotal(res));
    }

    /// <summary>PostgREST ส่งจำนวนทั้งหมดมาใน Content-Range เช่น "0-49/25000"</summary>
    private static long? ReadTotal(HttpResponseMessage res)
    {
        if (!res.Content.Headers.NonValidated.TryGetValues("Content-Range", out var values) &&
            !res.Headers.NonValidated.TryGetValues("Content-Range", out values))
            return null;

        var raw = values.ToString();
        var slash = raw.LastIndexOf('/');
        return slash >= 0 && long.TryParse(raw[(slash + 1)..], out var total) ? total : null;
    }

    /// <summary>ตัดอักขระที่ PostgREST ใช้เป็นไวยากรณ์ ไม่ให้ค่าจากผู้ใช้กลายเป็นเงื่อนไขเพิ่ม</summary>
    private static string? Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var cleaned = new string(value.Where(ch => ch is not (',' or '(' or ')' or '*' or '"' or '\\')).ToArray()).Trim();
        return cleaned.Length == 0 ? null : cleaned;
    }

    private sealed class SupabaseSaleOrderRow
    {
        [JsonPropertyName("Transaction_ID")] public string? TransactionId { get; set; }
        [JsonPropertyName("Invoice_Date")] public string? InvoiceDate { get; set; }
        [JsonPropertyName("Year")] public int? Year { get; set; }
        [JsonPropertyName("Customer_Name")] public string? CustomerName { get; set; }
        [JsonPropertyName("Product_Code")] public string? ProductCode { get; set; }
        [JsonPropertyName("Chemical_Name")] public string? ChemicalName { get; set; }
        [JsonPropertyName("Chemical_Category")] public string? ChemicalCategory { get; set; }
        [JsonPropertyName("Quantity_kg")] public long? QuantityKg { get; set; }
        [JsonPropertyName("Sales_Amount_THB")] public decimal? SalesAmountThb { get; set; }
        [JsonPropertyName("Gross_Profit_THB")] public decimal? GrossProfitThb { get; set; }

        public SaleOrderDto ToDto() => new(TransactionId, InvoiceDate, Year, CustomerName, ProductCode,
            ChemicalName, ChemicalCategory, QuantityKg, SalesAmountThb, GrossProfitThb);
    }
}
