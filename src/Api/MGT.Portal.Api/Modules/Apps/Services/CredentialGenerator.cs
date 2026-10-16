using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>ออก Token ID/Secret ให้ Application ตาม environment</summary>
public static class CredentialGenerator
{
    public static AppCredential NewAppCredential(string env)
    {
        var prefix = RandomTokens.EnvPrefix(env);
        return new AppCredential
        {
            Env = env,
            TokenId = $"mgc_id_{prefix}_{RandomTokens.Hex(6)}",
            TokenSecret = $"mgc_secret_{prefix}_{RandomTokens.Hex(16)}",
            CreatedAt = DateTime.UtcNow,
        };
    }
}
