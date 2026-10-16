namespace MGT.Portal.Api.Modules.Catalog;

public class ApiCategory
{
    public int Id { get; set; }
    public string Key { get; set; } = ""; // sales, purchase, inventory, finance, hr
    public string Name { get; set; } = "";
    public string BasePath { get; set; } = ""; // /api/v1/sales
    public string Description { get; set; } = "";
    public string RateLimit { get; set; } = "";

    public ICollection<ApiEndpoint> Endpoints { get; set; } = new List<ApiEndpoint>();
}
