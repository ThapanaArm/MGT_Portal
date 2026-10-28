using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PerCategoryCredentials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AppCredentials_ApplicationId",
                table: "AppCredentials");

            migrationBuilder.AlterColumn<string>(
                name: "Env",
                table: "AppCredentials",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "AppCredentials",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            // token เดิม (1 ตัวต่อแอปต่อ env) → ผูกกับหมวด API แรกที่แอปขอ จึงยังใช้กับหมวดนั้นได้เหมือนเดิม
            // หมวดที่เหลือจะได้ token ใหม่ตอนเริ่มแอป (ApplicationWorkflow.SyncCredentialsAsync ใน Program.cs)
            migrationBuilder.Sql(@"
UPDATE c SET Category = LOWER(LTRIM(RTRIM(
    CASE WHEN CHARINDEX(',', a.ProductsCsv) > 0 THEN LEFT(a.ProductsCsv, CHARINDEX(',', a.ProductsCsv) - 1) ELSE a.ProductsCsv END)))
FROM AppCredentials c
JOIN Applications a ON a.Id = c.ApplicationId;");

            migrationBuilder.CreateIndex(
                name: "IX_AppCredentials_ApplicationId_Env_Category",
                table: "AppCredentials",
                columns: new[] { "ApplicationId", "Env", "Category" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AppCredentials_ApplicationId_Env_Category",
                table: "AppCredentials");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "AppCredentials");

            migrationBuilder.AlterColumn<string>(
                name: "Env",
                table: "AppCredentials",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateIndex(
                name: "IX_AppCredentials_ApplicationId",
                table: "AppCredentials",
                column: "ApplicationId");
        }
    }
}
