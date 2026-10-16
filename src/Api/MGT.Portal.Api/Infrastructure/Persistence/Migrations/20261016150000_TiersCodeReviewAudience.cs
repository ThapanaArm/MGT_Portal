using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Migrations
{
    /// <summary>
    /// เปลี่ยนระดับ App เป็น Tier 1/2/3, เพิ่มผล IT code review และช่อง "ใครใช้ App ได้"
    /// </summary>
    public partial class TiersCodeReviewAudience : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // App ที่มีอยู่แล้วถือว่าใช้ได้ทั้งบริษัท (เดิมทุก App ที่ Active แสดงใน Ecosystem ให้ทุกคนเห็น)
            migrationBuilder.AddColumn<string>(
                name: "Audience",
                table: "Applications",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "company");

            migrationBuilder.CreateTable(
                name: "AppCodeReviews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApplicationId = table.Column<int>(type: "int", nullable: false),
                    ReviewCycle = table.Column<int>(type: "int", nullable: false),
                    Approved = table.Column<bool>(type: "bit", nullable: false),
                    ReviewerEmail = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppCodeReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppCodeReviews_Applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "Applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppCodeReviews_ApplicationId_ReviewCycle",
                table: "AppCodeReviews",
                columns: new[] { "ApplicationId", "ReviewCycle" },
                unique: true);

            // ระดับเดิม → Tier ใหม่: Registered → Tier 1, Verify → Tier 2, Official → Tier 3
            migrationBuilder.Sql("""
                UPDATE Applications SET [Type] = CASE [Type]
                    WHEN 'registered' THEN 'tier1' WHEN 'verify' THEN 'tier2' WHEN 'official' THEN 'tier3' ELSE [Type] END;
                UPDATE Applications SET ReviewTarget = CASE ReviewTarget
                    WHEN 'registered' THEN 'tier1' WHEN 'verify' THEN 'tier2' WHEN 'official' THEN 'tier3' ELSE ReviewTarget END
                    WHERE ReviewTarget IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE Applications SET [Type] = CASE [Type]
                    WHEN 'tier1' THEN 'registered' WHEN 'tier2' THEN 'verify' WHEN 'tier3' THEN 'official' ELSE [Type] END;
                UPDATE Applications SET ReviewTarget = CASE ReviewTarget
                    WHEN 'tier1' THEN 'registered' WHEN 'tier2' THEN 'verify' WHEN 'tier3' THEN 'official' ELSE ReviewTarget END
                    WHERE ReviewTarget IS NOT NULL;
                """);

            migrationBuilder.DropTable(
                name: "AppCodeReviews");

            migrationBuilder.DropColumn(
                name: "Audience",
                table: "Applications");
        }
    }
}
