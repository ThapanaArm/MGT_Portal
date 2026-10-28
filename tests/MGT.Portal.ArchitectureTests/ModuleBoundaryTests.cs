using System.Reflection;
using MGT.Portal.Api.Infrastructure.Persistence;
using NetArchTest.Rules;

namespace MGT.Portal.ArchitectureTests;

/// <summary>
/// กติกาของ modular monolith — ถ้า test นี้ fail แปลว่ามีโค้ดใน module หนึ่งไปอ้างถึง module ที่ไม่ควรรู้จัก
///
/// ทิศทางที่อนุญาต (ลูกศร = "ใช้ได้"):
///   Apps   → Identity
///   Access → Identity, Catalog
///   Gateway → Apps (ตรวจ Token ID/Secret ของแอปที่อนุมัติแล้ว)
///   Identity และ Catalog ไม่พึ่งใคร และไม่มี module ไหนอ้างถึง Gateway
/// ถ้า Identity ต้องการข้อมูลจาก module อื่น ให้ประกาศ interface ไว้ใน Identity แล้วให้ module นั้น implement
/// (ดูตัวอย่าง IUserScopeProvider ที่ Access เป็นผู้ implement)
/// </summary>
public class ModuleBoundaryTests
{
    private const string Modules = "MGT.Portal.Api.Modules.";
    private const string Shared = "MGT.Portal.Api.Shared";

    private static readonly Assembly Api = typeof(PortalDbContext).Assembly;

    public static TheoryData<string, string[]> Rules => new()
    {
        { Modules + "Identity", new[] { Modules + "Catalog", Modules + "Apps", Modules + "Access", Modules + "Gateway" } },
        { Modules + "Catalog",  new[] { Modules + "Identity", Modules + "Apps", Modules + "Access", Modules + "Gateway" } },
        { Modules + "Apps",     new[] { Modules + "Access", Modules + "Gateway" } },
        { Modules + "Access",   new[] { Modules + "Apps", Modules + "Gateway" } },
        { Modules + "Gateway",  new[] { Modules + "Identity", Modules + "Access" } },
        { Shared,               new[] { Modules + "Identity", Modules + "Catalog", Modules + "Apps", Modules + "Access", Modules + "Gateway" } },
    };

    [Theory]
    [MemberData(nameof(Rules))]
    public void Namespace_does_not_depend_on_forbidden_modules(string ns, string[] forbidden)
    {
        var result = Types.InAssembly(Api)
            .That().ResideInNamespace(ns)
            .ShouldNot().HaveDependencyOnAny(forbidden)
            .GetResult();

        var failing = result.FailingTypeNames ?? (IReadOnlyList<string>)Array.Empty<string>();
        Assert.True(result.IsSuccessful,
            $"{ns} ห้ามอ้างถึง {string.Join(", ", forbidden)} แต่พบใน: {string.Join(", ", failing)}");
    }
}
