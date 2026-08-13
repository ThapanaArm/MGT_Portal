namespace MGT.Portal.Api.Models;

public class Role
{
    public int Id { get; set; }
    public string Key { get; set; } = ""; // admin, sales, purchase, finance, hr
    public string Name { get; set; } = "";
    public string ScopesCsv { get; set; } = ""; // comma-separated scopes, "*" for admin

    public ICollection<User> Users { get; set; } = new List<User>();

    public IEnumerable<string> Scopes => ScopesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries);
}
