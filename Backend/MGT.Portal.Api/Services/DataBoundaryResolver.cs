using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Data;
using MGT.Portal.Api.Models;

namespace MGT.Portal.Api.Services;

/// <summary>ขอบเขตข้อมูลที่ผู้ใช้คนหนึ่งมองเห็นได้ — ผลลัพธ์ที่คำนวณแล้วของ DataBoundaryResolver</summary>
public sealed class DataBoundary
{
    /// <summary>true = เห็นได้ทุกแถว ไม่ต้องกรอง</summary>
    public required bool SeesAll { get; init; }

    /// <summary>UserId ทั้งหมดที่ผู้ใช้คนนี้เห็นข้อมูลได้ (ใช้เมื่อ SeesAll = false)</summary>
    public required IReadOnlyList<int> UserIds { get; init; }

    /// <summary>ขอบเขตที่มีผลจริง (self / team / all) — ใช้แสดงผลและ log</summary>
    public required string Scope { get; init; }

    public bool Allows(int ownerUserId) => SeesAll || UserIds.Contains(ownerUserId);
}

/// <summary>
/// แปลง "ระดับองค์กร + ทีม + override" ของผู้ใช้ ให้เป็นรายชื่อเจ้าของข้อมูลที่เขามีสิทธิ์เห็น
///
/// เงื่อนไขตามที่ธุรกิจกำหนด:
///   Management → เห็นทั้งหมด
///   Manager    → เห็นเฉพาะสมาชิกในทีมตัวเอง
///   Employee   → เห็นเฉพาะของตัวเอง
/// และรองรับกรณีบางตำแหน่งต้องเห็นกว้างกว่าระดับปกติ ผ่าน User.DataScopeOverride
/// </summary>
public class DataBoundaryResolver(PortalDbContext db)
{
    /// <param name="isAdmin">
    /// มาจาก role claim ใน token โดยตรง ไม่พึ่ง navigation property ที่อาจยังไม่ถูก Include
    /// </param>
    public async Task<DataBoundary> ResolveAsync(User me, bool isAdmin)
    {
        var scope = me.EffectiveDataScope;

        // ผู้ดูแลระบบเห็นทุกอย่างเสมอ เพื่อให้ดูแลและตรวจสอบระบบได้
        if (isAdmin || scope == DataScope.All)
            return new DataBoundary { SeesAll = true, UserIds = Array.Empty<int>(), Scope = DataScope.All };

        if (scope == DataScope.Team && me.TeamId is not null)
        {
            var teamMemberIds = await db.Users
                .Where(u => u.TeamId == me.TeamId)
                .Select(u => u.Id)
                .ToListAsync();

            // เผื่อกรณีข้อมูลทีมยังไม่ครบ ให้ตัวเองอยู่ในขอบเขตเสมอ
            if (!teamMemberIds.Contains(me.Id)) teamMemberIds.Add(me.Id);

            return new DataBoundary { SeesAll = false, UserIds = teamMemberIds, Scope = DataScope.Team };
        }

        // Manager ที่ยังไม่ถูกจัดทีม ถือว่าเห็นเฉพาะของตัวเอง — แคบไว้ก่อนปลอดภัยกว่ากว้างเกิน
        return new DataBoundary { SeesAll = false, UserIds = new[] { me.Id }, Scope = DataScope.Self };
    }
}

public static class DataBoundaryExtensions
{
    /// <summary>
    /// กรองรายการ Application ตามขอบเขตข้อมูล — กรองใน WHERE ตั้งแต่ต้น
    /// ไม่ใช่ดึงมาทั้งหมดแล้วค่อยคัดทีหลัง เพื่อไม่ให้ข้อมูลหลุดออกจากฐานข้อมูลโดยไม่จำเป็น
    /// </summary>
    public static IQueryable<Application> WithinBoundary(this IQueryable<Application> query, DataBoundary boundary)
        => boundary.SeesAll ? query : query.Where(a => boundary.UserIds.Contains(a.OwnerUserId));
}
