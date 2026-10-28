using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MGT.Portal.Api.Shared;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// Zoho ตอบไม่สำเร็จ หรือยังไม่ได้ตั้งค่า — StatusCode คือ status ที่ Gateway จะตอบแอป
/// MayHaveChanged = true เมื่อ Zoho อาจบันทึกไปแล้ว (timeout หลังส่ง หรือ 5xx ของคำขอเขียน)
/// </summary>
public class ZohoException(int statusCode, string message, bool mayHaveChanged = false, bool notConfigured = false, JsonNode? details = null)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public bool MayHaveChanged { get; } = mayHaveChanged;
    public bool NotConfigured { get; } = notConfigured;
    /// <summary>JSON error เดิมของ Zoho (ส่งต่อให้แอปใน field "zoho")</summary>
    public JsonNode? Details { get; } = details;
}

public sealed record ZohoSettings(string ClientId, string ClientSecret, string RefreshToken, string AccountsUrl, string ApiDomain);

public sealed record ZohoResponse(int StatusCode, string Body);

/// <summary>
/// เก็บ access token ของ Zoho ต่อ env ไว้ในหน่วยความจำ (อายุ 1 ชั่วโมง ต่ออายุก่อนหมด 5 นาที)
/// Singleton — ใช้ร่วมกันทุกคำขอ เพื่อไม่ขอ token ใหม่ทุกครั้ง (Zoho จำกัดจำนวนการขอ token)
/// </summary>
public class ZohoTokenStore
{
    private readonly ConcurrentDictionary<string, (string Token, DateTimeOffset Expires)> _tokens = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public async Task<string> GetAsync(string env, Func<Task<(string Token, int ExpiresIn)>> refresh, CancellationToken ct)
    {
        if (_tokens.TryGetValue(env, out var cached) && cached.Expires > DateTimeOffset.UtcNow) return cached.Token;
        var gate = _locks.GetOrAdd(env, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            if (_tokens.TryGetValue(env, out cached) && cached.Expires > DateTimeOffset.UtcNow) return cached.Token;
            var (token, expiresIn) = await refresh();
            _tokens[env] = (token, DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, expiresIn - 300)));
            return token;
        }
        finally
        {
            gate.Release();
        }
    }

    public void Invalidate(string env) => _tokens.TryRemove(env, out _);
}

/// <summary>
/// เรียก Zoho CRM REST API v8 ด้วย OAuth refresh token (Self Client)
///   sandbox    : ZohoConfig:sandbox:ClientId / ClientSecret / RefreshToken / AccountsUrl / ApiDomain
///   production : ZohoConfig:prod:...
/// Gateway เลือก env ตาม token ของแอป (ไม่ใช้ ZohoConfig:ActiveEnvironment)
/// </summary>
public class ZohoCrmClient(IHttpClientFactory factory, IConfiguration config, ZohoTokenStore tokens)
{
    public const string HttpClientName = "zoho";
    public const string ApiPath = "/crm/v8";

    public static string ConfigSection(string env) => env == CredEnv.Production ? "ZohoConfig:prod" : "ZohoConfig:sandbox";

    public ZohoSettings Settings(string env)
    {
        var section = ConfigSection(env);
        string Get(string key) => config[$"{section}:{key}"]?.Trim() ?? "";
        var s = new ZohoSettings(Get("ClientId"), Get("ClientSecret"), Get("RefreshToken"), Get("AccountsUrl"), Get("ApiDomain"));
        var missing = new[] { ("ClientId", s.ClientId), ("ClientSecret", s.ClientSecret), ("RefreshToken", s.RefreshToken), ("AccountsUrl", s.AccountsUrl), ("ApiDomain", s.ApiDomain) }
            .Where(p => p.Item2.Length == 0).Select(p => $"{section}:{p.Item1}").ToList();
        if (missing.Count > 0)
            throw new ZohoException(503, "ยังไม่ได้ตั้งค่า " + string.Join(", ", missing), notConfigured: true);
        return s;
    }

    /// <summary>ส่งคำขอไป {ApiDomain}/crm/v8{pathAndQuery} — ถ้า token หมดอายุ (401) จะขอใหม่แล้วลองอีกครั้งเดียว</summary>
    public async Task<ZohoResponse> SendAsync(string env, HttpMethod method, string pathAndQuery, string? jsonBody, bool isWrite, CancellationToken ct)
    {
        var settings = Settings(env);
        var http = factory.CreateClient(HttpClientName);
        var url = settings.ApiDomain.TrimEnd('/') + ApiPath + pathAndQuery;

        for (var attempt = 0; ; attempt++)
        {
            var token = await tokens.GetAsync(env, () => RefreshAsync(http, settings, ct), ct);
            using var req = new HttpRequestMessage(method, url);
            req.Headers.TryAddWithoutValidation("Authorization", "Zoho-oauthtoken " + token);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (jsonBody is not null) req.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            HttpResponseMessage res;
            try
            {
                res = await http.SendAsync(req, ct);
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            {
                throw new ZohoException(504, isWrite
                    ? "Zoho ไม่ตอบภายในเวลาที่กำหนด — คำขออาจถูกบันทึกแล้ว ตรวจใน Zoho ก่อนส่งใหม่"
                    : "Zoho ไม่ตอบภายในเวลาที่กำหนด", isWrite);
            }
            catch (HttpRequestException ex)
            {
                throw new ZohoException(502, "เชื่อมต่อ Zoho ไม่ได้: " + ex.Message, isWrite);
            }

            using (res)
            {
                var body = await res.Content.ReadAsStringAsync(ct);
                // token ถูกเพิกถอนหรือหมดอายุก่อนเวลา — Zoho ยังไม่ได้ทำอะไร ขอ token ใหม่แล้วลองอีกครั้ง
                if (res.StatusCode == HttpStatusCode.Unauthorized && attempt == 0)
                {
                    tokens.Invalidate(env);
                    continue;
                }
                return new ZohoResponse((int)res.StatusCode, body);
            }
        }
    }

    private static async Task<(string Token, int ExpiresIn)> RefreshAsync(HttpClient http, ZohoSettings s, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, s.AccountsUrl.TrimEnd('/') + "/oauth/v2/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["refresh_token"] = s.RefreshToken,
                ["client_id"] = s.ClientId,
                ["client_secret"] = s.ClientSecret,
                ["grant_type"] = "refresh_token",
            }),
        };
        HttpResponseMessage res;
        try
        {
            res = await http.SendAsync(req, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException && !ct.IsCancellationRequested)
        {
            throw new ZohoException(502, "ขอ access token จาก Zoho ไม่ได้: " + ex.Message);
        }

        using (res)
        {
            var text = await res.Content.ReadAsStringAsync(ct);
            // Zoho ตอบ 200 แม้ refresh token ผิด — ต้องดู field "error"
            try
            {
                using var doc = JsonDocument.Parse(text);
                var root = doc.RootElement;
                if (root.TryGetProperty("access_token", out var at) && at.GetString() is { Length: > 0 } token)
                    return (token, root.TryGetProperty("expires_in", out var exp) && exp.TryGetInt32(out var sec) ? sec : 3600);
                var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;
                throw new ZohoException(502, $"Zoho ไม่ออก access token ({error ?? "HTTP " + (int)res.StatusCode}) — ตรวจ ClientId / ClientSecret / RefreshToken / AccountsUrl");
            }
            catch (JsonException)
            {
                throw new ZohoException(502, $"Zoho ไม่ออก access token (HTTP {(int)res.StatusCode})");
            }
        }
    }
}
