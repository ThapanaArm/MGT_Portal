using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.UnitTests;

/// <summary>
/// กติกาว่า credential แต่ละ env ออกและใช้ได้เมื่อไร (ApplicationWorkflow.CredentialAllowed)
///   Sandbox    : ตั้งแต่ IT เตรียม repo เสร็จ (development / review) และหลังอนุมัติ
///   Production : หลังอนุมัติเท่านั้น
/// </summary>
public class CredentialRulesTests
{
    private static Application App(string status, string type = AppTier.Tier1, string products = "sales",
        string? stage = null, string targetTier = AppTier.Tier2)
    {
        var app = new Application { Status = status, Type = type, ProductsCsv = products };
        if (stage is not null) DevelopmentProcess.Write(app, new DevelopmentRequest(stage, targetTier));
        return app;
    }

    [Theory]
    [InlineData("development", AppStatus.Draft)]
    [InlineData("review", AppStatus.Pending)]
    public void Sandbox_is_allowed_once_IT_preparation_is_complete(string stage, string status) =>
        Assert.True(ApplicationWorkflow.CredentialAllowed(App(status, stage: stage), CredEnv.Sandbox).Ok);

    [Theory]
    [InlineData("draft")]
    [InlineData("setup")]
    public void Sandbox_is_not_allowed_before_IT_preparation_is_complete(string stage) =>
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Draft, stage: stage), CredEnv.Sandbox).Ok);

    [Fact]
    public void Sandbox_needs_requested_APIs_and_an_API_tier()
    {
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Draft, products: "", stage: "development"), CredEnv.Sandbox).Ok);
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Draft, stage: "development", targetTier: AppTier.Tier1), CredEnv.Sandbox).Ok);
    }

    [Theory]
    [InlineData("development", AppStatus.Draft)]
    [InlineData("review", AppStatus.Pending)]
    public void Production_is_not_allowed_before_approval(string stage, string status) =>
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(status, stage: stage), CredEnv.Production).Ok);

    [Theory]
    [InlineData(CredEnv.Sandbox)]
    [InlineData(CredEnv.Production)]
    public void Both_are_allowed_after_approval_for_API_tiers(string env) =>
        Assert.True(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Active, AppTier.Tier2, stage: "approved"), env).Ok);

    [Theory]
    [InlineData(CredEnv.Sandbox)]
    [InlineData(CredEnv.Production)]
    public void Nothing_is_allowed_for_suspended_or_tier1_apps(string env)
    {
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Suspended, AppTier.Tier2, stage: "approved"), env).Ok);
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Active, AppTier.Tier1), env).Ok);
    }

    [Fact]
    public void Unknown_environment_is_rejected() =>
        Assert.False(ApplicationWorkflow.CredentialAllowed(App(AppStatus.Active, AppTier.Tier2), "staging").Ok);
}
