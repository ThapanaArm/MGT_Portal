using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Gateway;

public enum WriteStartKind
{
    /// <summary>คำขอใหม่ — บันทึกไว้แล้ว ทำต่อได้</summary>
    Started,
    /// <summary>key นี้ทำเสร็จไปแล้ว — ส่งผลเดิมกลับ</summary>
    Replay,
    /// <summary>key นี้กำลังทำอยู่ (หรือค้างจากครั้งก่อน)</summary>
    InProgress,
    /// <summary>key นี้เคยใช้กับคำขออื่น (body หรือ SO ต่างกัน)</summary>
    KeyReused,
}

public sealed record WriteStart(WriteStartKind Kind, GatewayWriteRecord Record);

/// <summary>
/// Idempotency-Key + audit log ของคำขอเขียนผ่าน Gateway (ตาราง GatewayWriteRecords)
/// แอปส่ง key ใหม่ (เช่น UUID) ทุกครั้งที่เป็นคำขอใหม่ ถ้าเน็ตหลุดแล้วส่งซ้ำด้วย key เดิม จะได้ผลเดิม ไม่สร้าง SO ซ้ำ
/// </summary>
public class GatewayIdempotency(PortalDbContext db)
{
    public const string Header = "Idempotency-Key";
    public const int MaxKeyLength = 100;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    public static string Hash(string operation, string? salesOrder, object body)
    {
        var raw = $"{operation}|{salesOrder}|{JsonSerializer.Serialize(body, Web)}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
    }

    public async Task<WriteStart> BeginAsync(
        GatewayCaller caller, string operation, string key, string? salesOrder, string hash, CancellationToken ct)
    {
        var existing = await FindAsync(caller, key, ct);
        if (existing is not null) return Classify(existing, hash);

        var record = new GatewayWriteRecord
        {
            ApplicationId = caller.ApplicationId,
            ApplicationName = caller.ApplicationName,
            Env = caller.Env,
            Operation = operation,
            IdempotencyKey = key,
            RequestHash = hash,
            SalesOrder = salesOrder,
            StatusCode = 0,
            CreatedAt = DateTime.UtcNow,
        };
        db.GatewayWriteRecords.Add(record);
        try
        {
            await db.SaveChangesAsync(ct);
            return new WriteStart(WriteStartKind.Started, record);
        }
        catch (DbUpdateException)
        {
            // อีกคำขอที่ใช้ key เดียวกันบันทึกตัดหน้าไปพอดี (unique index) — ใช้ของตัวนั้น
            db.Entry(record).State = EntityState.Detached;
            existing = await FindAsync(caller, key, ct) ?? throw new InvalidOperationException("Idempotency record vanished");
            return Classify(existing, hash);
        }
    }

    public async Task CompleteAsync(GatewayWriteRecord record, int statusCode, object response, string? salesOrder)
    {
        record.StatusCode = statusCode;
        record.ResponseJson = JsonSerializer.Serialize(response, Web);
        record.SalesOrder ??= salesOrder;
        record.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>เก็บคำตอบของ SAP ตามที่ได้มา (passthrough) — replay จะได้ body เดิมทุกตัวอักษร</summary>
    public async Task CompleteRawAsync(GatewayWriteRecord record, int statusCode, string responseBody, string? salesOrder)
    {
        record.StatusCode = statusCode;
        record.ResponseJson = responseBody;
        record.SalesOrder ??= salesOrder;
        record.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>SAP ยังไม่ได้เปลี่ยนอะไร — ลบบันทึกทิ้งเพื่อให้ส่งซ้ำด้วย key เดิมได้</summary>
    public async Task AbandonAsync(GatewayWriteRecord record)
    {
        db.GatewayWriteRecords.Remove(record);
        await db.SaveChangesAsync(CancellationToken.None);
    }

    /// <summary>แอปนี้สร้าง Sales Order เลขนี้ผ่าน Gateway ใน env เดียวกันหรือไม่ — ใช้จำกัดสิทธิ์แก้/ยกเลิก</summary>
    public Task<bool> CreatedByAsync(GatewayCaller caller, string salesOrder, CancellationToken ct) =>
        db.GatewayWriteRecords.AnyAsync(r =>
            r.ApplicationId == caller.ApplicationId && r.Env == caller.Env &&
            r.Operation == GatewayWriteOperation.CreateSalesOrder &&
            r.SalesOrder == salesOrder && r.StatusCode == StatusCodes.Status201Created, ct);

    /// <summary>
    /// แอปนี้สร้างระเบียน Zoho id นี้ผ่าน Gateway ใน env เดียวกันหรือไม่ — Zoho id ยาวเกินคอลัมน์ SalesOrder
    /// จึงหาจากคำตอบของ Zoho ที่เก็บไว้ (เก็บแบบ compact JSON: "id":"…")
    /// </summary>
    public Task<bool> CreatedZohoRecordAsync(GatewayCaller caller, string createOperation, string recordId, CancellationToken ct)
    {
        var needle = $"\"id\":\"{recordId}\"";
        return db.GatewayWriteRecords.AnyAsync(r =>
            r.ApplicationId == caller.ApplicationId && r.Env == caller.Env &&
            r.Operation == createOperation && r.StatusCode >= 200 && r.StatusCode < 300 &&
            r.ResponseJson != null && r.ResponseJson.Contains(needle), ct);
    }

    private Task<GatewayWriteRecord?> FindAsync(GatewayCaller caller, string key, CancellationToken ct) =>
        db.GatewayWriteRecords.FirstOrDefaultAsync(r =>
            r.ApplicationId == caller.ApplicationId && r.Env == caller.Env && r.IdempotencyKey == key, ct);

    private static WriteStart Classify(GatewayWriteRecord existing, string hash)
    {
        // hash รวม operation + เลข SO + body ไว้แล้ว ต่างกันตรงไหนก็ถือว่าเป็นคำขออื่น
        if (existing.RequestHash != hash)
            return new WriteStart(WriteStartKind.KeyReused, existing);
        return new WriteStart(existing.StatusCode == 0 ? WriteStartKind.InProgress : WriteStartKind.Replay, existing);
    }
}
