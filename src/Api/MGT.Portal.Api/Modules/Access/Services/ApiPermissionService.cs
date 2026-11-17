using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Access;

public record ApiPermissionResource(string Key, string CategoryKey, string CategoryName, string Name, string[] Endpoints);
public record ApiPermissionRow(string ResourceKey, string CategoryKey, string CategoryName, string Name, string[] Endpoints,
    string ReadScope, string WriteScope, string DefaultReadScope, string DefaultWriteScope, bool IsCustom);
public record ApiPermissionDocument(int UserId, int? TeamId, List<ApiPermissionRow> Permissions);
public record ApiPermissionChange(string ResourceKey, string ReadScope, string WriteScope, bool IsCustom);
public record SaveApiPermissionsRequest(int? TeamId, List<ApiPermissionChange> Permissions);

public class ApiPermissionService(PortalDbContext db)
{
    public const string None = "none";
    public static bool ValidScope(string? scope) => scope is None or DataScope.Self or DataScope.Team or DataScope.All;

    // The same business API can expose several routes and methods. These share a permission row.
    public static string ResourceKey(string category, string scope, string path)
    {
        var parts = scope.Split('.');
        if (parts.Length >= 3) return string.Join('.', parts[..^1]);
        var resource = path.Trim('/').Split('/')[0].ToLowerInvariant();
        if (category == "sales" && resource is "orders" or "sap") return "sales.order";
        return $"{category}.{resource}";
    }

    public async Task<List<ApiPermissionResource>> ResourcesAsync(CancellationToken ct = default)
    {
        var endpoints = await db.ApiEndpoints.Include(e => e.Category).AsNoTracking().ToListAsync(ct);
        var resources = endpoints.SelectMany(e =>
            (e.Category.Key == "sales" && e.Path.StartsWith("/zoho/", StringComparison.OrdinalIgnoreCase) && e.Scope.Contains('{')
                ? new[] { "sales.deal", "sales.quote", "sales.order" }
                : new[] { ResourceKey(e.Category.Key, e.Scope, e.Path) })
            .Select(key => (Endpoint: e, Key: key)));
        var rows = resources.GroupBy(e => e.Key).Select(group =>
        {
            var e = group.First().Endpoint;
            return new ApiPermissionResource(group.Key, e.Category.Key, e.Category.Name,
                group.Key.Split('.').Last().Replace('_', ' '), group.Select(x => $"{x.Endpoint.Method} {x.Endpoint.Category.BasePath}{x.Endpoint.Path}").Distinct().ToArray());
        }).ToList();
        // Live Gateway resources remain configurable even before the catalog is imported.
        foreach (var (key, name, paths) in new[] {
            ("sales.order", "Sales orders · SAP / Zoho", new[] { "GET /api/v1/sales/orders", "POST /api/v1/sales/orders", "PATCH /api/v1/sales/orders/{salesOrder}", "POST /api/v1/sales/orders/{salesOrder}/cancel", "/api/v1/sales/sap/*", "/api/v1/sales/zoho/Sales_Orders/*" }),
            ("sales.deal", "Zoho deals", new[] { "/api/v1/sales/zoho/Deals/*" }),
            ("sales.quote", "Zoho quotes", new[] { "/api/v1/sales/zoho/Quotes/*" }),
        })
        {
            var existing = rows.FindIndex(r => r.Key == key);
            if (existing >= 0) rows[existing] = rows[existing] with { Name = name, Endpoints = rows[existing].Endpoints.Concat(paths).Distinct().ToArray() };
            else rows.Add(new(key, "sales", "Sales", name, paths));
        }
        return rows.OrderBy(r => r.CategoryName).ThenBy(r => r.Name).ToList();
    }

    public async Task<(string Read, string Write)> DefaultAsync(User user, string key, CancellationToken ct = default)
        => Defaults(user, key, await GrantedScopesAsync(user, ct));

    private async Task<HashSet<string>> GrantedScopesAsync(User user, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var granted = await db.AccessGrants.Where(g => g.UserId == user.Id && !g.Revoked && (g.ExpiresAt == null || g.ExpiresAt > now))
            .Select(g => g.Scope).ToListAsync(ct);
        return (user.Role?.Scopes ?? []).Concat(granted).Select(s => s.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static (string Read, string Write) Defaults(User user, string key, HashSet<string> scopes)
    {
        var category = key.Split('.')[0];
        bool Has(string action) => scopes.Contains("*") || scopes.Contains($"{category}.*") || scopes.Contains($"{key}.*")
            || scopes.Contains($"{category}.{action}") || scopes.Contains($"{key}.{action}")
            || action == "write" && new[] { "create", "update", "delete", "cancel" }.All(a => scopes.Contains($"{key}.{a}"));
        return (Has("read") ? user.EffectiveDataScope : None, Has("write") ? user.EffectiveWriteDataScope : None);
    }

    public async Task<string> ScopeAsync(User user, string key, bool write, CancellationToken ct = default)
    {
        var custom = await db.UserApiPermissions.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == user.Id && p.ResourceKey == key, ct);
        if (custom is not null) return write ? custom.WriteScope : custom.ReadScope;
        var defaults = await DefaultAsync(user, key, ct);
        return write ? defaults.Write : defaults.Read;
    }

    public async Task<ApiPermissionDocument> DocumentAsync(User user, CancellationToken ct = default)
    {
        var custom = await db.UserApiPermissions.AsNoTracking().Where(p => p.UserId == user.Id).ToDictionaryAsync(p => p.ResourceKey, ct);
        var scopes = await GrantedScopesAsync(user, ct);
        var rows = new List<ApiPermissionRow>();
        foreach (var resource in await ResourcesAsync(ct))
        {
            var defaults = Defaults(user, resource.Key, scopes);
            custom.TryGetValue(resource.Key, out var permission);
            rows.Add(new(resource.Key, resource.CategoryKey, resource.CategoryName, resource.Name, resource.Endpoints,
                permission?.ReadScope ?? defaults.Read, permission?.WriteScope ?? defaults.Write, defaults.Read, defaults.Write, permission is not null));
        }
        return new(user.Id, user.TeamId, rows);
    }
}
