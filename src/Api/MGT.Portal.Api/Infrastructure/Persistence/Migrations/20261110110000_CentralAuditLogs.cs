using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CentralAuditLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    Actor = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: false),
                    ApplicationId = table.Column<int>(type: "int", nullable: true),
                    ApplicationName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    EntityType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(320)", maxLength: 320, nullable: true),
                    EntityKeyJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EventName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    Result = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    PreviousStage = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    NewStage = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ChangedFieldsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BeforeJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AfterJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RequestMethod = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    RequestPath = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    CorrelationId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: true),
                    StatusCode = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "Applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActorUserId_OccurredAt",
                table: "AuditLogs",
                columns: new[] { "ActorUserId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ApplicationId_OccurredAt",
                table: "AuditLogs",
                columns: new[] { "ApplicationId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EventName_OccurredAt",
                table: "AuditLogs",
                columns: new[] { "EventName", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_OccurredAt",
                table: "AuditLogs",
                column: "OccurredAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");
        }
    }
}
