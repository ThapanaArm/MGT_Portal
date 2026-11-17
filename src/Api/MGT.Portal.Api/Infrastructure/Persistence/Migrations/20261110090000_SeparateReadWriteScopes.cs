using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations;

public partial class SeparateReadWriteScopes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "ReadDataScope", table: "Users", type: "nvarchar(max)", nullable: true);
        migrationBuilder.AddColumn<string>(name: "WriteDataScope", table: "Users", type: "nvarchar(max)", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "ReadDataScope", table: "Users");
        migrationBuilder.DropColumn(name: "WriteDataScope", table: "Users");
    }
}
