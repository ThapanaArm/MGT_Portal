using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;

namespace MGT.Portal.Api.Modules.Identity;

public sealed record DirectoryUserRow(string Email, [property: JsonIgnore] string? Password, string Department, string Division, string UserRole, bool IsActive = true);
public interface IUserDirectorySource
{
    Task<IReadOnlyList<DirectoryUserRow>> ReadAsync(string salesOrganization, CancellationToken ct);
}
public sealed class SqlUserDirectorySource(IConfiguration config) : IUserDirectorySource
{
    public async Task<IReadOnlyList<DirectoryUserRow>> ReadAsync(string salesOrganization, CancellationToken ct)
    {
        UserDirectorySync.ValidateSalesOrganization(salesOrganization);
        var connectionString = config.GetConnectionString("Datawarehouse") ?? config.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("The user directory connection is not configured");
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT [Email], CASE WHEN [IsActive] = 1 THEN [Password] END, [Department], [Division], [UserRole], [IsActive] FROM [MGT_Datawarehouse].[dbo].[Ms_User] WHERE [SalesOrganization] = @SalesOrganization AND [IsActive] IN (0, 1)";
        command.Parameters.Add("@SalesOrganization", System.Data.SqlDbType.VarChar, 4).Value = salesOrganization;
        command.CommandTimeout = 60;
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<DirectoryUserRow>();
        while (await reader.ReadAsync(ct))
        {
            string Text(int index) => reader.IsDBNull(index) ? "" : Convert.ToString(reader.GetValue(index), System.Globalization.CultureInfo.InvariantCulture) ?? "";
            rows.Add(new(Text(0), reader.IsDBNull(1) ? null : Text(1), Text(2), Text(3), Text(4), Convert.ToInt32(reader.GetValue(5)) == 1));
        }
        return rows;
    }
}
