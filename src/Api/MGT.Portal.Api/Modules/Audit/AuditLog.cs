using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MGT.Portal.Api.Modules.Apps;

namespace MGT.Portal.Api.Modules.Audit;

public sealed class AuditLog
{
    public long Id { get; set; }
    public Guid BatchId { get; set; }
    public DateTime OccurredAt { get; set; }
    public int? ActorUserId { get; set; }
    public string Actor { get; set; } = "system";
    public int? ApplicationId { get; set; }
    public Application? Application { get; set; }
    public string? ApplicationName { get; set; }
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    public string EntityKeyJson { get; set; } = "{}";
    public string EventName { get; set; } = "";
    public string Action { get; set; } = "";
    public string Result { get; set; } = "Succeeded";
    public string? PreviousStage { get; set; }
    public string? NewStage { get; set; }
    public string ChangedFieldsJson { get; set; } = "[]";
    public string? BeforeJson { get; set; }
    public string? AfterJson { get; set; }
    public string? RequestMethod { get; set; }
    public string? RequestPath { get; set; }
    public string? CorrelationId { get; set; }
    public int? StatusCode { get; set; }
}

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.Property(a => a.Actor).HasMaxLength(320);
        b.Property(a => a.ApplicationName).HasMaxLength(500);
        b.Property(a => a.EntityType).HasMaxLength(100);
        b.Property(a => a.EntityId).HasMaxLength(320);
        b.Property(a => a.EventName).HasMaxLength(100);
        b.Property(a => a.Action).HasMaxLength(32);
        b.Property(a => a.Result).HasMaxLength(32);
        b.Property(a => a.PreviousStage).HasMaxLength(64);
        b.Property(a => a.NewStage).HasMaxLength(64);
        b.Property(a => a.RequestMethod).HasMaxLength(16);
        b.Property(a => a.RequestPath).HasMaxLength(2048);
        b.Property(a => a.CorrelationId).HasMaxLength(128);
        b.HasIndex(a => a.OccurredAt);
        b.HasIndex(a => new { a.ApplicationId, a.OccurredAt });
        b.HasIndex(a => new { a.ActorUserId, a.OccurredAt });
        b.HasIndex(a => new { a.EventName, a.OccurredAt });
        // Retain app history; applications with audit records cannot be physically removed.
        b.HasOne(a => a.Application).WithMany().HasForeignKey(a => a.ApplicationId).OnDelete(DeleteBehavior.Restrict);
    }
}
