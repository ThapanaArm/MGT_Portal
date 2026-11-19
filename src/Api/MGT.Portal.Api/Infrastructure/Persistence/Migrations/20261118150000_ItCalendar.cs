using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// ปฏิทิน IT (CalendarEvents): ช่วงว่างที่ IT เปิดให้จอง, วัน deploy, นัดคุยกับ User และช่วง Freeze
    /// User ขอจอง (requested) แล้ว IT ยืนยัน/ปฏิเสธ — กติกาอยู่ใน Modules/Scheduling/Services/CalendarService.cs
    /// </summary>
    public partial class ItCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    StartAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ApplicationId = table.Column<int>(type: "int", nullable: true),
                    RequestedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DecidedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DecisionNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "Applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_ApplicationId",
                table: "CalendarEvents",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_RequestedByUserId",
                table: "CalendarEvents",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_StartAt_EndAt",
                table: "CalendarEvents",
                columns: new[] { "StartAt", "EndAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CalendarEvents");
        }
    }
}
