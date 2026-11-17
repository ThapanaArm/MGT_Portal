-- =====================================================================
-- SaleOrder_Data — รายการขาย (Gateway: GET /api/v1/sales/orders)
-- ข้อมูลทดสอบเท่านั้น (ไม่ใช่ข้อมูลจริง)
--
-- รันใน Supabase › SQL Editor ได้ทั้งไฟล์ และรันซ้ำได้ (ลบแถวทดสอบเดิมแล้วสร้างใหม่ ผลเหมือนเดิมทุกครั้ง)
-- ใช้ได้ทั้งแบบ 1 โปรเจกต์ 3 schema และแบบแยกโปรเจกต์ — ไฟล์นี้ไม่อ้างถึง schema อื่น
--
-- ชื่อตารางและคอลัมน์คงแบบเดิม (SaleOrder, Transaction_ID, ...) เพื่อให้ Gateway อ่านได้ทันที
-- เพิ่มคอลัมน์เจ้าของ: Sales_Employee_Id (รหัส Sales Employee ของ SAP) และ Sale_Group
-- =====================================================================

create schema if not exists saleorder_data;

create table if not exists saleorder_data."SaleOrder" (
    "Transaction_ID"      text primary key,
    "Invoice_Date"        date not null,
    "Year"                int  not null,
    "Customer_Name"       text not null,
    "Product_Code"        text not null,
    "Chemical_Name"       text not null,
    "Chemical_Category"   text not null,
    "Quantity_kg"         bigint not null,
    "Sales_Amount_THB"    numeric(14, 2) not null,
    "Gross_Profit_THB"    numeric(14, 2) not null,
    "Sales_Employee_Id"   text,              -- รหัสในระบบ Gateway:SaleOrder:OwnerPlatform (sap)
    "Sales_Employee_Name" text,
    "Sale_Group"          text,              -- = SaleGroups.Key ของ Portal
    "Source"              text not null default 'test',
    "Synced_At"           timestamptz not null default now()
);

create index if not exists saleorder_owner_idx    on saleorder_data."SaleOrder" ("Sales_Employee_Id");
create index if not exists saleorder_group_idx    on saleorder_data."SaleOrder" ("Sale_Group");
create index if not exists saleorder_year_idx     on saleorder_data."SaleOrder" ("Year");
create index if not exists saleorder_product_idx  on saleorder_data."SaleOrder" ("Product_Code");

-- ---------- สิทธิ์ ----------
-- RLS เปิด ไม่มี policy = อ่านด้วย anon / publishable key ไม่ได้ ต้องผ่าน Gateway (service_role / secret key)
alter table saleorder_data."SaleOrder" enable row level security;
revoke all on all tables in schema saleorder_data from anon, authenticated;
grant usage on schema saleorder_data to service_role;
grant select, insert, update, delete on all tables in schema saleorder_data to service_role;

-- ---------- ข้อมูลทดสอบ ----------
-- พนักงานขาย 6 คน (รหัสตรงกับ user_data.employee_platform_ids platform = 'sap')
-- ลูกค้า 3 รายต่อคน, สินค้า 12 รายการ, 2,400 แถว ปี 2024–2026
-- ใช้ hashtext แทน random() เพื่อให้รันกี่ครั้งก็ได้ข้อมูลชุดเดิม

delete from saleorder_data."SaleOrder" where "Source" = 'test';

with reps (n, emp_id, emp_name, grp) as (
    values
        (0, '90000101', 'Test Sales Manager', 'SG-IND'),
        (1, '90000102', 'Test Sales Staff',   'SG-IND'),
        (2, '90000103', 'Test Sales Staff 2', 'SG-FOOD'),
        (3, '90000104', 'Test Sales Rep A',   'SG-IND'),
        (4, '90000105', 'Test Sales Rep B',   'SG-FOOD'),
        (5, '90000106', 'Test Sales Rep C',   'SG-EXP')
),
products (n, code, name, category, price, margin) as (
    values
        (0,  'CH-1001', 'Sodium Hydroxide 50%',   'Alkali',          18.0, 0.12),
        (1,  'CH-1002', 'Hydrochloric Acid 35%',  'Acid',             9.0, 0.15),
        (2,  'CH-1003', 'Sulfuric Acid 98%',      'Acid',             7.0, 0.14),
        (3,  'CH-2001', 'Citric Acid Anhydrous',  'Food Additive',   45.0, 0.20),
        (4,  'CH-2002', 'Sodium Benzoate',        'Food Additive',   62.0, 0.22),
        (5,  'CH-2003', 'Glycerin USP',           'Pharma',          38.0, 0.18),
        (6,  'CH-3001', 'Isopropyl Alcohol',      'Solvent',         42.0, 0.16),
        (7,  'CH-3002', 'Ethyl Acetate',          'Solvent',         48.0, 0.17),
        (8,  'CH-3003', 'Toluene',                'Solvent',         35.0, 0.13),
        (9,  'CH-4001', 'Titanium Dioxide',       'Pigment',        110.0, 0.21),
        (10, 'CH-4002', 'Calcium Carbonate',      'Filler',           6.0, 0.25),
        (11, 'CH-5001', 'Polyacrylamide',         'Water Treatment', 85.0, 0.24)
),
draws as (
    select i,
           abs(hashtext('rep'  || i)) % 6    as rep_n,
           abs(hashtext('cust' || i)) % 3    as cust_n,
           abs(hashtext('prod' || i)) % 12   as prod_n,
           abs(hashtext('day'  || i)) % 1035 as day_n,      -- 2024-01-01 .. 2026-10-31
           100 + (abs(hashtext('qty' || i)) % 50) * 100 as qty,
           0.9 + (abs(hashtext('px' || i)) % 21) / 100.0  as price_factor
    from generate_series(1, 2400) as i
)
insert into saleorder_data."SaleOrder" (
    "Transaction_ID", "Invoice_Date", "Year", "Customer_Name", "Product_Code", "Chemical_Name", "Chemical_Category",
    "Quantity_kg", "Sales_Amount_THB", "Gross_Profit_THB", "Sales_Employee_Id", "Sales_Employee_Name", "Sale_Group", "Source")
select
    'TST-' || lpad(d.i::text, 6, '0'),
    date '2024-01-01' + d.day_n,
    extract(year from date '2024-01-01' + d.day_n)::int,
    'Test Customer ' || lpad((r.n * 3 + d.cust_n + 1)::text, 2, '0') || ' Co., Ltd.',
    p.code, p.name, p.category,
    d.qty,
    round(d.qty * p.price * d.price_factor, 2),
    round(d.qty * p.price * d.price_factor * p.margin, 2),
    r.emp_id, r.emp_name, r.grp, 'test'
from draws d
join reps r     on r.n = d.rep_n
join products p on p.n = d.prod_n;
