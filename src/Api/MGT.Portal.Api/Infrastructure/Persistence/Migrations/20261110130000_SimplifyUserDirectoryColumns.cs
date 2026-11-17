using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyUserDirectoryColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Preserve the removed sync metadata without changing account IDs, passwords or existing profile values.
            migrationBuilder.Sql("EXEC(N'" + @"
INSERT INTO [AuditLogs]
    ([BatchId], [OccurredAt], [Actor], [EntityType], [EntityId], [EntityKeyJson], [EventName], [Action], [Result], [ChangedFieldsJson], [BeforeJson], [CorrelationId])
SELECT NEWID(), SYSUTCDATETIME(), N'system', N'User', CONVERT(nvarchar(320), u.[Id]),
    (SELECT u.[Id], u.[Email] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    N'user.schema_simplified', N'SchemaUpdate', N'Succeeded',
    N'[""DirectoryLevelOverride"",""DirectoryRoleManaged"",""DirectorySourceRole"",""DisplayNameOptionId"",""LastSyncedAt"",""TokenVersion""]',
    (SELECT u.[DirectoryLevelOverride], u.[DirectoryRoleManaged], u.[DirectorySourceRole], u.[DisplayNameOptionId], u.[LastSyncedAt], u.[TokenVersion]
     FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER),
    N'migration:20261110130000'
FROM [Users] AS u;

UPDATE u SET u.[DisplayName] = o.[Name]
FROM [Users] u INNER JOIN [DisplayNameOptions] o ON o.[Id] = u.[DisplayNameOptionId]
WHERE NULLIF(LTRIM(RTRIM(u.[DisplayName])), N'') IS NULL;

UPDATE [Users] SET [Level] = [DirectoryLevelOverride]
WHERE NULLIF(LTRIM(RTRIM([Level])), N'') IS NULL
  AND [DirectoryLevelOverride] IN (N'employee', N'sales_manager', N'manager', N'management');
".Replace("'", "''") + "');");
            migrationBuilder.DropForeignKey(
                name: "FK_Users_DisplayNameOptions_DisplayNameOptionId",
                table: "Users");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
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

            migrationBuilder.CreateIndex(
                name: "IX_Users_DisplayNameOptionId",
                table: "Users",
                column: "DisplayNameOptionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_DisplayNameOptions_DisplayNameOptionId",
                table: "Users",
                column: "DisplayNameOptionId",
                principalTable: "DisplayNameOptions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
