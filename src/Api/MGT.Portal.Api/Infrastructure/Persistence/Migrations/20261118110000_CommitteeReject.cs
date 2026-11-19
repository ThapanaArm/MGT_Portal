using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// กรรมการกด Reject ได้ (AppVotes.Rejected) — ต่างจาก Request changes ที่คืนคำขอให้แก้
    /// เมื่อเสียง Reject ทำให้ไม่มีทางได้เสียงอนุมัติครบ คำขอถูกปิดเป็นสถานะ "rejected" (ไม่ต้องเปลี่ยน schema ของ Applications)
    /// เสียงเดิมทั้งหมดได้ค่า false = ไม่ใช่การ Reject
    /// และย้ายคำขอเก่าที่มีกรรมการ 3 คนมาใช้กรรมการ 5 คน (ย้อนกลับไม่ได้ใน Down)
    /// </summary>
    public partial class CommitteeReject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Rejected",
                table: "AppVotes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // คำขอเก่าที่เคยใช้กรรมการ 3 คน ต้องมีกรรมการครบ 5 คนเหมือนคำขอใหม่ (IT เลือกเพิ่มอีก 2 คน)
            migrationBuilder.Sql("UPDATE dbo.Applications SET CommitteeSize = 5 WHERE CommitteeSize < 5;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Rejected",
                table: "AppVotes");
        }
    }
}
