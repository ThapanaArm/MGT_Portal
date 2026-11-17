using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// กรรมการต่อคำขอเปลี่ยนจาก 3 เป็น 5 คน — เก็บจำนวนไว้ที่แต่ละคำขอ (Applications.CommitteeSize)
    /// คำขอที่มีอยู่แล้วตอนรัน migration ได้ 3 (ใช้กรรมการชุดเดิมต่อ) คำขอใหม่ได้ 5 จากค่าเริ่มต้นในโค้ด (AppTier.CommitteeSize)
    /// </summary>
    public partial class CommitteeSizePerApplication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CommitteeSize",
                table: "Applications",
                type: "int",
                nullable: false,
                defaultValue: 3);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CommitteeSize",
                table: "Applications");
        }
    }
}
