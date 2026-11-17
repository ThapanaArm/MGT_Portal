using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Modules.Access;

namespace MGT.Portal.Api.Modules.Apps;

/// <summary>
/// ผู้ใช้ที่แอปส่ง User token มา และขอบเขตข้อมูลที่เขาเห็นได้ในระบบหนึ่ง
/// SeesAll = true → ไม่ต้องกรอง / false → เห็นเฉพาะระเบียนที่เจ้าของอยู่ใน OwnerIds (รหัสพนักงานของระบบนั้น)
/// SaleGroupKey มีค่าเมื่อเป็น Sales Manager — ระบบที่เก็บ Sale group ในข้อมูลด้วย (เช่น SaleOrder) กรองด้วยกลุ่มแทนรายชื่อคน
/// </summary>
public sealed record GatewayUserScope(int UserId, string Email, string Scope, bool SeesAll, IReadOnlyList<string> OwnerIds,
    string? SaleGroupKey = null);

public sealed record GatewayUserResult(GatewayUserScope? User, string? Error, int StatusCode = StatusCodes.Status401Unauthorized)
{
    public bool Ok => User is not null;
}

/// <summary>
/// แปลง User token → ผู้ใช้ → ขอบเขตข้อมูล (DataBoundaryResolver) → รหัสเจ้าของข้อมูลในระบบปลายทาง (UserPlatformIds)
/// ระดับสิทธิ์: Management (CEO/CFO/CMO) เห็นทั้งหมด · Manager เห็นทั้งแผนก · Sales Manager เห็นทั้ง Sale group · Employee เห็นของตัวเอง
/// สิทธิ์ admin ของหน้า Portal ไม่ทำให้เห็นข้อมูลธุรกิจทั้งหมด — ใช้ระดับองค์กรเท่านั้น
/// </summary>
public class GatewayUserContext(PortalDbContext db, DataBoundaryResolver boundaries)
{
    public const string Header = "X-User-Token";

    public async Task<GatewayUserResult> ResolveAsync(string? token, string platform, CancellationToken ct, string? resourceKey = null, bool forWrite = false)
    {
        if (string.IsNullOrWhiteSpace(token))
            return new(null, $"ต้องส่ง header {Header} ของผู้ใช้ที่กำลังใช้แอป (สร้างได้ที่หน้า My tokens ใน Portal)");

        var hash = UserTokenGenerator.Hash(token);
        var now = DateTime.UtcNow;
        var row = await db.UserTokens.Include(t => t.User).ThenInclude(u => u.SaleGroup)
            .Include(t => t.User).ThenInclude(u => u.Role).FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (row is null || row.RevokedAt is not null || row.ExpiresAt <= now)
            return new(null, "User token ไม่ถูกต้อง หมดอายุ หรือถูกยกเลิกแล้ว");

        // บันทึกเวลาใช้ล่าสุด (ไม่เกินทุก 5 นาที เพื่อไม่เขียนฐานข้อมูลทุก request)
        if (row.LastUsedAt is null || row.LastUsedAt < now.AddMinutes(-5))
        {
            row.LastUsedAt = now;
            await db.SaveChangesAsync(ct);
        }

        var user = row.User;
        string? operationScope = null;
        if (resourceKey is not null)
        {
            operationScope = await new ApiPermissionService(db).ScopeAsync(user, resourceKey, forWrite, ct);
            if (operationScope == ApiPermissionService.None)
                return new(null, $"User is not allowed to {(forWrite ? "change" : "read")} this API", StatusCodes.Status403Forbidden);
        }
        var boundary = await boundaries.ResolveAsync(user, isAdmin: false, forWrite: forWrite, scopeOverride: operationScope);
        if (boundary.SeesAll)
            return new(new GatewayUserScope(user.Id, user.Email, boundary.Scope, true, []), null);

        var key = platform.Trim().ToLowerInvariant();
        var userIds = boundary.UserIds.ToList();
        var ownerIds = await db.UserPlatformIds
            .Where(p => p.Platform == key && userIds.Contains(p.UserId))
            .Select(p => p.ExternalId)
            .Distinct()
            .ToListAsync(ct);
        var groupKey = boundary.Scope == DataScope.SaleGroup ? user.SaleGroup?.Key : null;
        return new(new GatewayUserScope(user.Id, user.Email, boundary.Scope, false, ownerIds, groupKey), null);
    }
}
