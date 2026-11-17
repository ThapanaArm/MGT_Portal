using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>ลิงก์เอกสารประกอบของ IT code review (เช่น SharePoint) — Portal เก็บแค่ลิงก์ ไม่เก็บไฟล์</summary>
    public partial class AddCodeReviewLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Links",
                table: "AppCodeReviews",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Links",
                table: "AppCodeReviews");
        }
    }
}
