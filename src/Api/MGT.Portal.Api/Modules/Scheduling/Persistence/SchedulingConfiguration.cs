using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MGT.Portal.Api.Modules.Scheduling;

internal sealed class CalendarEventConfiguration : IEntityTypeConfiguration<CalendarEvent>
{
    public void Configure(EntityTypeBuilder<CalendarEvent> b)
    {
        b.Property(e => e.Kind).HasMaxLength(20);
        b.Property(e => e.Status).HasMaxLength(20);
        b.Property(e => e.Title).HasMaxLength(200);
        b.Property(e => e.Note).HasMaxLength(2000);
        b.Property(e => e.DecisionNote).HasMaxLength(2000);
        b.Property(e => e.CreatedBy).HasMaxLength(256);
        b.Property(e => e.DecidedBy).HasMaxLength(256);
        b.Property(e => e.UpdatedAt).IsConcurrencyToken();

        // ลบคำขอแอปแล้ว รายการในปฏิทินยังอยู่ (ไม่ผูกแอป)
        b.HasOne(e => e.Application).WithMany().HasForeignKey(e => e.ApplicationId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(e => e.RequestedBy).WithMany().HasForeignKey(e => e.RequestedByUserId).OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(e => new { e.StartAt, e.EndAt });
    }
}
