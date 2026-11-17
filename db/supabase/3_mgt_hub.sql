-- =====================================================================
-- MGT_HUB — ฐานข้อมูลของ MGT Portal เอง (Applications, Catalog, Reviews, Tokens, ...)
--
-- ตอนนี้ Portal ยังใช้ SQL Server (ฐาน MGT_Portal) ผ่าน EF Core
-- ไฟล์นี้เตรียม schema ไว้ก่อน ตารางจะถูกสร้างโดย EF migrations เมื่อสลับ Portal มาใช้ Postgres
-- และข้อมูลทดสอบมาจาก DbSeeder ของ Portal เหมือนตอนใช้ SQL Server
--
-- ตารางของ Portal มี token / hash / ข้อมูลภายใน — ห้ามเปิดผ่าน Data API (อย่าใส่ mgt_hub ใน Exposed schemas)
-- Portal ต่อตรงผ่าน connection string (Supavisor pooler) ไม่ผ่าน REST
-- =====================================================================

create schema if not exists mgt_hub;

revoke all on schema mgt_hub from anon, authenticated;
revoke all on all tables in schema mgt_hub from anon, authenticated;
alter default privileges in schema mgt_hub revoke all on tables from anon, authenticated;
