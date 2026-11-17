using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.UnitTests;

public class DataPermissionTests
{
    private static PortalDbContext NewDb() => new(new DbContextOptionsBuilder<PortalDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Theory]
    [InlineData(DataScope.All, DataScope.Self)]
    [InlineData(DataScope.Self, DataScope.All)]
    [InlineData(DataScope.Team, DataScope.Self)]
    [InlineData(DataScope.Self, DataScope.Team)]
    public async Task Read_and_write_boundaries_are_independent(string read, string write)
    {
        await using var db = NewDb();
        var team = new Team { Name = "Sales", Key = "sales" };
        var me = new User { Email = "me@example.com", Team = team, ReadDataScope = read, WriteDataScope = write };
        var peer = new User { Email = "peer@example.com", Team = team };
        var other = new User { Email = "other@example.com" };
        db.Users.AddRange(me, peer, other);
        await db.SaveChangesAsync();
        var resolver = new DataBoundaryResolver(db);
        var r = await resolver.ResolveAsync(me, false);
        var w = await resolver.ResolveAsync(me, false, forWrite: true);
        Assert.True(r.Allows(me.Id)); Assert.True(w.Allows(me.Id));
        Assert.Equal(read != DataScope.Self, r.Allows(peer.Id));
        Assert.Equal(write != DataScope.Self, w.Allows(peer.Id));
        Assert.Equal(read == DataScope.All, r.Allows(other.Id));
        Assert.Equal(write == DataScope.All, w.Allows(other.Id));
    }

    [Fact]
    public void Legacy_users_keep_read_access_and_do_not_gain_write_access()
    {
        var user = new User { Level = OrgLevel.Management, DataScopeOverride = DataScope.SaleGroup };
        Assert.Equal(DataScope.SaleGroup, user.EffectiveDataScope);
        Assert.Equal(DataScope.Self, user.EffectiveWriteDataScope);
        user.ReadDataScope = DataScope.Team;
        Assert.Equal(DataScope.Team, user.EffectiveDataScope);
    }

    [Theory]
    [InlineData(DataScope.Team, DataScope.Self)]
    [InlineData(DataScope.Self, DataScope.Team)]
    [InlineData("invalid", DataScope.Self)]
    [InlineData(DataScope.Self, "invalid")]
    public async Task Invalid_or_unassigned_department_permissions_are_not_saved(string read, string write)
    {
        await using var db = NewDb();
        var role = new Role { Key = "sales", Name = "Sales" };
        var user = new User { Email = "me@example.com", Role = role };
        db.Users.Add(user); await db.SaveChangesAsync();
        var controller = new UserAdminController(db);
        var result = await controller.UpdatePermissions(user.Id, new(null, read, write));
        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Null(user.ReadDataScope); Assert.Null(user.WriteDataScope);
    }

    [Fact]
    public async Task Modal_save_persists_both_scopes_without_changing_organization_level()
    {
        await using var db = NewDb();
        var user = new User { Email = "me@example.com", Role = new Role { Key = "sales", Name = "Sales" }, Level = OrgLevel.Employee };
        var team = new Team { Key = "sales", Name = "Sales" };
        db.Users.Add(user); db.Teams.Add(team); await db.SaveChangesAsync();
        var controller = new UserAdminController(db);
        var result = await controller.UpdatePermissions(user.Id, new(team.Id, DataScope.All, DataScope.Team));
        Assert.NotNull(result.Value);
        Assert.Equal(DataScope.All, result.Value.EffectiveDataScope);
        Assert.Equal(DataScope.Team, result.Value.EffectiveWriteDataScope);
        Assert.Equal(OrgLevel.Employee, user.Level);
        db.ChangeTracker.Clear();
        var saved = await db.Users.FindAsync(user.Id);
        Assert.Equal(DataScope.All, saved!.ReadDataScope);
        Assert.Equal(DataScope.Team, saved.WriteDataScope);
    }
}
