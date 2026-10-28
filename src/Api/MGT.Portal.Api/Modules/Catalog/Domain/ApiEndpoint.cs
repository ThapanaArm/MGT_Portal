namespace MGT.Portal.Api.Modules.Catalog;

public class ApiEndpoint
{
    public int Id { get; set; }

    public int CategoryId { get; set; }
    public ApiCategory Category { get; set; } = null!;

    public string Method { get; set; } = "GET"; // GET, POST, PUT, PATCH, DELETE
    public string Path { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Description { get; set; } = "";
    public string Scope { get; set; } = "";
    public string SourcePlatform { get; set; } = "";

    /// <summary>Font Awesome icon key (fa:search, fa:plus …) shown in the card headline.</summary>
    public string Icon { get; set; } = "fa:clipboard";
    /// <summary>Real-world "when would I use this" one-liner for non-technical users.</summary>
    public string Scenario { get; set; } = "";

    // Stored as JSON arrays for flexibility (matches the prototype's shape).
    public string ParamsJson { get; set; } = "[]";
    public string? ReqBody { get; set; }
    public string RespExample { get; set; } = "{}";
    public string RespFieldsJson { get; set; } = "[]";
}
