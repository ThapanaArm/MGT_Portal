-- =====================================================================
-- User_Data — ข้อมูลพนักงาน โครงสร้างองค์กร และรหัสพนักงานของแต่ละระบบ
-- ข้อมูลทดสอบเท่านั้น (ไม่ใช่ข้อมูลจริง)
--
-- รันใน Supabase › SQL Editor ได้ทั้งไฟล์ และรันซ้ำได้ (ไม่สร้างแถวซ้ำ)
-- ใช้ได้ทั้งแบบ 1 โปรเจกต์ 3 schema และแบบแยกโปรเจกต์ — ไฟล์นี้ไม่อ้างถึง schema อื่น
-- =====================================================================

create schema if not exists user_data;

-- ---------- ตาราง ----------

create table if not exists user_data.departments (
    code        text primary key,               -- ตรงกับ Teams.Key ของ Portal (sales, finance, it, ...)
    name        text not null
);

create table if not exists user_data.sale_groups (
    key         text primary key,               -- ตรงกับ SaleGroups.Key ของ Portal และคอลัมน์ Sale_Group ของ SaleOrder
    name        text not null
);

create table if not exists user_data.employees (
    employee_code   text primary key,
    full_name       text not null,
    email           text not null unique,       -- ใช้จับคู่กับ Users.Email ของ Portal
    position        text,
    level           text not null default 'employee'
                    check (level in ('employee', 'sales_manager', 'manager', 'management')),
    department_code text references user_data.departments(code),
    sale_group_key  text references user_data.sale_groups(key),
    active          boolean not null default true,
    updated_at      timestamptz not null default now(),
    constraint sales_manager_needs_group check (level <> 'sales_manager' or sale_group_key is not null)
);

-- รหัสพนักงานของแต่ละระบบไม่เท่ากัน — รหัสหนึ่งในระบบหนึ่งเป็นของคนเดียว
create table if not exists user_data.employee_platform_ids (
    employee_code   text not null references user_data.employees(employee_code) on delete cascade,
    platform        text not null check (platform = lower(platform)),   -- sap, zoho, ...
    external_id     text not null,
    primary key (employee_code, platform),
    unique (platform, external_id)
);

create index if not exists employees_sale_group_idx on user_data.employees (sale_group_key);
create index if not exists employees_department_idx on user_data.employees (department_code);

-- ---------- สิทธิ์ ----------
-- เปิด RLS โดยไม่มี policy = anon / authenticated อ่านไม่ได้เลย
-- อ่านได้เฉพาะ service_role (secret key ที่ Portal ใช้) ซึ่งข้าม RLS

alter table user_data.departments           enable row level security;
alter table user_data.sale_groups           enable row level security;
alter table user_data.employees             enable row level security;
alter table user_data.employee_platform_ids enable row level security;

revoke all on all tables in schema user_data from anon, authenticated;
grant usage on schema user_data to service_role;
grant select, insert, update, delete on all tables in schema user_data to service_role;

-- ---------- ข้อมูลทดสอบ ----------

insert into user_data.departments (code, name) values
    ('management', 'Management'),
    ('sales',      'Sales'),
    ('purchase',   'Purchasing'),
    ('finance',    'Finance'),
    ('hr',         'Human Resources'),
    ('it',         'IT')
on conflict (code) do update set name = excluded.name;

insert into user_data.sale_groups (key, name) values
    ('SG-IND',  'Industrial Chemicals'),
    ('SG-FOOD', 'Food & Pharma'),
    ('SG-EXP',  'Export')
on conflict (key) do update set name = excluded.name;

-- อีเมลที่ลงท้าย @megachem.co.th ตรงกับผู้ใช้ทดสอบที่ DbSeeder ของ Portal สร้างไว้ (ล็อกอินได้)
-- คนที่อีเมล @test.local ไม่มีบัญชี Portal — มีไว้ให้เป็นเจ้าของ SaleOrder ของคนอื่น
insert into user_data.employees (employee_code, full_name, email, position, level, department_code, sale_group_key) values
    ('T0001', 'Test Director',        'director@megachem.co.th',      'CEO',           'management',    'management', null),
    ('T0002', 'Test CFO',             'cfo@test.local',               'CFO',           'management',    'finance',    null),
    ('T0101', 'Test Sales Manager',   'sales.manager@megachem.co.th', 'Sales Manager', 'sales_manager', 'sales',      'SG-IND'),
    ('T0102', 'Test Sales Staff',     'sales.staff@megachem.co.th',   'Sales',         'employee',      'sales',      'SG-IND'),
    ('T0103', 'Test Sales Staff 2',   'sales.staff2@megachem.co.th',  'Sales',         'employee',      'sales',      'SG-FOOD'),
    ('T0104', 'Test Sales Rep A',     'sales.rep.a@test.local',       'Sales',         'employee',      'sales',      'SG-IND'),
    ('T0105', 'Test Sales Rep B',     'sales.rep.b@test.local',       'Sales',         'employee',      'sales',      'SG-FOOD'),
    ('T0106', 'Test Sales Rep C',     'sales.rep.c@test.local',       'Sales',         'employee',      'sales',      'SG-EXP'),
    ('T0201', 'Test Purchase Staff',  'purchase.staff@megachem.co.th','Purchasing',    'employee',      'purchase',   null),
    ('T0301', 'Test Finance Staff',   'finance.staff@megachem.co.th', 'Accountant',    'employee',      'finance',    null)
on conflict (employee_code) do update set
    full_name = excluded.full_name, email = excluded.email, position = excluded.position, level = excluded.level,
    department_code = excluded.department_code, sale_group_key = excluded.sale_group_key, updated_at = now();

-- SAP = รหัส Sales Employee (Partner Function), Zoho = User ID ของ Owner
insert into user_data.employee_platform_ids (employee_code, platform, external_id) values
    ('T0101', 'sap', '90000101'), ('T0101', 'zoho', '4876000000901010'),
    ('T0102', 'sap', '90000102'), ('T0102', 'zoho', '4876000000901020'),
    ('T0103', 'sap', '90000103'), ('T0103', 'zoho', '4876000000901030'),
    ('T0104', 'sap', '90000104'), ('T0104', 'zoho', '4876000000901040'),
    ('T0105', 'sap', '90000105'), ('T0105', 'zoho', '4876000000901050'),
    ('T0106', 'sap', '90000106'), ('T0106', 'zoho', '4876000000901060')
on conflict (employee_code, platform) do update set external_id = excluded.external_id;
