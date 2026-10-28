using System.Text.RegularExpressions;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// สิทธิ์ (scope) ของ Sales Order แบบภาษาธุรกิจ — ผู้ขอแอปเลือกจาก "แอปทำอะไร" ไม่ต้องรู้ endpoint
/// Portal จับคู่ scope กับ operation ของ SAP ให้เอง (ดู SapSalesOrderOperations)
/// </summary>
public static class SapScope
{
    /// <summary>ดูใบสั่งขาย — GET ทุกเส้น</summary>
    public const string Read = "sales.order.read";
    /// <summary>สร้างใบสั่งขาย — POST A_SalesOrder</summary>
    public const string Create = "sales.order.create";
    /// <summary>แก้ไขใบสั่งขาย — PATCH และ POST เพิ่ม item / partner / text / ราคา ฯลฯ ใน SO ที่มีอยู่</summary>
    public const string Update = "sales.order.update";
    /// <summary>ยกเลิกใบสั่งขาย — PATCH ที่ใส่ SalesDocumentRjcnReason และ POST /orders/{so}/cancel</summary>
    public const string Cancel = "sales.order.cancel";
    /// <summary>อนุมัติ / ปฏิเสธใบสั่งขาย (releaseApprovalRequest / rejectApprovalRequest)</summary>
    public const string Approve = "sales.order.approve";

    public static readonly IReadOnlyList<string> All = [Read, Create, Update, Cancel, Approve];

    /// <summary>scope ที่แก้ SO ที่มีอยู่แล้ว — ต้องเป็น SO ที่แอปเดียวกันสร้างผ่าน Gateway</summary>
    public static bool ChangesExistingOrder(string scope) => scope is Update or Cancel;
}

/// <summary>
/// operation หนึ่งตัวของ API_SALES_ORDER_SRV ตาม spec ของ SAP
/// Scope = null แปลว่าไม่เปิดให้แอปเรียก (BlockedReason บอกเหตุผล)
/// </summary>
public sealed record SapOperation(
    string Method, string Template, string? Scope, bool IsCollection, string Summary, string? BlockedReason, string AuditName)
{
    private readonly Regex _pattern = SapSalesOrderOperations.ToRegex(Template);

    public bool IsBlocked => Scope is null;

    public Dictionary<string, string>? Match(string path)
    {
        var m = _pattern.Match(path);
        if (!m.Success) return null;
        return _pattern.GetGroupNames()
            .Where(n => !int.TryParse(n, out _))
            .ToDictionary(n => n, n => m.Groups[n].Value.Replace("''", "'"));
    }
}

public sealed record SapOperationMatch(SapOperation Operation, IReadOnlyDictionary<string, string> Keys);

public static partial class SapSalesOrderOperations
{
    /// <summary>$metadata ไม่อยู่ใน spec แต่เปิดให้อ่าน — ใช้ดู field จริงของ tenant รวม custom field (YY1_)</summary>
    public static readonly SapOperation Metadata =
        new("GET", "/$metadata", SapScope.Read, false, "Service metadata (EDMX) of this SAP tenant.", null, "GET $metadata");

    private static IEnumerable<SapOperation> Everything => All.Append(Metadata);

    /// <summary>หา operation จาก method + path (path แบบ OData เช่น /A_SalesOrder('123')/to_Item)</summary>
    public static SapOperationMatch? Find(string method, string path)
    {
        foreach (var op in Everything)
            if (string.Equals(op.Method, method, StringComparison.OrdinalIgnoreCase) && op.Match(path) is { } keys)
                return new SapOperationMatch(op, keys);
        return null;
    }

    /// <summary>path นี้มีใน API แต่ใช้ method อื่น — ใช้ตอบ 405 แทน 404</summary>
    public static IReadOnlyList<string> MethodsFor(string path) =>
        Everything.Where(op => op.Match(path) is not null).Select(op => op.Method).Distinct().ToList();

    internal static Regex ToRegex(string template)
    {
        var pattern = Regex.Replace(Regex.Escape(template), @"\\\{(\w+)}", m => $"(?<{m.Groups[1].Value}>(?:[^'/]|'')*)");
        return new Regex("^" + pattern + "$", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    }
}
