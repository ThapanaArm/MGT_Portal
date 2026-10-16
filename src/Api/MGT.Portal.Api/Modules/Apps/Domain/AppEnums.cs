namespace MGT.Portal.Api.Modules.Apps;

public static class AppType
{
    public const string Registered = "registered";
    public const string Verify = "verify";
    public const string Official = "official";
}

public static class AppStatus
{
    public const string Draft = "draft";
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Suspended = "suspended";
}

public static class LogActionType
{
    public const string Create = "create";
    public const string Review = "review";
    public const string Update = "update";
    public const string Publish = "publish";
    public const string Unpublish = "unpublish";
}
