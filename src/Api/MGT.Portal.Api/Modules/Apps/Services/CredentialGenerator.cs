using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>ออก Token ID/Secret ให้ Application ตาม environment และหมวด API (1 token ต่อ 1 หมวด)</summary>
public static class CredentialGenerator
{
    public static AppCredential NewAppCredential(string env, string category)
    {
        var prefix = RandomTokens.EnvPrefix(env);
        var cat = ApplicationWorkflow.NormalizeCategory(category);
        return new AppCredential
        {
            Env = env,
            Category = cat,
            // ใส่ชื่อหมวดใน Token ID ให้เห็นทันทีว่า token นี้ใช้กับ API เส้นไหน
            TokenId = $"mgc_id_{prefix}_{cat}_{RandomTokens.Hex(6)}",
            TokenSecret = $"mgc_secret_{prefix}_{RandomTokens.Hex(16)}",
            CreatedAt = DateTime.UtcNow,
        };
    }
}
