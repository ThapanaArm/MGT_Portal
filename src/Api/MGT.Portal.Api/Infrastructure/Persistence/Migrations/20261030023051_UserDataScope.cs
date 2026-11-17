using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserDataScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SaleGroupId",
                table: "Users",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SaleGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Key = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SaleGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserPlatformIds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Platform = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPlatformIds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPlatformIds_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Prefix = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_SaleGroupId",
                table: "Users",
                column: "SaleGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleGroups_Key",
                table: "SaleGroups",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPlatformIds_Platform_ExternalId",
                table: "UserPlatformIds",
                columns: new[] { "Platform", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPlatformIds_UserId",
                table: "UserPlatformIds",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTokens_TokenHash",
                table: "UserTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTokens_UserId",
                table: "UserTokens",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_SaleGroups_SaleGroupId",
                table: "Users",
                column: "SaleGroupId",
                principalTable: "SaleGroups",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_SaleGroups_SaleGroupId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "SaleGroups");

            migrationBuilder.DropTable(
                name: "UserPlatformIds");

            migrationBuilder.DropTable(
                name: "UserTokens");

            migrationBuilder.DropIndex(
                name: "IX_Users_SaleGroupId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "SaleGroupId",
                table: "Users");
        }
    }
}
