using MGT.Portal.Api.Modules.Identity;

namespace MGT.Portal.Api.Modules.Apps;

public static class ApplicationQueryExtensions
{
    /// <summary>
    /// กรองรายการ Application ตามขอบเขตข้อมูล — กรองใน WHERE ตั้งแต่ต้น
    /// ไม่ใช่ดึงมาทั้งหมดแล้วค่อยคัดทีหลัง เพื่อไม่ให้ข้อมูลหลุดออกจากฐานข้อมูลโดยไม่จำเป็น
    /// </summary>
    public static IQueryable<Application> WithinBoundary(this IQueryable<Application> query, DataBoundary boundary)
        => boundary.SeesAll ? query : query.Where(a => boundary.UserIds.Contains(a.OwnerUserId));
}
