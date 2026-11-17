using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Identity;

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
///   Management    → เห็นทั้งหมด (CEO / CFO / CMO)
///   Manager       → เห็นทุกคนในแผนก (Team) ตัวเอง
///   Sales Manager → เห็นทุกคนใน Sale group ตัวเอง
///   Employee      → เห็นเฉพาะของตัวเอง (Sales และพนักงานทั่วไป)
/// และรองรับกรณีบางตำแหน่งต้องเห็นกว้างกว่าระดับปกติ ผ่าน User.DataScopeOverride
/// </summary>
public class DataBoundaryResolver(PortalDbContext db)
{
    /// <param name="isAdmin">
    /// มาจาก role claim ใน token โดยตรง ไม่พึ่ง navigation property ที่อาจยังไม่ถูก Include
    /// </param>
    public async Task<DataBoundary> ResolveAsync(User me, bool isAdmin, bool forWrite = false, string? scopeOverride = null)
    {
        var scope = scopeOverride ?? (forWrite ? me.EffectiveWriteDataScope : me.EffectiveDataScope);

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

        if (scope == DataScope.SaleGroup && me.SaleGroupId is not null)
        {
            var groupMemberIds = await db.Users
                .Where(u => u.SaleGroupId == me.SaleGroupId)
                .Select(u => u.Id)
                .ToListAsync();
            if (!groupMemberIds.Contains(me.Id)) groupMemberIds.Add(me.Id);
            return new DataBoundary { SeesAll = false, UserIds = groupMemberIds, Scope = DataScope.SaleGroup };
        }

        // Manager / Sales Manager ที่ยังไม่ถูกจัดทีมหรือกลุ่ม ถือว่าเห็นเฉพาะของตัวเอง — แคบไว้ก่อนปลอดภัยกว่ากว้างเกิน
        return new DataBoundary { SeesAll = false, UserIds = new[] { me.Id }, Scope = DataScope.Self };
    }
}
