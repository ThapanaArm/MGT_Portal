using System.Text.Json.Serialization;

namespace MGT.Portal.Api.Modules.Gateway;

/// <param name="OwnerIds">null = ไม่กรองตามเจ้าของ / มีค่า = เห็นเฉพาะแถวที่คอลัมน์เจ้าของอยู่ในรายการนี้ (ว่าง = ไม่เห็นเลย)</param>
/// <param name="SaleGroupKey">มีค่า = เห็นเฉพาะแถวของ Sale group นี้ (คอลัมน์ Gateway:SaleOrder:GroupColumn) — ใช้แทน OwnerIds</param>
public sealed record SaleOrderQuery(int? Year, string? Customer, string? ProductCode, string? Category, int Limit, int Offset,
    IReadOnlyList<string>? OwnerIds = null, string? SaleGroupKey = null);

public sealed record SaleOrderDto(
    string? TransactionId, string? InvoiceDate, int? Year, string? CustomerName, string? ProductCode,
    string? ChemicalName, string? ChemicalCategory, long? QuantityKg, decimal? SalesAmountThb, decimal? GrossProfitThb,
    string? SalesEmployeeId = null, string? SalesEmployeeName = null, string? SaleGroup = null);

/// <summary>Supabase ตอบไม่สำเร็จ หรือยังไม่ได้ตั้งค่า Supabase:Url / Supabase:Key</summary>
public class SupabaseException(string message, bool notConfigured = false) : Exception(message)
{
    public bool NotConfigured { get; } = notConfigured;
}

/// <summary>
/// อ่านตาราง SaleOrder ผ่าน Supabase REST (PostgREST) แยกโปรเจกต์ตาม env ของ credential
///   sandbox    : Supabase:Url / Supabase:Key
///   production : Supabase:Production:Url / Supabase:Production:Key
///
/// กรองตามเจ้าของข้อมูล: คอลัมน์ Gateway:SaleOrder:OwnerColumn (ค่าเริ่มต้น Sales_Employee_Id) เก็บรหัสพนักงานของระบบ
/// Gateway:SaleOrder:OwnerPlatform (ค่าเริ่มต้น sap) — จับคู่กับตาราง UserPlatformIds ของ Portal
/// Sales Manager กรองด้วยคอลัมน์ Gateway:SaleOrder:GroupColumn (ค่าเริ่มต้น Sale_Group) = SaleGroups.Key ของ Portal
///
/// ตารางอยู่ schema ไหน: Gateway:SaleOrder:Schema (เช่น saleorder_data — ส่ง header Accept-Profile ให้ PostgREST; ว่าง = public)
/// ชื่อตาราง: Gateway:SaleOrder:Table (ค่าเริ่มต้น SaleOrder)
/// </summary>
public class SupabaseSaleOrderClient(IHttpClientFactory factory, IConfiguration? config = null)
{
    public static string HttpClientName(string env) => $"supabase-{env}";

    /// <summary>ระบบที่รหัสพนักงานในคอลัมน์เจ้าของมาจาก (ใช้ค้น UserPlatformIds.Platform)</summary>
    public string OwnerPlatform => config?["Gateway:SaleOrder:OwnerPlatform"] is { Length: > 0 } p ? p.Trim().ToLowerInvariant() : "sap";

    public string OwnerColumn => Column("OwnerColumn", "Sales_Employee_Id");
    public string GroupColumn => Column("GroupColumn", "Sale_Group");
    public string Table => Column("Table", "SaleOrder");

    /// <summary>schema ของตาราง — null = ไม่ส่ง Accept-Profile (PostgREST ใช้ schema แรกใน Exposed schemas ปกติคือ public)</summary>
    public string? Schema => config?["Gateway:SaleOrder:Schema"] is { Length: > 0 } ? Column("Schema", "") : null;

    private string Column(string key, string fallback)
    {
        var column = config?[$"Gateway:SaleOrder:{key}"] is { Length: > 0 } c ? c.Trim() : fallback;
        return System.Text.RegularExpressions.Regex.IsMatch(column, "^[A-Za-z_][A-Za-z0-9_]*$")
            ? column
            : throw new SupabaseException($"Gateway:SaleOrder:{key} ต้องเป็นชื่อคอลัมน์ (ตัวอักษร ตัวเลข _)", notConfigured: true);
    }

    private static string Quote(string value) => "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";

    /// <summary>เงื่อนไข PostgREST เช่น Sale_Group=in.("SG-NORTH") — ใช้ in เพราะ PostgREST รองรับการใส่เครื่องหมายคำพูดในรายการ</summary>
    public string GroupFilter(string groupKey) => GroupColumn + "=in." + Uri.EscapeDataString("(" + Quote(groupKey) + ")");

    /// <summary>เงื่อนไข PostgREST เช่น Sales_Employee_Id=in.("50001","50002") — ค่าอยู่ในเครื่องหมายคำพูดเสมอ</summary>
    public string OwnerFilter(IReadOnlyList<string> ownerIds) =>
        OwnerColumn + "=in." + Uri.EscapeDataString("(" + string.Join(',', ownerIds.Select(Quote)) + ")");

    /// <summary>คอลัมน์ที่อ่าน — คอลัมน์เจ้าของ / กลุ่มใช้ alias เพราะตั้งชื่อคอลัมน์จริงผ่าน config ได้</summary>
    public string Columns =>
        "Transaction_ID,Invoice_Date,Year,Customer_Name,Product_Code,Chemical_Name,Chemical_Category,Quantity_kg,Sales_Amount_THB,Gross_Profit_THB," +
        $"Owner_Id:{OwnerColumn},Sales_Employee_Name,Group_Key:{GroupColumn}";

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
        if (q.SaleGroupKey is { Length: > 0 } group) qs.Add(GroupFilter(group));
        else if (q.OwnerIds is not null)
        {
            if (q.OwnerIds.Count == 0) return ([], 0);
            qs.Add(OwnerFilter(q.OwnerIds));
        }

        using var req = new HttpRequestMessage(HttpMethod.Get, Table + "?" + string.Join('&', qs));
        req.Headers.Add("Prefer", "count=exact");
        if (Schema is { } schema) req.Headers.Add("Accept-Profile", schema);

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
        [JsonPropertyName("Owner_Id")] public string? SalesEmployeeId { get; set; }
        [JsonPropertyName("Sales_Employee_Name")] public string? SalesEmployeeName { get; set; }
        [JsonPropertyName("Group_Key")] public string? SaleGroup { get; set; }

        public SaleOrderDto ToDto() => new(TransactionId, InvoiceDate, Year, CustomerName, ProductCode,
            ChemicalName, ChemicalCategory, QuantityKg, SalesAmountThb, GrossProfitThb, SalesEmployeeId, SalesEmployeeName, SaleGroup);
    }
}
