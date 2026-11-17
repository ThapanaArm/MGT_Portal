using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MGT.Portal.Api.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// ข้อมูลที่ยังเก็บชื่อระดับแบบเก่า (registered / register / verify / official) → tier1 / tier2 / tier3
    /// รวมถึง TargetTier ใน DevelopmentJson ที่ migration TiersCodeReviewAudience ไม่ได้แปลง
    /// ไม่เปลี่ยนโครงสร้างตาราง
    /// </summary>
    public partial class NormalizeLegacyTierValues : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE Applications SET [Type] = CASE LOWER([Type])
    WHEN 'registered' THEN 'tier1' WHEN 'register' THEN 'tier1' WHEN 'verify' THEN 'tier2' WHEN 'official' THEN 'tier3' ELSE [Type] END
WHERE LOWER([Type]) IN ('registered', 'register', 'verify', 'official');");

            migrationBuilder.Sql(@"
UPDATE Applications SET ReviewTarget = CASE LOWER(ReviewTarget)
    WHEN 'registered' THEN 'tier1' WHEN 'register' THEN 'tier1' WHEN 'verify' THEN 'tier2' WHEN 'official' THEN 'tier3' ELSE ReviewTarget END
WHERE LOWER(ReviewTarget) IN ('registered', 'register', 'verify', 'official');");

            migrationBuilder.Sql(@"
UPDATE Applications SET DevelopmentJson =
    REPLACE(REPLACE(REPLACE(REPLACE(DevelopmentJson,
        '""TargetTier"":""registered""', '""TargetTier"":""tier1""'),
        '""TargetTier"":""register""', '""TargetTier"":""tier1""'),
        '""TargetTier"":""verify""', '""TargetTier"":""tier2""'),
        '""TargetTier"":""official""', '""TargetTier"":""tier3""')
WHERE DevelopmentJson IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // แปลงข้อมูลอย่างเดียว ไม่มีอะไรต้องย้อนกลับ
        }
    }
}
