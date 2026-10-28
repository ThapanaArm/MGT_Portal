using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Apps;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>แอปที่ผ่านการตรวจแล้ว — ใช้บันทึก log ว่าใครเรียก</summary>
public sealed record GatewayCaller(int ApplicationId, string ApplicationName, string Env);

public sealed record GatewayAuthResult(GatewayCaller? Caller, int StatusCode, string? Error)
{
    public bool Ok => Caller is not null;
    public static GatewayAuthResult Pass(GatewayCaller caller) => new(caller, StatusCodes.Status200OK, null);
    public static GatewayAuthResult Fail(int statusCode, string error) => new(null, statusCode, error);
}

/// <summary>
/// ตรวจ Token ID/Secret ของ Application ที่เรียก Gateway
/// ผ่านเมื่อ credential ยังไม่ถูกเพิกถอน, เป็น token ของหมวดที่เรียก (1 token ต่อ 1 หมวด),
/// ApplicationWorkflow.CredentialAllowed อนุญาต env นั้น (Sandbox ตั้งแต่ IT เตรียมเสร็จ / Production หลังอนุมัติ)
/// และแอปขอ API หมวดนั้นไว้ใน ProductsCsv
/// </summary>
public class GatewayAuth(PortalDbContext db)
{
    public const string TokenIdHeader = "X-Token-Id";
    public const string TokenSecretHeader = "X-Token-Secret";

    public async Task<GatewayAuthResult> AuthenticateAsync(HttpRequest request, string categoryKey, CancellationToken ct)
    {
        var tokenId = request.Headers[TokenIdHeader].ToString().Trim();
        var tokenSecret = request.Headers[TokenSecretHeader].ToString().Trim();
        if (tokenId.Length == 0 || tokenSecret.Length == 0)
            return GatewayAuthResult.Fail(StatusCodes.Status401Unauthorized,
                $"ต้องส่ง header {TokenIdHeader} และ {TokenSecretHeader} ที่ได้จากหน้ารายละเอียดแอปใน Portal");

        var cred = await db.AppCredentials
            .AsNoTracking()
            .Include(c => c.Application)
            .FirstOrDefaultAsync(c => c.TokenId == tokenId && !c.Revoked, ct);

        if (cred is null || !SecretMatches(cred.TokenSecret, tokenSecret))
            return GatewayAuthResult.Fail(StatusCodes.Status401Unauthorized,
                "Token ID หรือ Secret ไม่ถูกต้อง หรือถูกเพิกถอนแล้ว");

        if (!string.Equals(cred.Category, categoryKey, StringComparison.OrdinalIgnoreCase))
            return GatewayAuthResult.Fail(StatusCodes.Status403Forbidden,
                $"token นี้ใช้ได้กับ API หมวด {cred.Category} เท่านั้น — ใช้ token ของหมวด {categoryKey} จากหน้ารายละเอียดแอป");

        var app = cred.Application;
        var allowed = ApplicationWorkflow.CredentialAllowed(app, cred.Env);
        if (!allowed.Ok)
            return GatewayAuthResult.Fail(StatusCodes.Status403Forbidden,
                $"credential {cred.Env} ของแอปนี้ยังใช้ไม่ได้: {allowed.Error}");

        var approved = app.ProductsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!approved.Contains(categoryKey, StringComparer.OrdinalIgnoreCase))
            return GatewayAuthResult.Fail(StatusCodes.Status403Forbidden,
                $"แอปนี้ไม่ได้ขอใช้ API หมวด {categoryKey} ใน Portal");

        return GatewayAuthResult.Pass(new GatewayCaller(app.Id, app.Name, cred.Env));
    }

    private static bool SecretMatches(string expected, string actual) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(actual));
}
