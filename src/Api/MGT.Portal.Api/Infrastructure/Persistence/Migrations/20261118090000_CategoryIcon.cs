using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// เพิ่มไอคอนของหมวด API (ApiCategories.Icon) ให้แอดมินเพิ่ม/แก้หมวดและเลือกไอคอนจากหน้าเว็บได้
    /// หมวดเดิม 5 หมวดได้ไอคอนเดียวกับที่เคยกำหนดไว้ในโค้ดหน้าเว็บ
    /// </summary>
    public partial class CategoryIcon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "ApiCategories",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql(@"
UPDATE dbo.ApiCategories SET Icon = CASE [Key]
    WHEN 'sales' THEN 'fa:chart-line'
    WHEN 'purchase' THEN 'fa:credit-card'
    WHEN 'inventory' THEN 'fa:box'
    WHEN 'finance' THEN 'fa:receipt'
    WHEN 'hr' THEN 'fa:users'
    ELSE 'fa:box' END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Icon",
                table: "ApiCategories");
        }
    }
}
