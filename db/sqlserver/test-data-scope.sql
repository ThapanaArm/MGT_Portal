-- =====================================================================
-- ข้อมูลทดสอบสิทธิ์ข้อมูลรายคน ฝั่ง Portal (SQL Server ฐาน MGT_Portal)
-- ให้ตรงกับ db/supabase/1_user_data.sql และ 2_saleorder_data.sql — ไม่ใช่ข้อมูลจริง
-- รันซ้ำได้
--
-- ผลที่ควรได้จาก GET /api/v1/sales/orders (ส่ง X-User-Token ของแต่ละคน):
--   director@megachem.co.th       management     → 2,400 แถว (ทั้งหมด)
--   sales.manager@megachem.co.th  sales_manager  → 1,182 แถว (Sale group SG-IND)
--   sales.staff@megachem.co.th    employee       →   404 แถว (SAP 90000102)
--   sales.staff2@megachem.co.th   employee       →   409 แถว (SAP 90000103)
--   finance.staff@megachem.co.th  employee       →     0 แถว (ไม่มีรหัส SAP)
-- =====================================================================

SET XACT_ABORT ON;
BEGIN TRAN;

-- Sale group (Key = คอลัมน์ Sale_Group ใน Supabase)
MERGE SaleGroups AS t
USING (VALUES (N'SG-IND', N'Industrial Chemicals'), (N'SG-FOOD', N'Food & Pharma'), (N'SG-EXP', N'Export')) AS s([Key], Name)
ON t.[Key] = s.[Key]
WHEN MATCHED THEN UPDATE SET Name = s.Name
WHEN NOT MATCHED THEN INSERT ([Key], Name) VALUES (s.[Key], s.Name);

-- ระดับและ Sale group
UPDATE Users SET Level = 'management', SaleGroupId = NULL WHERE Email = 'director@megachem.co.th';

UPDATE Users SET Level = 'sales_manager', SaleGroupId = (SELECT Id FROM SaleGroups WHERE [Key] = N'SG-IND')
WHERE Email = 'sales.manager@megachem.co.th';

UPDATE Users SET Level = 'employee', SaleGroupId = (SELECT Id FROM SaleGroups WHERE [Key] = N'SG-IND')
WHERE Email = 'sales.staff@megachem.co.th';

UPDATE Users SET Level = 'employee', SaleGroupId = (SELECT Id FROM SaleGroups WHERE [Key] = N'SG-FOOD')
WHERE Email = 'sales.staff2@megachem.co.th';

-- รหัสพนักงานแต่ละระบบ (ลบชุดทดสอบเดิมของคนกลุ่มนี้ก่อน แล้วใส่ใหม่)
DELETE p FROM UserPlatformIds p JOIN Users u ON u.Id = p.UserId
WHERE u.Email IN ('sales.manager@megachem.co.th', 'sales.staff@megachem.co.th', 'sales.staff2@megachem.co.th')
   OR p.ExternalId IN ('90000101', '90000102', '90000103', '4876000000901010', '4876000000901020', '4876000000901030');

INSERT INTO UserPlatformIds (UserId, Platform, ExternalId)
SELECT u.Id, m.Platform, m.ExternalId
FROM (VALUES
        ('sales.manager@megachem.co.th', 'sap',  '90000101'),
        ('sales.manager@megachem.co.th', 'zoho', '4876000000901010'),
        ('sales.staff@megachem.co.th',   'sap',  '90000102'),
        ('sales.staff@megachem.co.th',   'zoho', '4876000000901020'),
        ('sales.staff2@megachem.co.th',  'sap',  '90000103'),
        ('sales.staff2@megachem.co.th',  'zoho', '4876000000901030')
     ) AS m(Email, Platform, ExternalId)
JOIN Users u ON u.Email = m.Email;

COMMIT;

-- ตรวจผล
SELECT u.Email, u.Level, g.[Key] AS SaleGroup, p.Platform, p.ExternalId
FROM Users u
LEFT JOIN SaleGroups g ON g.Id = u.SaleGroupId
LEFT JOIN UserPlatformIds p ON p.UserId = u.Id
WHERE u.Email IN ('director@megachem.co.th', 'sales.manager@megachem.co.th', 'sales.staff@megachem.co.th',
                  'sales.staff2@megachem.co.th', 'finance.staff@megachem.co.th')
ORDER BY u.Email, p.Platform;
