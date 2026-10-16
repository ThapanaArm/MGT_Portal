using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Access;

/// <summary>ออก token ส่วนตัวแบบกำหนด scope จากหน้า "My Tokens"</summary>
public static class ScopeTokenGenerator
{
    public static string New(string env) => $"mgc_{RandomTokens.EnvPrefix(env)}_{RandomTokens.Hex(10)}";
}
