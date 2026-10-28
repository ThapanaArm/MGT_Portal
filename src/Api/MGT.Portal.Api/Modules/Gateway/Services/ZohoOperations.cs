using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;

namespace MGT.Portal.Api.Modules.Gateway;

public enum ZohoAction { List, Get, Search, Fields, Create, Update }

/// <summary>คำขอที่ตรวจแล้ว — Module เป็นชื่อ API ของ Zoho (Deals / Quotes / Sales_Orders), RecordId เฉพาะ Get / Update</summary>
public sealed record ZohoOperation(ZohoAction Action, string Module, string? RecordId, string Scope, string AuditName)
{
    public bool IsWrite => Action is ZohoAction.Create or ZohoAction.Update;
    /// <summary>path ที่ส่งไป Zoho ต่อท้าย /crm/v8 (ใช้ชื่อโมดูลแบบที่ Zoho ต้องการเสมอ)</summary>
    public string ZohoPath => Action switch
    {
        ZohoAction.List or ZohoAction.Create => $"/{Module}",
        ZohoAction.Get or ZohoAction.Update => $"/{Module}/{RecordId}",
        ZohoAction.Search => $"/{Module}/search",
        _ => "/settings/fields",
    };
}

/// <summary>
/// Zoho CRM ที่ Gateway เปิดให้แอปเรียกผ่าน /api/v1/sales/zoho/* — path หลัง /zoho เหมือน Zoho CRM API v8
///   GET   /{Module}                     รายการ (ไม่ส่ง fields จะได้ field พื้นฐาน, per_page สูงสุด 200)
///   GET   /{Module}/{id}                ระเบียนเดียว
///   GET   /{Module}/search?criteria=…   ค้นหา (หรือ email / phone / word)
///   GET   /settings/fields?module=…     รายชื่อ field ของโมดูล (รวม custom field ของ Megachem)
///   POST  /{Module}                     สร้าง  body {"data":[{...}]} ไม่เกิน 100 ระเบียน
///   PUT   /{Module}/{id}                แก้    body {"data":[{...}]} 1 ระเบียน
/// ไม่เปิด DELETE และ bulk update (PUT /{Module})
/// </summary>
public static partial class ZohoOperations
{
    /// <summary>ชื่อ API ของ Zoho → ชื่อ resource ใน scope (sales.deal.read ฯลฯ)</summary>
    public static readonly IReadOnlyDictionary<string, string> Modules = new Dictionary<string, string>
    {
        ["Deals"] = "deal",
        ["Quotes"] = "quote",
        ["Sales_Orders"] = "order",
    };

    /// <summary>field ที่ GET รายการใช้เมื่อแอปไม่ส่ง fields (Zoho v8 บังคับต้องมี) — เป็น field มาตรฐานที่ทุก org มี</summary>
    public static readonly IReadOnlyDictionary<string, string> DefaultFields = new Dictionary<string, string>
    {
        ["Deals"] = "Deal_Name,Stage,Closing_Date,Account_Name,Owner,Created_Time,Modified_Time",
        ["Quotes"] = "Subject,Quote_Stage,Account_Name,Deal_Name,Owner,Created_Time,Modified_Time",
        ["Sales_Orders"] = "Subject,Status,Account_Name,Deal_Name,Quote_Name,Owner,Created_Time,Modified_Time",
    };

    public const int DefaultPerPage = 50;
    public const int MaxPerPage = 200;
    public const int MaxRecordsPerWrite = 100;

    private static readonly string[] AllowedQuery =
        ["fields", "page", "per_page", "page_token", "sort_by", "sort_order", "cvid", "converted", "approved", "criteria", "email", "phone", "word", "module"];

    public static string Scope(string module, string action) => $"sales.{Modules[module]}.{action}";

    public static string? CanonicalModule(string name) =>
        Modules.Keys.FirstOrDefault(m => m.Equals(name, StringComparison.OrdinalIgnoreCase));

    /// <summary>ผลการตรวจ: Operation หรือ (Status, Error) ที่ต้องตอบกลับ</summary>
    public sealed record Resolution(ZohoOperation? Operation, int Status, string? Error);

    public static Resolution Resolve(string method, string path, string? rawQuery)
    {
        method = method.ToUpperInvariant();
        var segments = path.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        var query = QueryHelpers.ParseQuery(rawQuery);
        var supported = string.Join(", ", Modules.Keys);

        if (method == "DELETE")
            return new(null, 403, "ไม่เปิด DELETE ของ Zoho ผ่าน Gateway — ใช้การเปลี่ยนสถานะ (Stage / Status) แทน");

        // GET /settings/fields?module=Deals
        if (segments.Length == 2 && segments[0].Equals("settings", StringComparison.OrdinalIgnoreCase) && segments[1].Equals("fields", StringComparison.OrdinalIgnoreCase))
        {
            if (method != "GET") return new(null, 405, "/settings/fields ใช้ได้กับ GET เท่านั้น");
            var m = CanonicalModule(query.TryGetValue("module", out var mv) ? mv.ToString() : "");
            if (m is null) return new(null, 400, $"ต้องส่ง module เป็นหนึ่งใน {supported}");
            return new(new ZohoOperation(ZohoAction.Fields, m, null, Scope(m, "read"), $"GET Zoho {m} fields"), 200, null);
        }

        var module = segments.Length > 0 ? CanonicalModule(segments[0]) : null;
        if (module is null)
            return new(null, 404, $"Gateway เปิด Zoho เฉพาะโมดูล {supported} (และ GET /settings/fields?module=…)");

        switch (segments.Length, method)
        {
            case (1, "GET"):
                return new(new ZohoOperation(ZohoAction.List, module, null, Scope(module, "read"), $"GET Zoho {module}"), 200, null);
            case (1, "POST"):
                return new(new ZohoOperation(ZohoAction.Create, module, null, Scope(module, "create"), $"POST Zoho {module}"), 200, null);
            case (2, "GET") when segments[1].Equals("search", StringComparison.OrdinalIgnoreCase):
                if (!new[] { "criteria", "email", "phone", "word" }.Any(query.ContainsKey))
                    return new(null, 400, "ค้นหาต้องส่ง criteria, email, phone หรือ word อย่างใดอย่างหนึ่ง เช่น criteria=(Stage:equals:Closed Won)");
                return new(new ZohoOperation(ZohoAction.Search, module, null, Scope(module, "read"), $"GET Zoho {module} search"), 200, null);
            case (2, "GET") when RecordId().IsMatch(segments[1]):
                return new(new ZohoOperation(ZohoAction.Get, module, segments[1], Scope(module, "read"), $"GET Zoho {module}"), 200, null);
            case (2, "PUT") when RecordId().IsMatch(segments[1]):
                return new(new ZohoOperation(ZohoAction.Update, module, segments[1], Scope(module, "update"), $"PUT Zoho {module}"), 200, null);
            case (2, _) when !RecordId().IsMatch(segments[1]) && !segments[1].Equals("search", StringComparison.OrdinalIgnoreCase):
                return new(null, 400, "record id ของ Zoho ต้องเป็นตัวเลข");
            case (1, "PUT"):
                return new(null, 405, $"ไม่เปิดแก้หลายระเบียนพร้อมกัน — ใช้ PUT /{module}/{{id}} ทีละระเบียน");
            case (1, _) or (2, _):
                return new(null, 405, $"{method} ใช้กับ path นี้ไม่ได้");
            default:
                return new(null, 404, "ไม่มี path นี้ใน Gateway ของ Zoho");
        }
    }

    /// <summary>ตรวจและปรับ query — ตัด option ที่ไม่รองรับ, ใส่ fields / per_page ค่าเริ่มต้น</summary>
    public static (string? Query, string? Error) BuildQuery(ZohoOperation op, string? rawQuery)
    {
        var parsed = QueryHelpers.ParseQuery(rawQuery);
        var parts = new List<string>();
        foreach (var (key, values) in parsed)
        {
            var known = AllowedQuery.FirstOrDefault(k => k.Equals(key, StringComparison.OrdinalIgnoreCase));
            if (known is null)
                return (null, $"ไม่รองรับ query '{key}' — ใช้ได้: {string.Join(", ", AllowedQuery)}");
            if (known == "per_page" &&
                (!int.TryParse(values.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var n) || n < 1 || n > MaxPerPage))
                return (null, $"per_page ต้องเป็นตัวเลข 1 ถึง {MaxPerPage}");
            if (known == "module")
            {
                parts.Add($"module={Uri.EscapeDataString(op.Module)}");
                continue;
            }
            foreach (var v in values) parts.Add($"{known}={Uri.EscapeDataString(v ?? "")}");
        }
        bool Has(string k) => parsed.Keys.Any(x => x.Equals(k, StringComparison.OrdinalIgnoreCase));
        if (op.Action == ZohoAction.List && !Has("fields")) parts.Add($"fields={Uri.EscapeDataString(DefaultFields[op.Module])}");
        if (op.Action is ZohoAction.List or ZohoAction.Search && !Has("per_page")) parts.Add($"per_page={DefaultPerPage}");
        return (parts.Count == 0 ? "" : "?" + string.Join("&", parts), null);
    }

    [GeneratedRegex("^[0-9]{1,25}$")]
    private static partial Regex RecordId();
}
