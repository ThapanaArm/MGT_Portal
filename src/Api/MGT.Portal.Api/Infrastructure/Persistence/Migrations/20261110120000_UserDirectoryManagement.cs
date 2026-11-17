using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserDirectoryManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DirectoryLevelOverride",
                table: "Users",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DirectoryRoleManaged",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DirectorySourceRole",
                table: "Users",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisplayNameOptionId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastSyncedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TokenVersion",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "DisplayNameOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    NormalizedName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DisplayNameOptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserSyncLevelMappings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SourceRole = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NormalizedSourceRole = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Level = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSyncLevelMappings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "DisplayNameOptions",
                columns: new[] { "Id", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { 1, "Sales Administrative", "SALES ADMINISTRATIVE" },
                    { 2, "Human Resources Staff", "HUMAN RESOURCES STAFF" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_DisplayNameOptionId",
                table: "Users",
                column: "DisplayNameOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_DisplayNameOptions_NormalizedName",
                table: "DisplayNameOptions",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSyncLevelMappings_NormalizedSourceRole",
                table: "UserSyncLevelMappings",
                column: "NormalizedSourceRole",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_DisplayNameOptions_DisplayNameOptionId",
                table: "Users",
                column: "DisplayNameOptionId",
                principalTable: "DisplayNameOptions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_DisplayNameOptions_DisplayNameOptionId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "DisplayNameOptions");

            migrationBuilder.DropTable(
                name: "UserSyncLevelMappings");

            migrationBuilder.DropIndex(
                name: "IX_Users_DisplayNameOptionId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DirectoryLevelOverride",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DirectoryRoleManaged",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DirectorySourceRole",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DisplayNameOptionId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastSyncedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TokenVersion",
                table: "Users");
        }
    }
}
