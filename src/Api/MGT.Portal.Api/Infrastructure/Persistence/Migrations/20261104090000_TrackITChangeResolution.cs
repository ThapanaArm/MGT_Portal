using System;
using Microsoft.EntityFrameworkCore.Migrations;
#nullable disable
namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations;
public partial class TrackITChangeResolution : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(name: "ResolvedInCycle", table: "AppCodeReviews", type: "int", nullable: true);
        migrationBuilder.AddColumn<string>(name: "ResolvedBy", table: "AppCodeReviews", type: "nvarchar(max)", nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "ResolvedAt", table: "AppCodeReviews", type: "datetime2", nullable: true);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ResolvedInCycle", table: "AppCodeReviews");
        migrationBuilder.DropColumn(name: "ResolvedBy", table: "AppCodeReviews");
        migrationBuilder.DropColumn(name: "ResolvedAt", table: "AppCodeReviews");
    }
}
