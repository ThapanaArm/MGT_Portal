/* =====================================================================
   MGT Portal — ล้างประวัติ APP ทั้งหมด (ตั้งแต่สร้างคำขอ จนถึง Approve)
   Database : MGT_Portal (SQL Server)
   ลบ      : Applications + ตารางลูกทั้งหมด (Screenshots, Credentials, Log,
             Reviewers/คณะกรรมการ, Votes, IT Code Review)
             + AuditLogs ที่ผูกกับ APP + GatewayWriteRecords ของ APP
   ไม่ลบ    : Users, Roles, AccessGrants, UserApiPermissions, ApiTokens,
             API Catalog และ AuditLogs เรื่องอื่น
   ข้อควรรู้ : ลบถาวร — backup ก่อนรัน
   ===================================================================== */
USE MGT_Portal;
GO

/* ---------- STEP 1: ดูจำนวนที่จะถูกลบ (รันส่วนนี้ก่อน) ---------- */
SELECT 'Applications'        AS TableName, COUNT(*) AS Rows FROM dbo.Applications
UNION ALL SELECT 'AppScreenshots',      COUNT(*) FROM dbo.AppScreenshots
UNION ALL SELECT 'AppCredentials',      COUNT(*) FROM dbo.AppCredentials
UNION ALL SELECT 'AppLogEntries',       COUNT(*) FROM dbo.AppLogEntries
UNION ALL SELECT 'AppReviewers',        COUNT(*) FROM dbo.AppReviewers
UNION ALL SELECT 'AppVotes',            COUNT(*) FROM dbo.AppVotes
UNION ALL SELECT 'AppCodeReviews',      COUNT(*) FROM dbo.AppCodeReviews
UNION ALL SELECT 'GatewayWriteRecords', COUNT(*) FROM dbo.GatewayWriteRecords
UNION ALL SELECT 'AuditLogs (APP)',     COUNT(*) FROM dbo.AuditLogs
          WHERE ApplicationId IS NOT NULL
             OR EntityType IN ('Application','AppScreenshot','AppCredential','AppLogEntry','AppReviewer','AppVote','AppCodeReview');
GO

/* ---------- STEP 2: ลบ (ทำใน transaction — error ตรงไหนจะ rollback ทั้งหมด) ---------- */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

    -- AuditLogs มี FK -> Applications แบบ Restrict จึงต้องลบก่อน
    DELETE FROM dbo.AuditLogs
    WHERE ApplicationId IS NOT NULL
       OR EntityType IN ('Application','AppScreenshot','AppCredential','AppLogEntry','AppReviewer','AppVote','AppCodeReview');

    DELETE FROM dbo.GatewayWriteRecords;   -- ทุกแถวผูกกับ ApplicationId

    DELETE FROM dbo.AppVotes;
    DELETE FROM dbo.AppReviewers;
    DELETE FROM dbo.AppCodeReviews;
    DELETE FROM dbo.AppLogEntries;
    DELETE FROM dbo.AppScreenshots;
    DELETE FROM dbo.AppCredentials;
    DELETE FROM dbo.Applications;

    -- ให้ ID ของ APP ใหม่เริ่มที่ 1 อีกครั้ง
    DBCC CHECKIDENT ('dbo.Applications',   RESEED, 0);
    DBCC CHECKIDENT ('dbo.AppVotes',       RESEED, 0);
    DBCC CHECKIDENT ('dbo.AppReviewers',   RESEED, 0);
    DBCC CHECKIDENT ('dbo.AppCodeReviews', RESEED, 0);
    DBCC CHECKIDENT ('dbo.AppLogEntries',  RESEED, 0);
    DBCC CHECKIDENT ('dbo.AppScreenshots', RESEED, 0);
    DBCC CHECKIDENT ('dbo.AppCredentials', RESEED, 0);
    DBCC CHECKIDENT ('dbo.GatewayWriteRecords', RESEED, 0);

COMMIT TRANSACTION;
GO

/* ---------- STEP 3: ตรวจผล (ทุกแถวควรเป็น 0) ---------- */
SELECT 'Applications' AS TableName, COUNT(*) AS Rows FROM dbo.Applications
UNION ALL SELECT 'AppVotes',       COUNT(*) FROM dbo.AppVotes
UNION ALL SELECT 'AppReviewers',   COUNT(*) FROM dbo.AppReviewers
UNION ALL SELECT 'AppCodeReviews', COUNT(*) FROM dbo.AppCodeReviews
UNION ALL SELECT 'AuditLogs (APP)', COUNT(*) FROM dbo.AuditLogs WHERE ApplicationId IS NOT NULL;
GO
