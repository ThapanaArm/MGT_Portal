using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Catalog;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

public class ApiPermissionTests
{
    [Fact]
    public async Task Generic_Zoho_catalog_routes_are_listed_under_real_APIs_instead_of_a_template_name()
    {
        await using var db = NewDb();
        db.ApiEndpoints.Add(new ApiEndpoint { Category = new ApiCategory { Key = "sales", Name = "Sales", BasePath = "/api/v1/sales" }, Path = "/zoho/{module}", Scope = "sales.{deal|quote|order}.read" });
        await db.SaveChangesAsync();
        var resources = await new ApiPermissionService(db).ResourcesAsync();
        Assert.Equal(3, resources.Count);
        Assert.DoesNotContain(resources, resource => resource.Key.Contains('{'));
        Assert.All(resources, resource => Assert.Contains("GET /api/v1/sales/zoho/{module}", resource.Endpoints));
    }
    private static PortalDbContext NewDb() => new(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static User Person() => new() { Email = "sales@example.com", Role = new Role { Key = "sales", Name = "Sales", ScopesCsv = "sales.read,sales.write,inventory.read" } };

    [Fact]
    public async Task Role_defaults_allow_stock_reads_but_not_stock_updates()
    {
        await using var db = NewDb(); var user = Person(); db.Users.Add(user); await db.SaveChangesAsync();
        var service = new ApiPermissionService(db);
        Assert.Equal(DataScope.Self, await service.ScopeAsync(user, "inventory.stock", false));
        Assert.Equal("none", await service.ScopeAsync(user, "inventory.stock", true));
    }

    [Fact]
    public async Task Explicit_deny_overrides_role_and_active_grants_for_only_the_selected_API()
    {
        await using var db = NewDb(); var user = Person(); db.Users.Add(user); await db.SaveChangesAsync();
        db.UserApiPermissions.Add(new() { UserId = user.Id, ResourceKey = "sales.order", ReadScope = "all", WriteScope = "none" });
        var category = new ApiCategory { Key = "sales", Name = "Sales" }; db.ApiCategories.Add(category);
        db.AccessGrants.Add(new() { User = user, Category = category, Scope = "sales.write", GrantedByUser = user });
        await db.SaveChangesAsync(); var service = new ApiPermissionService(db);
        Assert.Equal("all", await service.ScopeAsync(user, "sales.order", false));
        Assert.Equal("none", await service.ScopeAsync(user, "sales.order", true));
        Assert.Equal("self", await service.ScopeAsync(user, "sales.quote", true));
    }

    [Fact]
    public async Task Revoked_and_expired_grants_do_not_enable_an_API()
    {
        await using var db = NewDb(); var user = Person(); var category = new ApiCategory { Key = "finance", Name = "Finance" };
        db.Users.Add(user); db.ApiCategories.Add(category); await db.SaveChangesAsync();
        db.AccessGrants.AddRange(new AccessGrant { User = user, Category = category, GrantedByUser = user, Scope = "finance.read", Revoked = true },
            new AccessGrant { User = user, Category = category, GrantedByUser = user, Scope = "finance.write", ExpiresAt = DateTime.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync(); var service = new ApiPermissionService(db);
        Assert.Equal("none", await service.ScopeAsync(user, "finance.stock", false));
        Assert.Equal("none", await service.ScopeAsync(user, "finance.stock", true));
    }

    [Fact]
    public async Task Modal_saves_API_specific_scopes_and_reset_restores_role_defaults()
    {
        await using var db = NewDb(); var user = Person(); var team = new Team { Key = "sales", Name = "Sales" };
        db.Users.Add(user); db.Teams.Add(team); await db.SaveChangesAsync();
        var service = new ApiPermissionService(db); var controller = new UserApiPermissionsController(db, service);
        var result = await controller.Save(user.Id, new(team.Id, [new("sales.order", "all", "team", true), new("sales.quote", "none", "none", true)]), default);
        Assert.NotNull(result.Value); Assert.Equal(2, await db.UserApiPermissions.CountAsync());
        Assert.Equal("all", await service.ScopeAsync(user, "sales.order", false));
        Assert.Equal("team", await service.ScopeAsync(user, "sales.order", true));
        Assert.Equal("none", await service.ScopeAsync(user, "sales.quote", false));
        await controller.Save(user.Id, new(team.Id, [new("sales.order", "none", "none", false)]), default);
        Assert.Equal("self", await service.ScopeAsync(user, "sales.order", false));
        Assert.Equal("none", await service.ScopeAsync(user, "sales.quote", false));
    }

    [Theory]
    [InlineData("sales.order", "team", "self")]
    [InlineData("sales.order", "self", "team")]
    [InlineData("unknown.API", "all", "all")]
    [InlineData("sales.order", "bad-value", "all")]
    public async Task Invalid_changes_are_rejected_without_partial_saves(string key, string read, string write)
    {
        await using var db = NewDb(); var user = Person(); db.Users.Add(user); await db.SaveChangesAsync();
        var controller = new UserApiPermissionsController(db, new ApiPermissionService(db));
        var result = await controller.Save(user.Id, new(null, [new(key, read, write, true)]), default);
        Assert.IsType<BadRequestObjectResult>(result.Result); Assert.Empty(await db.UserApiPermissions.ToListAsync());
    }

    [Fact]
    public async Task Personal_token_resolves_separate_read_and_write_scopes_for_each_API()
    {
        await using var db = NewDb(); var user = Person(); db.Users.Add(user); await db.SaveChangesAsync();
        var token = UserTokenGenerator.New(); db.UserTokens.Add(new() { User = user, TokenHash = UserTokenGenerator.Hash(token), ExpiresAt = DateTime.UtcNow.AddDays(1) });
        db.UserApiPermissions.Add(new() { User = user, ResourceKey = "sales.order", ReadScope = "all", WriteScope = "none" }); await db.SaveChangesAsync();
        var users = new GatewayUserContext(db, new DataBoundaryResolver(db));
        Assert.True((await users.ResolveAsync(token, "sap", default, "sales.order")).User!.SeesAll);
        var write = await users.ResolveAsync(token, "sap", default, "sales.order", forWrite: true);
        Assert.False(write.Ok); Assert.Equal(403, write.StatusCode);
        Assert.True((await users.ResolveAsync(token, "sap", default, "sales.quote", forWrite: true)).Ok);
    }

    private sealed class NoNetwork : IHttpClientFactory
    { public HttpClient CreateClient(string name) => throw new InvalidOperationException("No upstream call was expected"); }

    private static async Task<(GatewayUserPermissionFilter Filter, ActionExecutingContext Context)> FilterContext(PortalDbContext db, string method, string path, string read, string write)
    {
        var user = Person(); db.Users.Add(user);
        var app = new Application { Name = "Test", ProductsCsv = "sales", Status = AppStatus.Active, Type = AppTier.Tier2, Owner = user };
        var credential = CredentialGenerator.NewAppCredential(CredEnv.Sandbox, "sales"); credential.Application = app; db.AppCredentials.Add(credential);
        var token = UserTokenGenerator.New(); db.UserTokens.Add(new() { User = user, TokenHash = UserTokenGenerator.Hash(token), ExpiresAt = DateTime.UtcNow.AddDays(1) });
        db.UserApiPermissions.Add(new() { User = user, ResourceKey = "sales.order", ReadScope = read, WriteScope = write });
        db.UserPlatformIds.Add(new() { User = user, Platform = "zoho", ExternalId = "1001" });
        await db.SaveChangesAsync();
        var http = new DefaultHttpContext(); http.Request.Method = method; http.Request.Path = path;
        http.Request.Headers[GatewayAuth.TokenIdHeader] = credential.TokenId; http.Request.Headers[GatewayAuth.TokenSecretHeader] = credential.TokenSecret;
        http.Request.Headers[GatewayUserContext.Header] = token;
        var action = new ActionContext(http, new RouteData(), new ActionDescriptor(), new ModelStateDictionary());
        var context = new ActionExecutingContext(action, [], new Dictionary<string, object?>(), new object());
        var config = new ConfigurationBuilder().Build(); var factory = new NoNetwork(); var boundaries = new DataBoundaryResolver(db);
        return (new(db, new GatewayAuth(db), new GatewayUserContext(db, boundaries), boundaries, new SapODataProxy(factory, config),
            new ZohoCrmClient(factory, config, new ZohoTokenStore()), config), context);
    }

    [Theory]
    [InlineData("POST", "/api/v1/sales/orders")]
    [InlineData("PATCH", "/api/v1/sales/sap/A_SalesOrder('123')")]
    [InlineData("PUT", "/api/v1/sales/zoho/Sales_Orders/123")]
    [InlineData("PUT", "/api/v1/sales/zoho%2FSales_Orders%2F123")]
    [InlineData("PATCH", "/api/v1/sales/sap%2FA_SalesOrder('123')")]
    public async Task CUD_deny_stops_the_request_before_any_upstream_action(string method, string path)
    {
        await using var db = NewDb(); var (filter, context) = await FilterContext(db, method, path, "all", "none");
        await filter.OnActionExecutionAsync(context, () => throw new InvalidOperationException("Denied request reached the action"));
        Assert.Equal(403, Assert.IsType<ObjectResult>(context.Result).StatusCode);
    }

    [Fact]
    public async Task Zoho_list_filters_other_owners_even_when_the_source_returns_them()
    {
        await using var db = NewDb(); var (filter, context) = await FilterContext(db, "GET", "/api/v1/sales/zoho/Sales_Orders", "self", "none");
        var result = new ContentResult { StatusCode = 200, Content = """{"data":[{"id":"1","Owner":{"id":"1001"}},{"id":"2","Owner":{"id":"2002"}}],"info":{"count":2}}""" };
        await filter.OnActionExecutionAsync(context, () => Task.FromResult(new ActionExecutedContext(context, [], context.Controller) { Result = result }));
        Assert.Contains("1001", result.Content); Assert.DoesNotContain("2002", result.Content);
    }

    [Fact]
    public async Task A_changed_source_response_shape_is_not_returned_unfiltered()
    {
        await using var db = NewDb(); var (filter, context) = await FilterContext(db, "GET", "/api/v1/sales/zoho/Sales_Orders", "self", "none");
        var executed = new ActionExecutedContext(context, [], context.Controller) {
            Result = new ContentResult { StatusCode = 200, Content = """{"unexpected":[{"Owner":{"id":"2002"}}]}""" }
        };
        await filter.OnActionExecutionAsync(context, () => Task.FromResult(executed));
        Assert.Equal(502, Assert.IsType<ObjectResult>(executed.Result).StatusCode);
    }

    [Fact]
    public async Task Missing_personal_token_cannot_use_an_application_credential_alone()
    {
        await using var db = NewDb(); var (filter, context) = await FilterContext(db, "GET", "/api/v1/sales/zoho/Sales_Orders", "all", "all");
        context.HttpContext.Request.Headers.Remove(GatewayUserContext.Header);
        await filter.OnActionExecutionAsync(context, () => throw new InvalidOperationException("Missing token reached source"));
        Assert.Equal(401, Assert.IsType<ObjectResult>(context.Result).StatusCode);
    }

    [Fact]
    public void All_live_gateway_controllers_register_the_permission_filter()
    {
        foreach (var type in new[] { typeof(SalesGatewayController), typeof(SalesOrderWriteController), typeof(SapSalesOrderProxyController), typeof(ZohoCrmProxyController) })
            Assert.Contains(type.GetCustomAttributes(typeof(ServiceFilterAttribute), true).Cast<ServiceFilterAttribute>(), filter => filter.ServiceType == typeof(GatewayUserPermissionFilter));
    }
}
