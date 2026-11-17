using System.Security.Cryptography;
using System.Text;

namespace MGT.Portal.Api.Modules.Identity;

/// <summary>สร้างและ hash User token — รูปแบบ mgtu_ + 40 ตัวอักษรสุ่ม</summary>
public static class UserTokenGenerator
{
    public const string Prefix = "mgtu_";
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    public static string New() => Prefix + RandomNumberGenerator.GetString(Alphabet, 40);

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim()))).ToLowerInvariant();

    /// <summary>ส่วนที่แสดงให้ผู้ใช้จำได้ เช่น mgtu_AbC1…</summary>
    public static string Display(string token) => token[..Math.Min(token.Length, Prefix.Length + 4)];
}
