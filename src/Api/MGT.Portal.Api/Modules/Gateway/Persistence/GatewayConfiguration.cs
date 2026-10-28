using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Gateway;

internal sealed class GatewayWriteRecordConfiguration : IEntityTypeConfiguration<GatewayWriteRecord>
{
    public void Configure(EntityTypeBuilder<GatewayWriteRecord> b)
    {
        b.Property(r => r.ApplicationName).HasMaxLength(200);
        b.Property(r => r.Env).HasMaxLength(20);
        b.Property(r => r.Operation).HasMaxLength(50);
        b.Property(r => r.IdempotencyKey).HasMaxLength(100);
        b.Property(r => r.RequestHash).HasMaxLength(64);
        b.Property(r => r.SalesOrder).HasMaxLength(10);

        // ไม่ผูก FK กับ Applications — audit log ต้องอยู่ต่อแม้แอปถูกลบ
        // unique index นี้คือตัวกันคำขอซ้ำ: แอปเดียวกัน env เดียวกัน ใช้ key เดิมได้ครั้งเดียว
        b.HasIndex(r => new { r.ApplicationId, r.Env, r.IdempotencyKey }).IsUnique();
        b.HasIndex(r => new { r.ApplicationId, r.Env, r.SalesOrder });
    }
}
