namespace MGT.Portal.Api.Shared;

/// <summary>สภาพแวดล้อมของ credential — ใช้ร่วมกันระหว่าง Apps (Token ID/Secret ของ App) และ Access (token ส่วนตัว)</summary>
public static class CredEnv
{
    public const string Sandbox = "sandbox";
    public const string Production = "production";
}
