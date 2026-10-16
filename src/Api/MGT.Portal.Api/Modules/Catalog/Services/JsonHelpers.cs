using System.Text.Json;

namespace MGT.Portal.Api.Modules.Catalog;

public static class JsonHelpers
{
    public static List<List<string>> ParseRows(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<List<string>>>(json) ?? new();
        }
        catch
        {
            return new();
        }
    }
}
