using System.Security.Cryptography;
using MGT.Portal.Api.Models;

namespace MGT.Portal.Api.Services;

public static class CredentialGenerator
{
    private static string RandomToken(int bytes = 12)
    {
        var buf = RandomNumberGenerator.GetBytes(bytes);
        return Convert.ToHexString(buf).ToLowerInvariant();
    }

    public static AppCredential NewAppCredential(string env)
    {
        var prefix = env == CredEnv.Production ? "live" : "test";
        return new AppCredential
        {
            Env = env,
            TokenId = $"mgc_id_{prefix}_{RandomToken(6)}",
            TokenSecret = $"mgc_secret_{prefix}_{RandomToken(16)}",
            CreatedAt = DateTime.UtcNow,
        };
    }

    public static string NewScopeToken(string env)
    {
        var prefix = env == CredEnv.Production ? "live" : "test";
        return $"mgc_{prefix}_{RandomToken(10)}";
    }
}
