# ฐานข้อมูลบน Supabase

ข้อมูลบน Supabase ตอนนี้เป็น **ข้อมูลทดสอบ** ทั้งหมด (ไม่ใช่ข้อมูลจริง)

## แยกเป็น 3 ฐาน

| ฐาน | schema | เก็บอะไร | ใครอ่าน |
|---|---|---|---|
| MGT_HUB | `mgt_hub` | ข้อมูลของ Portal เอง (Applications, Catalog, Reviews, Tokens) | Portal ผ่าน connection string — ตอนนี้ยังอยู่ SQL Server |
| User_Data | `user_data` | พนักงาน แผนก Sale group รหัสพนักงานของแต่ละระบบ | ยังไม่มีใครอ่าน (ข้อมูลหลักไว้ให้ระบบอื่นใช้ต่อ) |
| SaleOrder_Data | `saleorder_data` | รายการขาย `SaleOrder` | Gateway `GET /api/v1/sales/orders` ผ่าน REST (PostgREST) |

### ทำไมเป็น schema ในโปรเจกต์เดียว

- Supabase 1 โปรเจกต์ = Postgres 1 ฐาน
- Free plan มีโปรเจกต์ที่ใช้งานได้พร้อมกัน 2 โปรเจกต์ — พอดีกับ **sandbox 1 + production 1** แต่ละโปรเจกต์มี 3 schema
- ถ้าแยกเป็นโปรเจกต์จริง (3 ฐาน × 2 env = 6 โปรเจกต์) ต้องใช้ Pro plan: $25/เดือน + ค่า compute โปรเจกต์ละประมาณ $10/เดือน
- แต่ละ schema แยกสิทธิ์กันได้ และ join ข้ามกันได้เมื่อจำเป็น (เช่น ชื่อพนักงานกับรายการขาย)
- Free plan หยุดโปรเจกต์ที่ไม่มีการใช้งาน 1 สัปดาห์ (pause) — กด Restore ใน Dashboard

ไฟล์ SQL ทุกไฟล์ไม่อ้างถึง schema อื่น ถ้าภายหลังอยากแยกเป็นโปรเจกต์จริง ให้รันแต่ละไฟล์ในโปรเจกต์ของมันแล้วเปลี่ยน `Supabase:Url` / `Supabase:Key`

## ไฟล์

| ไฟล์ | ทำอะไร |
|---|---|
| `db/supabase/1_user_data.sql` | สร้าง schema `user_data` + ตาราง + ข้อมูลทดสอบ 10 คน |
| `db/supabase/2_saleorder_data.sql` | สร้าง schema `saleorder_data` + ตาราง `SaleOrder` + ข้อมูลทดสอบ 2,400 แถว (ปี 2024–2026) |
| `db/supabase/3_mgt_hub.sql` | สร้าง schema `mgt_hub` ว่าง ๆ ไว้รอ Portal |
| `db/sqlserver/test-data-scope.sql` | ใส่ Sale group / ระดับ / รหัส SAP ให้ผู้ใช้ทดสอบของ Portal (SQL Server) ให้ตรงกับข้อมูลบน Supabase |

ทุกไฟล์รันซ้ำได้ — ข้อมูลทดสอบสร้างจาก `hashtext` จึงได้ชุดเดิมทุกครั้ง

## ขั้นตอน (ทำทั้งโปรเจกต์ sandbox และ production)

1. Supabase › **SQL Editor** › วางและรัน `1_user_data.sql`, `2_saleorder_data.sql`, `3_mgt_hub.sql` ตามลำดับ
2. **Project Settings › Data API › Exposed schemas** เพิ่ม `saleorder_data`
   - ไม่ต้องเพิ่ม `user_data` (ยังไม่มีใครอ่านผ่าน REST)
   - ห้ามเพิ่ม `mgt_hub`
3. `Supabase:Key` ของ Portal ต้องเป็น **secret key** (`sb_secret_...` หรือ service_role แบบเดิม)
   - ทุกตารางเปิด RLS โดยไม่มี policy → publishable / anon key อ่านไม่ได้
4. `appsettings.json` ตั้งไว้แล้ว: `Gateway:SaleOrder:Schema = saleorder_data`
5. SQL Server ฐาน MGT_Portal › รัน `db/sqlserver/test-data-scope.sql`
6. ทดสอบ: ล็อกอินเป็นผู้ใช้ทดสอบ › **My tokens** สร้าง token › เรียก `/api/v1/sales/orders` พร้อม `X-User-Token`
7. ใช้ได้แล้วค่อยลบตารางทดสอบเดิม `public."SaleOrder"`

### ผลที่ควรได้

| ผู้ใช้ | ระดับ | เห็น |
|---|---|---|
| `director@megachem.co.th` | management | 2,400 แถว (ทั้งหมด) |
| `sales.manager@megachem.co.th` | sales_manager (SG-IND) | 1,182 แถว |
| `sales.staff@megachem.co.th` | employee (SAP 90000102) | 404 แถว |
| `sales.staff2@megachem.co.th` | employee (SAP 90000103) | 409 แถว |
| `finance.staff@megachem.co.th` | employee (ไม่มีรหัส SAP) | 0 แถว |

## โครงสร้าง

### user_data

| ตาราง | คีย์ | หมายเหตุ |
|---|---|---|
| `departments` | `code` | ตรงกับ `Teams.Key` ของ Portal (`sales`, `finance`, `it`, ...) |
| `sale_groups` | `key` | ตรงกับ `SaleGroups.Key` ของ Portal และคอลัมน์ `Sale_Group` |
| `employees` | `employee_code` | `email` ใช้จับคู่กับ `Users.Email`; `level` = employee / sales_manager / manager / management |
| `employee_platform_ids` | `employee_code + platform` | รหัสของแต่ละระบบ (`sap`, `zoho`) — รหัสหนึ่งในระบบหนึ่งเป็นของคนเดียว |

### saleorder_data.SaleOrder

คอลัมน์เดิมทั้งหมด (`Transaction_ID`, `Invoice_Date`, `Year`, `Customer_Name`, `Product_Code`, `Chemical_Name`, `Chemical_Category`, `Quantity_kg`, `Sales_Amount_THB`, `Gross_Profit_THB`) และเพิ่ม

| คอลัมน์ | ความหมาย |
|---|---|
| `Sales_Employee_Id` | รหัส Sales Employee ของ SAP (เจ้าของรายการ) |
| `Sales_Employee_Name` | ชื่อพนักงานขาย |
| `Sale_Group` | Sale group |
| `Source` | ที่มาของแถว — ข้อมูลทดสอบเป็น `test` |
| `Synced_At` | เวลาที่เขียนแถว |

Gateway ส่ง 3 คอลัมน์แรกกลับไปด้วยใน `salesEmployeeId`, `salesEmployeeName`, `saleGroup`

## ตอนนี้ Portal ยังใช้ข้อมูลองค์กรของตัวเอง

Gateway หาว่าใครเห็นอะไรจากตาราง `Users` / `SaleGroups` / `UserPlatformIds` ใน SQL Server ของ Portal — ยังไม่อ่าน `user_data`
ข้อมูลทดสอบทั้งสองฝั่งจึงต้องใส่ให้ตรงกัน (`test-data-scope.sql`)

## ขั้นต่อไป: ย้าย MGT_HUB

ย้าย Portal จาก SQL Server มา Postgres (`mgt_hub`) — ต้องเปลี่ยน EF Core provider เป็น Npgsql:

1. `dotnet add src/Api/MGT.Portal.Api package Npgsql.EntityFrameworkCore.PostgreSQL`
2. เลือก provider จาก config, ตั้ง default schema `mgt_hub`
3. สร้าง migration ชุดใหม่สำหรับ Postgres (migration เดิมเป็นของ SQL Server ใช้ไม่ได้)
4. connection string ใช้ Supavisor pooler (Dashboard › Connect) — ไม่ผ่าน REST
5. ข้อมูลทดสอบมาจาก `DbSeeder` เหมือนเดิม

เมื่อ Portal อยู่ Postgres โปรเจกต์เดียวกันแล้ว Portal อ่าน `user_data` ได้ตรง ไม่ต้องใส่ข้อมูลองค์กรซ้ำสองที่
