using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// คณะกรรมการรีวิวชุดเดียวของ Portal (CommitteeMembers, 5 คน) แทนการให้ IT เลือกกรรมการทีละคำขอ
    /// เริ่มต้นว่าง — IT ตั้งรายชื่อที่หน้า Administration > Committee แล้วคำขอที่รอรีวิวอยู่จะเปลี่ยนตามทันที
    /// AppReviewers ยังเก็บกรรมการของแต่ละคำขอ (คัดลอกจากชุดนี้ตอนส่งรีวิว) เพื่อเก็บประวัติของคำขอเดิม
    /// </summary>
    public partial class CommitteeMembers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommitteeMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AddedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommitteeMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommitteeMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CommitteeMembers_UserId",
                table: "CommitteeMembers",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CommitteeMembers");
        }
    }
}
