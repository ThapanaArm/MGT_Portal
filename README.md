# MGT Portal (MGT Hub)

Portal กลางให้พนักงาน Megachem ขออนุมัติสร้าง App, ดู API catalog และขอสิทธิ์ใช้ API

| ส่วน | Stack |
|---|---|
| Backend | ASP.NET Core (.NET 10) — modular monolith, EF Core + SQL Server |
| Frontend | React 19 + TypeScript, build ด้วย Vite, routing ด้วย React Router, style ด้วย Tailwind CSS 4 |

## โครงสร้าง

```
Mgt_Portal/
├── MGT.Portal.slnx                      ← เปิดไฟล์นี้ใน Visual Studio / Rider
├── src/
│   ├── Api/MGT.Portal.Api/              ← backend (โปรเจกต์เดียว แบ่งเป็น module)
│   │   ├── Program.cs                   ← ลงทะเบียน service, auth, เสิร์ฟหน้าเว็บ
│   │   ├── Modules/
│   │   │   ├── Identity/                ← ผู้ใช้, role, ทีม, login, ขอบเขตข้อมูล
│   │   │   ├── Catalog/                 ← หมวด API และ endpoint
│   │   │   ├── Apps/                    ← คำขอสร้าง App, credential, การรีวิวของกรรมการ
│   │   │   └── Access/                  ← สิทธิ์เพิ่มเติม (AccessGrant), token ส่วนตัว
│   │   │       ├── Domain/              ← entity + ค่าคงที่
│   │   │       ├── Api/                 ← controller + DTO
│   │   │       ├── Services/            ← logic
│   │   │       └── Persistence/         ← การตั้งค่าตาราง EF Core ของ module นี้
│   │   ├── Infrastructure/Persistence/  ← PortalDbContext, migrations, ข้อมูลตัวอย่าง
│   │   └── Shared/                      ← ของใช้ร่วมที่ไม่ผูกกับ module ใด
│   └── Web/                             ← frontend (React + Vite) + MGT.Portal.Web.esproj ให้ VS เห็นโปรเจกต์
│       └── src/
│           ├── app/                     ← routes.tsx, layout, ตัวกันหน้า admin
│           ├── features/                ← หน้าเว็บแยกตามเรื่อง (apps, catalog, admin, ...)
│           ├── shared/                  ← component และ lib ที่ใช้ทุกหน้า (api, auth, i18n, ui)
│           └── styles/
├── tests/
│   ├── MGT.Portal.ArchitectureTests/    ← test ที่บังคับกติกาของ module
│   └── MGT.Portal.UnitTests/            ← test กติกาการอนุมัติตาม Tier
└── docs/
    ├── database.md                      ← โครงสร้างฐานข้อมูล + ER diagram
    └── prototype/index.html             ← ต้นแบบ HTML เดิม (ไม่ได้ใช้ตอนรัน)
```

### กติกาของ module (backend)

- โค้ดของเรื่องไหนอยู่ใน module นั้นทั้งหมด: entity, logic, controller, DTO, การตั้งค่าตาราง
- ทิศทางที่อ้างถึงกันได้: `Apps → Identity`, `Access → Identity, Catalog` ส่วน `Identity` และ `Catalog` ไม่อ้างถึงใคร
- ถ้า module ที่อยู่ล่างต้องการข้อมูลจาก module บน ให้ประกาศ interface ไว้ที่ module ล่าง แล้วให้ module บน implement
  (ตัวอย่าง: `IUserScopeProvider` อยู่ใน Identity และ Access เป็นผู้ implement)
- `dotnet test` จะ fail ถ้ามีโค้ดผิดกติกา

## สิ่งที่ต้องติดตั้ง

- .NET 10 SDK
- Node.js 22 ขึ้นไป
- SQL Server ที่เข้าถึงได้

## รันครั้งแรก

```powershell
# 1) ตั้ง secret ของ backend (ครั้งเดียว)
cd src/Api/MGT.Portal.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=<server>;Database=MGT_Portal;User Id=<user>;Password=<pwd>;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:Key" "<สตริงสุ่มยาวอย่างน้อย 32 ตัวอักษร>"
cd ../../..

# 2) ติดตั้ง package ของหน้าเว็บ (ครั้งเดียว)
npm --prefix src/Web install
```

> user-secrets ผูกกับ `UserSecretsId` ใน csproj ซึ่งไม่ได้เปลี่ยน ถ้าเคยตั้งไว้แล้วกับโปรเจกต์เดิม ไม่ต้องตั้งใหม่

## รันตอนพัฒนา (เปิด 2 terminal)

```powershell
# terminal 1 — backend ที่ http://localhost:5038
dotnet run --project src/Api/MGT.Portal.Api

# terminal 2 — หน้าเว็บที่ http://localhost:5174
npm --prefix src/Web run dev
```

**ใน Visual Studio:** คลิกขวาที่ Solution → Configure Startup Projects → เลือก Multiple startup projects แล้วตั้ง `MGT.Portal.Api` และ `MGT.Portal.Web` เป็น Start กด F5 ครั้งเดียวรันทั้งคู่

เปิด http://localhost:5174 หน้าเว็บเรียก `/api/...` แล้ว Vite จะส่งต่อให้ backend เอง

ตอนเริ่ม backend จะ migrate ฐานข้อมูลให้อัตโนมัติ และ**ใส่ข้อมูลตัวอย่างเฉพาะ environment Development**
บัญชีทดสอบ: `it-digital@megachem.co.th` / `Admin@123` (บัญชีอื่นดูที่ `Infrastructure/Persistence/DbSeeder.cs`)

## คำสั่งที่ใช้บ่อย

| ทำอะไร | คำสั่ง |
|---|---|
| build backend + test | `dotnet build MGT.Portal.slnx` แล้ว `dotnet test MGT.Portal.slnx` |
| ตรวจ type + lint หน้าเว็บ | `npm --prefix src/Web run typecheck` และ `npm --prefix src/Web run lint` |
| build หน้าเว็บสำหรับ production | `npm --prefix src/Web run build` (ไฟล์จะไปอยู่ที่ `src/Api/MGT.Portal.Api/wwwroot`) |
| สร้าง migration | `dotnet ef migrations add <ชื่อ> --project src/Api/MGT.Portal.Api --output-dir Infrastructure/Persistence/Migrations` |
| ลองเรียก API | เปิด `src/Api/MGT.Portal.Api/MGT.Portal.Api.http` ใน VS / VS Code |

## เพิ่มหน้าเว็บใหม่

1. สร้างไฟล์หน้าใน `src/Web/src/features/<เรื่อง>/XxxPage.tsx`
2. เพิ่ม `<Route>` ใน `src/Web/src/app/routes.tsx` (หน้าสำหรับ admin ให้ใส่ใต้ `path="admin"`)
3. ห้ามตั้ง URL หน้าเว็บขึ้นต้นด้วย `/api` เพราะเป็นของ backend
