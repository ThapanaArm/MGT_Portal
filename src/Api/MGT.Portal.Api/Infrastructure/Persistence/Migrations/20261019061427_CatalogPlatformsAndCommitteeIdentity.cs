using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogPlatformsAndCommitteeIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "CommitteeMembers",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ActorEmail",
                table: "AppVotes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DecidedAt",
                table: "AppVotes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "AppVotes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourcePlatform",
                table: "ApiEndpoints",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_CommitteeMembers_UserId",
                table: "CommitteeMembers",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_CommitteeMembers_Users_UserId",
                table: "CommitteeMembers",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CommitteeMembers_Users_UserId",
                table: "CommitteeMembers");

            migrationBuilder.DropIndex(
                name: "IX_CommitteeMembers_UserId",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "ActorEmail",
                table: "AppVotes");

            migrationBuilder.DropColumn(
                name: "DecidedAt",
                table: "AppVotes");

            migrationBuilder.DropColumn(
                name: "Note",
                table: "AppVotes");

            migrationBuilder.DropColumn(
                name: "SourcePlatform",
                table: "ApiEndpoints");
        }
    }
}
