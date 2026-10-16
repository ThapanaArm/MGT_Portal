using System.Security.Cryptography;

namespace MGT.Portal.Api.Shared;

public static class RandomTokens
{
    /// <summary>สตริง hex ตัวพิมพ์เล็กจาก random bytes ที่ปลอดภัยทาง cryptography</summary>
    public static string Hex(int bytes = 12)
    {
        var buf = RandomNumberGenerator.GetBytes(bytes);
        return Convert.ToHexString(buf).ToLowerInvariant();
    }

    public static string EnvPrefix(string env) => env == CredEnv.Production ? "live" : "test";
}
