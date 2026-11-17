using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.UnitTests;

public class UserDirectoryTests
{
    [Theory]
    [InlineData("Sales", "BU1")]
    [InlineData("Sale", "BU1")]
    [InlineData("ฝ่ายขาย", "BU1")]
    [InlineData("Finance", null)]
    [InlineData("IT", null)]
    [InlineData("HR", null)]
    public async Task Division_creates_sale_group_only_for_sales_departments(string department, string? expectedGroup)
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row(department: department));
        var service = new UserDirectorySync(db, source, http);
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.Equal(0, result.Skipped);
        Assert.Equal(expectedGroup, (await db.Users.Include(x => x.SaleGroup).SingleAsync()).SaleGroup?.Name);
        Assert.Equal(expectedGroup is null ? 0 : 1, await db.SaleGroups.CountAsync());
    }

    [Fact]
    public async Task Moving_out_of_sales_clears_portal_sale_group_without_deleting_shared_group()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row()); var service = new UserDirectorySync(db, source, http);
        await service.SyncAsync(new([], "1000"), default);
        source.Rows = [Row(department: "Finance")];
        await service.SyncAsync(new([], "1000"), default);
        var user = await db.Users.SingleAsync();
        Assert.Null(user.SaleGroupId); Assert.Null(user.SaleGroup);
        Assert.Equal(1, await db.SaleGroups.CountAsync());
    }

    [Fact]
    public async Task Inactive_rows_delete_only_matching_portal_users_without_requiring_password_or_role()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row(), Row("keep@example.com"));
        var service = new UserDirectorySync(db, source, http);
        await service.SyncAsync(new([], "1000"), default);
        source.Rows = [new("USER@example.com", null, "", "", "", false), new("missing@example.com", null, "", "", "", false)];
        var preview = await service.PreviewAsync("1000", default);
        Assert.Equal(2, preview.Inactive); Assert.Empty(preview.Roles);
        Assert.Equal(2, await db.Users.CountAsync());
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.Equal(1, result.Deleted); Assert.Equal(0, result.Created);
        Assert.Equal("keep@example.com", (await db.Users.SingleAsync()).Email);
        Assert.Contains(db.AuditLogs, x => x.EntityType == "User" && x.Action == "Deleted");
    }

    [Fact]
    public async Task Inactive_user_with_app_is_reported_without_deleting_app_or_history()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row()); var service = new UserDirectorySync(db, source, http);
        await service.SyncAsync(new([], "1000"), default);
        db.Applications.Add(new() { Name = "Keep app", Owner = await db.Users.SingleAsync() });
        await db.SaveChangesAsync();
        source.Rows = [Row() with { IsActive = false, Password = null }];
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.Equal(0, result.Deleted); Assert.Equal(1, result.Skipped);
        Assert.Single(result.Issues); Assert.Equal(1, await db.Users.CountAsync()); Assert.Equal(1, await db.Applications.CountAsync());
    }

    private sealed class OrganizationSource : IUserDirectorySource
    {
        public List<string> Requests { get; } = [];
        public Task<IReadOnlyList<DirectoryUserRow>> ReadAsync(string salesOrganization, CancellationToken ct)
        {
            Requests.Add(salesOrganization);
            IReadOnlyList<DirectoryUserRow> rows = salesOrganization == "1000"
                ? [Row("org1000@example.com", "user")]
                : [Row("org2000@example.com", "Admin")];
            return Task.FromResult(rows);
        }
    }

    [Theory]
    [InlineData("1000", "org1000@example.com")]
    [InlineData("2000", "org2000@example.com")]
    public async Task Preview_and_sync_use_only_the_selected_sales_organization(string organization, string email)
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new OrganizationSource(); var service = new UserDirectorySync(db, source, http);
        var preview = await service.PreviewAsync(organization, default);
        Assert.Equal(organization, preview.SalesOrganization); Assert.Equal(1, preview.Total);
        var result = await service.SyncAsync(new([], organization), default);
        Assert.Equal(organization, result.SalesOrganization); Assert.Equal(email, (await db.Users.SingleAsync()).Email);
        Assert.Equal(new[] { organization, organization }, source.Requests);
        Assert.Contains(organization, (await db.AuditLogs.SingleAsync(log => log.EventName == "users.sync.completed")).AfterJson);
    }

    [Theory]
    [InlineData("")]
    [InlineData("3000")]
    [InlineData("1000 OR 1=1")]
    public async Task Invalid_organization_is_rejected_before_reading_or_changing_users(string organization)
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new OrganizationSource(); var service = new UserDirectorySync(db, source, http);
        await Assert.ThrowsAsync<ArgumentException>(() => service.PreviewAsync(organization, default));
        await Assert.ThrowsAsync<ArgumentException>(() => service.SyncAsync(new([], organization), default));
        Assert.Empty(source.Requests); Assert.Empty(await db.Users.ToListAsync());
    }
    private sealed class Source(params DirectoryUserRow[] rows) : IUserDirectorySource
    {
        public DirectoryUserRow[] Rows { get; set; } = rows;
        public Task<IReadOnlyList<DirectoryUserRow>> ReadAsync(string salesOrganization, CancellationToken ct) => Task.FromResult<IReadOnlyList<DirectoryUserRow>>(Rows);
    }
    private static (PortalDbContext Db, HttpContextAccessor Http) NewDb()
    {
        var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        http.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier, "42"), new(ClaimTypes.Email, "it@example.com")], "Test"));
        return (new(new DbContextOptionsBuilder<PortalDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, http), http);
    }
    private static DirectoryUserRow Row(string email = "user@example.com", string role = "user", string department = "Sales", string division = "BU1", string password = "source-password-do-not-log") => new(email, password, department, division, role);

    [Fact]
    public async Task Sync_creates_accounts_hashes_passwords_and_applies_the_confirmed_level_and_admin_mapping()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row("manager@example.com", "Manager"), Row("leader@example.com", "Leader"), Row("user@example.com"), Row("it@example.com", "Admin", "IT", ""));
        var service = new UserDirectorySync(db, source, http);
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.Equal(4, result.Created); Assert.Equal(0, result.Skipped);
        var users = await db.Users.Include(user => user.Role).Include(user => user.Team).Include(user => user.SaleGroup).OrderBy(user => user.Email).ToListAsync();
        Assert.All(users, user => { Assert.True(BCrypt.Net.BCrypt.Verify("source-password-do-not-log", user.PasswordHash)); Assert.Equal("", user.DisplayName); });
        Assert.Equal(OrgLevel.Management, users.Single(user => user.Email == "manager@example.com").Level);
        Assert.Equal(OrgLevel.Management, users.Single(user => user.Email == "leader@example.com").Level);
        Assert.Equal(OrgLevel.Employee, users.Single(user => user.Email == "user@example.com").Level);
        var admin = users.Single(user => user.Email == "it@example.com"); Assert.Equal("admin", admin.Role.Key); Assert.Contains("*", admin.Role.Scopes);
        var employee = users.Single(user => user.Email == "user@example.com"); Assert.Equal("employee", employee.Role.Key); Assert.Empty(employee.Role.Scopes);
        Assert.Equal("Sales", employee.Team!.Name); Assert.Equal("BU1", employee.SaleGroup!.Name);
        var audit = string.Join(" ", await db.AuditLogs.Select(log => log.BeforeJson + log.AfterJson).ToListAsync());
        Assert.DoesNotContain("source-password-do-not-log", audit);
        Assert.DoesNotContain("source-password-do-not-log", JsonSerializer.Serialize(result));
    }

    [Fact]
    public async Task Preview_does_not_create_accounts_or_expose_source_passwords()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var service = new UserDirectorySync(db, new Source(Row(role: "Leader")), http);
        var preview = await service.PreviewAsync("1000", default);
        Assert.Empty(await db.Users.ToListAsync()); Assert.Empty(await db.UserSyncLevelMappings.ToListAsync());
        Assert.Equal(OrgLevel.Management, Assert.Single(preview.Roles).Level);
        Assert.DoesNotContain("source-password-do-not-log", JsonSerializer.Serialize(preview));
        Assert.DoesNotContain("source-password-do-not-log", JsonSerializer.Serialize(Row()));
    }

    [Fact]
    public async Task Repeated_sync_keeps_the_same_hash_and_does_not_report_users_as_updated()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var service = new UserDirectorySync(db, new Source(Row()), http);
        await service.SyncAsync(new([], "1000"), default); var before = await db.Users.SingleAsync(); var hash = before.PasswordHash;
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.Equal(0, result.Created); Assert.Equal(0, result.Updated); Assert.Equal(1, result.Unchanged);
        Assert.Equal(hash, before.PasswordHash);
    }

    [Fact]
    public async Task Sync_matches_email_without_case_and_preserves_manual_names_levels_roles_and_API_permissions()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var name = new DisplayNameOption { Name = "Sales Administrative", NormalizedName = "SALES ADMINISTRATIVE" };
        var user = new User { Email = "USER@example.com", DisplayName = name.Name,
            Level = OrgLevel.Employee, PasswordHash = BCrypt.Net.BCrypt.HashPassword("old-password"),
            Role = new Role { Key = "finance", Name = "Finance", ScopesCsv = "finance.read" } };
        db.Users.Add(user); db.UserApiPermissions.Add(new() { User = user, ResourceKey = "sales.order", ReadScope = "all", WriteScope = "none" }); await db.SaveChangesAsync();
        await new UserDirectorySync(db, new Source(Row(" user@example.com ", "Manager")), http).SyncAsync(new([], "1000"), default);
        Assert.Single(await db.Users.ToListAsync()); Assert.Equal(name.Name, user.DisplayName);
        Assert.Equal(OrgLevel.Employee, user.Level); Assert.Equal("finance", user.Role.Key); Assert.Single(await db.UserApiPermissions.ToListAsync());
        Assert.True(BCrypt.Net.BCrypt.Verify("source-password-do-not-log", user.PasswordHash));
    }

    [Fact]
    public async Task Removed_directory_admin_role_does_not_remain_on_an_old_session()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row(role: "Admin")); var service = new UserDirectorySync(db, source, http);
        await service.SyncAsync(new([], "1000"), default); var user = await db.Users.Include(user => user.Role).SingleAsync();
        var oldPrincipal = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Role, "admin"), new("credential_stamp", JwtService.CredentialStamp(user.PasswordHash, "test-key"))], "Test"));
        Assert.True(await JwtSessionValidator.IsCurrentAsync(db, oldPrincipal, default, "test-key"));
        source.Rows = [Row(role: "user")]; await service.SyncAsync(new([], "1000"), default);
        Assert.Equal("employee", user.Role.Key); Assert.False(await JwtSessionValidator.IsCurrentAsync(db, oldPrincipal, default, "test-key"));
    }

    [Fact]
    public async Task Sync_reports_when_the_current_users_changed_password_requires_signing_in_again()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var source = new Source(Row(role: "Admin")); var service = new UserDirectorySync(db, source, http);
        await service.SyncAsync(new([], "1000"), default); var user = await db.Users.SingleAsync();
        http.HttpContext!.User = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier, user.Id.ToString()), new(ClaimTypes.Email, user.Email), new(ClaimTypes.Role, "admin"), new("credential_stamp", JwtService.CredentialStamp(user.PasswordHash, "test-key"))], "Test"));
        source.Rows = [Row(role: "Admin", password: "new-password-do-not-log")];
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.True(result.RequiresSignIn);
        Assert.False(await JwtSessionValidator.IsCurrentAsync(db, http.HttpContext.User, default, "test-key"));
    }

    [Fact]
    public async Task Invalid_and_duplicate_source_records_are_skipped_without_guessing_levels()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var service = new UserDirectorySync(db, new Source(Row("dup@example.com"), Row("DUP@example.com"), Row("bad-email"), Row("unknown@example.com", "Unknown"), Row("no-dept@example.com", department: ""), Row("no-password@example.com", password: "")), http);
        var result = await service.SyncAsync(new([], "1000"), default);
        Assert.Equal(6, result.Skipped); Assert.Empty(await db.Users.ToListAsync());
        Assert.All(result.Issues, issue => Assert.DoesNotContain("source-password-do-not-log", issue.Reason));
    }

    [Fact]
    public async Task Explicit_source_level_mappings_persist_for_the_next_preview()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var service = new UserDirectorySync(db, new Source(Row(role: "Supervisor")), http);
        await service.SyncAsync(new([new("Supervisor", OrgLevel.Manager)], "1000"), default);
        Assert.Equal(OrgLevel.Manager, (await db.Users.SingleAsync()).Level);
        Assert.Equal(OrgLevel.Manager, Assert.Single((await service.PreviewAsync("1000", default)).Roles).Level);
    }

    [Fact]
    public async Task Division_validation_uses_the_preserved_manual_level()
    {
        var (db, http) = NewDb(); await using var owned = db;
        var user = new User { Email = "user@example.com", Level = OrgLevel.Employee,
            Role = new Role { Key = "employee", Name = "Employee" }, PasswordHash = BCrypt.Net.BCrypt.HashPassword("source-password-do-not-log") };
        db.Users.Add(user); await db.SaveChangesAsync();
        var service = new UserDirectorySync(db, new Source(Row(role: "Supervisor", division: "")), http);
        var result = await service.SyncAsync(new([new("Supervisor", OrgLevel.SalesManager)], "1000"), default);
        Assert.Equal(0, result.Skipped); Assert.Equal(OrgLevel.Employee, user.Level);
    }

    [Fact]
    public async Task Display_name_options_are_reusable_and_can_be_selected_without_later_sync_overwriting_them()
    {
        var (db, http) = NewDb(); await using var owned = db; var service = new UserDirectorySync(db, new Source(Row()), http);
        await service.SyncAsync(new([], "1000"), default);
        var controller = new UserManagementController(db, service, NullLogger<UserManagementController>.Instance);
        Assert.IsType<OkObjectResult>(await controller.AddName(new("Human Resources Staff"), default));
        Assert.IsType<OkObjectResult>(await controller.AddName(new(" human resources staff "), default));
        var option = await db.DisplayNameOptions.SingleAsync(); var user = await db.Users.SingleAsync();
        Assert.IsType<OkObjectResult>(await controller.Update(user.Id, new(option.Name, OrgLevel.Management), default));
        await service.SyncAsync(new([], "1000"), default);
        Assert.Equal("Human Resources Staff", user.DisplayName); Assert.Equal(OrgLevel.Management, user.Level);
        Assert.IsType<OkObjectResult>(await controller.Update(user.Id, new(option.Name, OrgLevel.Employee), default)); Assert.Equal(OrgLevel.Employee, user.Level);
    }

    [Fact]
    public void User_management_and_sync_require_administrator_authorization()
    {
        var auth = Assert.Single(typeof(UserManagementController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), true).Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>());
        Assert.Equal("admin", auth.Roles);
    }
}

