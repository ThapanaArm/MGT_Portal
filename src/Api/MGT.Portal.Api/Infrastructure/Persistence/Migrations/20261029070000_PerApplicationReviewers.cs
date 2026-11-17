using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// กรรมการรายแอป: เลิกใช้ที่นั่งกรรมการ 3 ที่นั่งที่ใช้ร่วมกันทุกแอป (CommitteeMembers)
    /// เปลี่ยนเป็นตาราง AppReviewers (กรรมการ 3 คนต่อแอป) และผูกความเห็นกับบัญชีผู้ใช้โดยตรง (AppVotes.ReviewerUserId)
    /// ข้อมูลเดิม: ความเห็นที่ผูกกับที่นั่งที่มีบัญชีแล้วย้ายไปผูกกับบัญชีนั้น, คำขอที่รอรีวิวอยู่ได้กรรมการชุดเดิมเป็นกรรมการของแอป
    /// ความเห็นจากที่นั่งที่ไม่เคยผูกบัญชี (ข้อมูลตัวอย่าง ไม่มีผู้ลงความเห็นจริง และไม่เคยถูกนับ) ถูกลบ
    /// </summary>
    public partial class PerApplicationReviewers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppReviewers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApplicationId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppReviewers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppReviewers_Applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "Applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AppReviewers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppReviewers_ApplicationId_UserId",
                table: "AppReviewers",
                columns: new[] { "ApplicationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppReviewers_UserId",
                table: "AppReviewers",
                column: "UserId");

            migrationBuilder.AddColumn<int>(
                name: "ReviewerUserId",
                table: "AppVotes",
                type: "int",
                nullable: true);

            // ความเห็นเดิมผูกกับที่นั่ง → ผูกกับบัญชีที่นั่งนั้น
            migrationBuilder.Sql(@"
UPDATE v SET v.ReviewerUserId = m.UserId
FROM AppVotes v
JOIN CommitteeMembers m ON m.Id = v.CommitteeMemberId
WHERE m.UserId IS NOT NULL;");

            // คำขอที่รอรีวิวอยู่ตอนนี้ใช้กรรมการชุดเดิมต่อไป (ยกเว้นผู้ขอเอง) — IT เปลี่ยนภายหลังได้
            migrationBuilder.Sql(@"
INSERT INTO AppReviewers (ApplicationId, UserId, AssignedAt, AssignedBy)
SELECT a.Id, m.UserId, SYSUTCDATETIME(), N'migration'
FROM Applications a
CROSS JOIN CommitteeMembers m
WHERE a.Status = N'pending' AND m.UserId IS NOT NULL AND m.UserId <> a.OwnerUserId;");

            migrationBuilder.Sql("DELETE FROM AppVotes WHERE ReviewerUserId IS NULL;");

            migrationBuilder.DropForeignKey(
                name: "FK_AppVotes_CommitteeMembers_CommitteeMemberId",
                table: "AppVotes");

            migrationBuilder.DropIndex(
                name: "IX_AppVotes_ApplicationId_CommitteeMemberId_ReviewCycle",
                table: "AppVotes");

            migrationBuilder.DropIndex(
                name: "IX_AppVotes_CommitteeMemberId",
                table: "AppVotes");

            migrationBuilder.DropColumn(
                name: "CommitteeMemberId",
                table: "AppVotes");

            migrationBuilder.AlterColumn<int>(
                name: "ReviewerUserId",
                table: "AppVotes",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppVotes_ApplicationId_ReviewerUserId_ReviewCycle",
                table: "AppVotes",
                columns: new[] { "ApplicationId", "ReviewerUserId", "ReviewCycle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppVotes_ReviewerUserId",
                table: "AppVotes",
                column: "ReviewerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_AppVotes_Users_ReviewerUserId",
                table: "AppVotes",
                column: "ReviewerUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropTable(
                name: "CommitteeMembers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CommitteeMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RoleTitle = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommitteeMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CommitteeMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CommitteeMembers_UserId",
                table: "CommitteeMembers",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            // ย้อนกลับแบบดีที่สุด: ทุกคนที่เคยเป็นกรรมการหรือเคยลงความเห็นได้ที่นั่งของตัวเอง
            migrationBuilder.Sql(@"
INSERT INTO CommitteeMembers (Name, RoleTitle, UserId)
SELECT u.DisplayName, N'', u.Id
FROM Users u
WHERE u.Id IN (SELECT UserId FROM AppReviewers UNION SELECT ReviewerUserId FROM AppVotes);");

            migrationBuilder.AddColumn<int>(
                name: "CommitteeMemberId",
                table: "AppVotes",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE v SET v.CommitteeMemberId = m.Id
FROM AppVotes v
JOIN CommitteeMembers m ON m.UserId = v.ReviewerUserId;");

            migrationBuilder.DropForeignKey(
                name: "FK_AppVotes_Users_ReviewerUserId",
                table: "AppVotes");

            migrationBuilder.DropIndex(
                name: "IX_AppVotes_ApplicationId_ReviewerUserId_ReviewCycle",
                table: "AppVotes");

            migrationBuilder.DropIndex(
                name: "IX_AppVotes_ReviewerUserId",
                table: "AppVotes");

            migrationBuilder.DropColumn(
                name: "ReviewerUserId",
                table: "AppVotes");

            migrationBuilder.AlterColumn<int>(
                name: "CommitteeMemberId",
                table: "AppVotes",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppVotes_ApplicationId_CommitteeMemberId_ReviewCycle",
                table: "AppVotes",
                columns: new[] { "ApplicationId", "CommitteeMemberId", "ReviewCycle" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AppVotes_CommitteeMemberId",
                table: "AppVotes",
                column: "CommitteeMemberId");

            migrationBuilder.AddForeignKey(
                name: "FK_AppVotes_CommitteeMembers_CommitteeMemberId",
                table: "AppVotes",
                column: "CommitteeMemberId",
                principalTable: "CommitteeMembers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropTable(
                name: "AppReviewers");
        }
    }
}
