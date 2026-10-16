using System.Security.Claims;

namespace MGT.Portal.Api.Shared;

/// <summary>อ่านข้อมูลผู้ใช้ที่ login อยู่จาก claims — ใช้แทนการเขียน FindFirst ซ้ำในทุก controller</summary>
public static class CurrentUser
{
    public static int Id(this ClaimsPrincipal user) =>
        int.Parse(user.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    public static string? Email(this ClaimsPrincipal user) =>
        user.FindFirst(ClaimTypes.Email)?.Value;

    public static bool IsAdmin(this ClaimsPrincipal user) => user.IsInRole("admin");
}
