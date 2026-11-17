using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PerApiPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RequestUserId",
                table: "GatewayWriteRecords",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UserApiPermissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ResourceKey = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ReadScope = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    WriteScope = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserApiPermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserApiPermissions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserApiPermissions_UserId_ResourceKey",
                table: "UserApiPermissions",
                columns: new[] { "UserId", "ResourceKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserApiPermissions");

            migrationBuilder.DropColumn(
                name: "RequestUserId",
                table: "GatewayWriteRecords");
        }
    }
}
