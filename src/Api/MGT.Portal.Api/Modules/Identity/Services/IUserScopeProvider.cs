namespace MGT.Portal.Api.Modules.Identity;

/// <summary>
/// ให้ module อื่นเพิ่ม scope ให้ผู้ใช้นอกเหนือจาก Role ได้ โดยที่ Identity ไม่ต้องรู้จัก module นั้น
/// (ตอนนี้ Access เป็นผู้ implement — คืน scope จาก AccessGrant ที่ยังไม่หมดอายุ)
/// </summary>
public interface IUserScopeProvider
{
    Task<IReadOnlyList<string>> GetGrantedScopesAsync(int userId, CancellationToken ct = default);
}
