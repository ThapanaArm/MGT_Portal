using System.Text.Json;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Catalog;

/// <summary>
/// เติมการ์ด API Catalog จากไฟล์ JSON ที่ฝังในโปรเจกต์ (Modules/Catalog/Seed/*.json) ตอน Start
/// - ใส่เฉพาะการ์ดที่ยังไม่มี (เทียบ CategoryId + Method + Path) — การ์ดที่มีอยู่แล้ว (รวมที่ Admin แก้ในหน้าเว็บ) ไม่ถูกแตะ
/// - ไม่ลบอะไร; ถ้าลบการ์ดทิ้งในหน้าเว็บ Start ครั้งหน้าการ์ดนั้นจะกลับมา (เอาออกถาวรให้ลบจากไฟล์ JSON)
/// - ข้ามทั้งไฟล์ถ้ายังไม่มีหมวดนั้นในตาราง ApiCategories
/// </summary>
public static class CatalogSeed
{
    /// <summary>การ์ด API หมวด Purchase (SAP 6 service) — แสดงอย่างเดียว ยังไม่มี Gateway รองรับ</summary>
    public const string PurchaseResource = "MGT.Portal.Api.Catalog.Seed.purchase-catalog.json";

    public sealed record SeedResult(string Category, int Added, int Existing, bool CategoryMissing);

    private sealed record SeedFile(string Category, List<SeedEndpoint> Endpoints);

    private sealed record SeedEndpoint(
        string Method, string Path, string Summary, string Description, string Scenario, string Scope,
        string SourcePlatform, string Icon, string ParamsJson, string? ReqBody, string RespExample, string RespFieldsJson);

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static SeedResult AddMissingFromResource(PortalDbContext db, string resourceName)
    {
        using var stream = typeof(CatalogSeed).Assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"ไม่พบไฟล์ catalog seed {resourceName} (ตรวจ EmbeddedResource ใน .csproj)");
        var file = JsonSerializer.Deserialize<SeedFile>(stream, Web)
            ?? throw new InvalidOperationException($"อ่านไฟล์ catalog seed {resourceName} ไม่ได้");
        return AddMissing(db, file.Category, file.Endpoints);
    }

    private static SeedResult AddMissing(PortalDbContext db, string categoryKey, IReadOnlyList<SeedEndpoint> endpoints)
    {
        var category = db.ApiCategories.FirstOrDefault(c => c.Key == categoryKey);
        if (category is null) return new(categoryKey, 0, 0, true);

        var existing = db.ApiEndpoints.Where(e => e.CategoryId == category.Id)
            .Select(e => new { e.Method, e.Path }).AsEnumerable()
            .Select(e => Key(e.Method, e.Path)).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var added = 0;
        foreach (var e in endpoints)
        {
            if (!existing.Add(Key(e.Method, e.Path))) continue;
            db.ApiEndpoints.Add(new ApiEndpoint
            {
                CategoryId = category.Id,
                Method = e.Method.ToUpperInvariant(),
                Path = e.Path,
                Summary = e.Summary,
                Description = e.Description,
                Scenario = e.Scenario,
                Scope = e.Scope,
                SourcePlatform = e.SourcePlatform,
                Icon = e.Icon,
                ParamsJson = e.ParamsJson,
                ReqBody = e.ReqBody,
                RespExample = e.RespExample,
                RespFieldsJson = e.RespFieldsJson,
            });
            added++;
        }
        if (added > 0) db.SaveChanges();
        return new(categoryKey, added, endpoints.Count - added, false);
    }

    private static string Key(string method, string path) => $"{method.Trim().ToUpperInvariant()} {path.Trim()}";
}
