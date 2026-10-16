using MGT.Portal.Api.Models;
using MGT.Portal.Api.Services;

namespace MGT.Portal.Api.Data;

public static class DbSeeder
{
    public static void Seed(PortalDbContext db)
    {
        if (db.Roles.Any()) return; // already seeded

        var roles = new[]
        {
            new Role { Key = "admin", Name = "ผู้ดูแลระบบ", ScopesCsv = "*" },
            new Role { Key = "sales", Name = "พนักงานขาย", ScopesCsv = "sales.read,sales.write,inventory.read" },
            new Role { Key = "purchase", Name = "พนักงานจัดซื้อ", ScopesCsv = "purchase.read,purchase.write,inventory.read" },
            new Role { Key = "finance", Name = "พนักงานการเงิน", ScopesCsv = "finance.read,finance.write,sales.read,purchase.read" },
            new Role { Key = "hr", Name = "ฝ่ายบุคคล", ScopesCsv = "hr.read,hr.write" },
        };
        db.Roles.AddRange(roles);
        db.SaveChanges();

        string Hash(string pw) => BCrypt.Net.BCrypt.HashPassword(pw);
        var users = new[]
        {
            new User { Email = "it-digital@megachem.co.th", DisplayName = "ผู้ดูแลระบบ", PasswordHash = Hash("Admin@123"), RoleId = roles[0].Id },
            new User { Email = "sales.staff@megachem.co.th", DisplayName = "พนักงานขาย", PasswordHash = Hash("Sales@123"), RoleId = roles[1].Id },
            new User { Email = "purchase.staff@megachem.co.th", DisplayName = "พนักงานจัดซื้อ", PasswordHash = Hash("Purchase@123"), RoleId = roles[2].Id },
            new User { Email = "finance.staff@megachem.co.th", DisplayName = "พนักงานการเงิน", PasswordHash = Hash("Finance@123"), RoleId = roles[3].Id },
            new User { Email = "hr.staff@megachem.co.th", DisplayName = "ฝ่ายบุคคล", PasswordHash = Hash("Hr@123"), RoleId = roles[4].Id },
        };
        db.Users.AddRange(users);
        db.SaveChanges();

        var committee = new[]
        {
            new CommitteeMember { Name = "สมหญิง วัฒนา", RoleTitle = "IT Security" },
            new CommitteeMember { Name = "ประเสริฐ ชัยมงคล", RoleTitle = "Business Owner" },
            new CommitteeMember { Name = "อรทัย ธนากร", RoleTitle = "Compliance" },
        };
        db.CommitteeMembers.AddRange(committee);
        db.SaveChanges();

        var categories = new[]
        {
            new ApiCategory { Key = "sales", Name = "Sales", BasePath = "/api/v1/sales", Description = "จัดการคำสั่งขาย ใบเสนอราคา และข้อมูลลูกค้า สำหรับทีมขายและหน้าร้าน", RateLimit = "120 คำขอ / นาที" },
            new ApiCategory { Key = "purchase", Name = "Purchase", BasePath = "/api/v1/purchase", Description = "จัดการใบสั่งซื้อ ผู้ขาย (Vendor) และการอนุมัติจัดซื้อ", RateLimit = "120 คำขอ / นาที" },
            new ApiCategory { Key = "inventory", Name = "Inventory", BasePath = "/api/v1/inventory", Description = "ตรวจสอบสต๊อกสินค้า คลังสินค้า และการเคลื่อนไหวของสินค้าคงคลัง", RateLimit = "180 คำขอ / นาที" },
            new ApiCategory { Key = "finance", Name = "Finance", BasePath = "/api/v1/finance", Description = "ใบแจ้งหนี้ การชำระเงิน และรายงานทางการเงิน", RateLimit = "60 คำขอ / นาที" },
            new ApiCategory { Key = "hr", Name = "HR", BasePath = "/api/v1/hr", Description = "ข้อมูลพนักงาน การลา และเงินเดือน (ข้อมูลอ่อนไหว จำกัดสิทธิ์)", RateLimit = "30 คำขอ / นาที" },
        };
        db.ApiCategories.AddRange(categories);
        db.SaveChanges();

        var catByKey = categories.ToDictionary(c => c.Key);

        db.ApiEndpoints.AddRange(
            new ApiEndpoint { CategoryId = catByKey["sales"].Id, Method = "GET", Path = "/orders", Scope = "sales.read",
                Summary = "ดึงรายการคำสั่งขายทั้งหมด พร้อมตัวกรองตามช่วงวันที่และสถานะ",
                Icon = "📋", Scenario = "อยากรู้ว่าวันนี้มีคำสั่งขายอะไรเข้ามาบ้าง → ใช้อันนี้",
                Description = "ใช้สำหรับแสดงรายการคำสั่งขายในหน้า Dashboard หรือระบบ POS รองรับการแบ่งหน้าและกรองตามสถานะ",
                ParamsJson = "[[\"status\",\"query\",\"string\",\"no\",\"กรองตามสถานะ เช่น open, paid, cancelled\"],[\"from\",\"query\",\"date\",\"no\",\"วันที่เริ่มต้น (YYYY-MM-DD)\"],[\"page\",\"query\",\"integer\",\"no\",\"เลขหน้า เริ่มที่ 1\"]]",
                RespExample = "{\n  \"data\": [\n    { \"id\": \"SO-20260811-004\", \"customer\": \"บจก. ไทยเคมีภัณฑ์\", \"total\": 184500, \"currency\": \"THB\", \"status\": \"open\" }\n  ],\n  \"page\": 1,\n  \"total\": 132\n}",
                RespFieldsJson = "[[\"data[].id\",\"string\",\"รหัสคำสั่งขาย\"],[\"data[].customer\",\"string\",\"ชื่อลูกค้า\"],[\"data[].total\",\"number\",\"ยอดรวม (บาท)\"],[\"data[].status\",\"string\",\"สถานะคำสั่งขาย\"],[\"page\",\"integer\",\"หน้าปัจจุบัน\"],[\"total\",\"integer\",\"จำนวนรายการทั้งหมด\"]]" },
            new ApiEndpoint { CategoryId = catByKey["sales"].Id, Method = "POST", Path = "/orders", Scope = "sales.write",
                Summary = "สร้างคำสั่งขายใหม่ในระบบ",
                Icon = "➕", Scenario = "ลูกค้าสั่งซื้อสินค้าทางโทรศัพท์ อยากบันทึกเข้าระบบทันที → ใช้อันนี้",
                Description = "สร้างคำสั่งขายใหม่และตัดสต๊อกสินค้าจากคลังที่ระบุโดยอัตโนมัติทันทีที่บันทึกสำเร็จ",
                ParamsJson = "[[\"customer_id\",\"body\",\"string\",\"yes\",\"รหัสลูกค้า\"],[\"items\",\"body\",\"array\",\"yes\",\"รายการสินค้าและจำนวน\"],[\"warehouse\",\"body\",\"string\",\"no\",\"คลังที่ต้องการตัดสต๊อก\"]]",
                ReqBody = "{\n  \"customer_id\": \"CUST-1042\",\n  \"items\": [\n    { \"sku\": \"CHM-2201\", \"qty\": 4 }\n  ],\n  \"warehouse\": \"WH-BKK-01\"\n}",
                RespExample = "{\n  \"id\": \"SO-20260813-091\",\n  \"status\": \"open\",\n  \"created_at\": \"2026-08-13T09:41:00+07:00\"\n}",
                RespFieldsJson = "[[\"id\",\"string\",\"รหัสคำสั่งขายที่สร้าง\"],[\"status\",\"string\",\"สถานะเริ่มต้นของคำสั่งขาย\"],[\"created_at\",\"string (ISO 8601)\",\"วันเวลาที่สร้างรายการ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["sales"].Id, Method = "GET", Path = "/customers/{id}", Scope = "sales.read",
                Summary = "ดึงข้อมูลลูกค้ารายตัว รวมประวัติการสั่งซื้อโดยสรุป",
                Icon = "🔍", Scenario = "อยากรู้วงเงินเครดิตและยอดค้างชำระของลูกค้ารายนี้ก่อนรับออเดอร์ → ใช้อันนี้",
                Description = "ดึงข้อมูลลูกค้ารายตัวพร้อมวงเงินเครดิตและยอดค้างชำระปัจจุบัน ใช้ตรวจสอบก่อนอนุมัติคำสั่งขาย",
                ParamsJson = "[[\"id\",\"path\",\"string\",\"yes\",\"รหัสลูกค้า\"]]",
                RespExample = "{\n  \"id\": \"CUST-1042\",\n  \"name\": \"บจก. ไทยเคมีภัณฑ์\",\n  \"credit_limit\": 500000,\n  \"outstanding\": 92300\n}",
                RespFieldsJson = "[[\"id\",\"string\",\"รหัสลูกค้า\"],[\"name\",\"string\",\"ชื่อลูกค้า\"],[\"credit_limit\",\"number\",\"วงเงินเครดิต (บาท)\"],[\"outstanding\",\"number\",\"ยอดค้างชำระ (บาท)\"]]" },

            new ApiEndpoint { CategoryId = catByKey["purchase"].Id, Method = "GET", Path = "/orders", Scope = "purchase.read",
                Summary = "ดึงรายการใบสั่งซื้อ (PO) ทั้งหมด",
                Icon = "📋", Scenario = "อยากเช็คว่ามีใบสั่งซื้อค้างรออนุมัติอยู่กี่รายการ → ใช้อันนี้",
                Description = "ดึงรายการใบสั่งซื้อทั้งหมดของบริษัท ใช้สำหรับติดตามสถานะการจัดซื้อและงบประมาณคงเหลือ",
                ParamsJson = "[[\"vendor_id\",\"query\",\"string\",\"no\",\"กรองตามผู้ขาย\"],[\"status\",\"query\",\"string\",\"no\",\"pending, approved, received\"]]",
                RespExample = "{\n  \"data\": [\n    { \"id\": \"PO-2026-0231\", \"vendor\": \"Global Solvent Supply\", \"total\": 76500, \"status\": \"pending\" }\n  ]\n}",
                RespFieldsJson = "[[\"data[].id\",\"string\",\"รหัสใบสั่งซื้อ\"],[\"data[].vendor\",\"string\",\"ชื่อผู้ขาย\"],[\"data[].total\",\"number\",\"มูลค่ารวม (บาท)\"],[\"data[].status\",\"string\",\"สถานะใบสั่งซื้อ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["purchase"].Id, Method = "POST", Path = "/orders/{id}/approve", Scope = "purchase.write",
                Summary = "อนุมัติใบสั่งซื้อ (ต้องมีสิทธิ์ผู้อนุมัติ)",
                Icon = "✅", Scenario = "หัวหน้าอนุมัติงบแล้ว อยากกดอนุมัติใบสั่งซื้อให้ผู้ขายเริ่มส่งของ → ใช้อันนี้",
                Description = "อนุมัติใบสั่งซื้อที่รอดำเนินการ เปลี่ยนสถานะเป็น approved และแจ้งเตือนผู้ขายโดยอัตโนมัติ",
                ParamsJson = "[[\"id\",\"path\",\"string\",\"yes\",\"รหัสใบสั่งซื้อ\"],[\"note\",\"body\",\"string\",\"no\",\"บันทึกการอนุมัติ\"]]",
                ReqBody = "{\n  \"note\": \"อนุมัติตามงบประมาณไตรมาส 3\"\n}",
                RespExample = "{\n  \"id\": \"PO-2026-0231\",\n  \"status\": \"approved\",\n  \"approved_by\": \"purchase.staff@megachem.co.th\"\n}",
                RespFieldsJson = "[[\"id\",\"string\",\"รหัสใบสั่งซื้อ\"],[\"status\",\"string\",\"สถานะหลังอนุมัติ\"],[\"approved_by\",\"string\",\"อีเมลผู้อนุมัติ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["purchase"].Id, Method = "GET", Path = "/vendors", Scope = "purchase.read",
                Summary = "ดึงรายชื่อผู้ขาย/ซัพพลายเออร์ พร้อมคะแนนประเมิน",
                Icon = "🏭", Scenario = "กำลังหาผู้ขายรายใหม่ อยากดูคะแนนรีวิวผู้ขายที่เคยติดต่อมาก่อน → ใช้อันนี้",
                Description = "ดึงรายชื่อผู้ขาย/ซัพพลายเออร์ทั้งหมด พร้อมคะแนนประเมินคุณภาพล่าสุด",
                ParamsJson = "[[\"category\",\"query\",\"string\",\"no\",\"หมวดหมู่สินค้าที่จัดหา\"]]",
                RespExample = "{\n  \"data\": [\n    { \"id\": \"VEN-018\", \"name\": \"Global Solvent Supply\", \"rating\": 4.6 }\n  ]\n}",
                RespFieldsJson = "[[\"data[].id\",\"string\",\"รหัสผู้ขาย\"],[\"data[].name\",\"string\",\"ชื่อผู้ขาย\"],[\"data[].rating\",\"number\",\"คะแนนประเมิน (เต็ม 5)\"]]" },

            new ApiEndpoint { CategoryId = catByKey["inventory"].Id, Method = "GET", Path = "/stock", Scope = "inventory.read",
                Summary = "ตรวจสอบยอดคงเหลือสินค้าคงคลังตามคลัง/สาขา",
                Icon = "📦", Scenario = "อยากรู้ว่าสินค้าตัวนี้เหลือในคลังกี่ชิ้นก่อนรับออเดอร์ → ใช้อันนี้",
                Description = "ตรวจสอบยอดคงเหลือสินค้าคงคลังแบบเรียลไทม์ กรองตามรหัสสินค้าหรือคลังสินค้าได้",
                ParamsJson = "[[\"sku\",\"query\",\"string\",\"no\",\"รหัสสินค้า\"],[\"warehouse\",\"query\",\"string\",\"no\",\"รหัสคลังสินค้า\"]]",
                RespExample = "{\n  \"sku\": \"CHM-2201\",\n  \"name\": \"Ethanol 95% (200L Drum)\",\n  \"on_hand\": 342,\n  \"reserved\": 40,\n  \"unit\": \"drum\"\n}",
                RespFieldsJson = "[[\"sku\",\"string\",\"รหัสสินค้า\"],[\"name\",\"string\",\"ชื่อสินค้า\"],[\"on_hand\",\"integer\",\"จำนวนคงเหลือทั้งหมด\"],[\"reserved\",\"integer\",\"จำนวนที่ถูกจองแล้ว\"],[\"unit\",\"string\",\"หน่วยนับ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["inventory"].Id, Method = "POST", Path = "/transfers", Scope = "inventory.write",
                Summary = "สร้างรายการโอนย้ายสินค้าระหว่างคลัง",
                Icon = "🚚", Scenario = "คลังบางนาของหมด แต่คลังเชียงใหม่ยังมีเยอะ อยากโอนสินค้าไปช่วย → ใช้อันนี้",
                Description = "สร้างรายการโอนย้ายสินค้าระหว่างคลัง สถานะเริ่มต้นจะเป็น in_transit จนกว่าคลังปลายทางจะยืนยันรับสินค้า",
                ParamsJson = "[[\"sku\",\"body\",\"string\",\"yes\",\"รหัสสินค้า\"],[\"from_warehouse\",\"body\",\"string\",\"yes\",\"คลังต้นทาง\"],[\"to_warehouse\",\"body\",\"string\",\"yes\",\"คลังปลายทาง\"],[\"qty\",\"body\",\"number\",\"yes\",\"จำนวน\"]]",
                ReqBody = "{\n  \"sku\": \"CHM-2201\",\n  \"from_warehouse\": \"WH-BKK-01\",\n  \"to_warehouse\": \"WH-CNX-02\",\n  \"qty\": 20\n}",
                RespExample = "{\n  \"id\": \"TRF-00871\",\n  \"status\": \"in_transit\"\n}",
                RespFieldsJson = "[[\"id\",\"string\",\"รหัสรายการโอนย้าย\"],[\"status\",\"string\",\"สถานะการโอนย้าย\"]]" },
            new ApiEndpoint { CategoryId = catByKey["inventory"].Id, Method = "GET", Path = "/warehouses", Scope = "inventory.read",
                Summary = "ดึงรายชื่อคลังสินค้าทั้งหมดของบริษัท",
                Icon = "🏬", Scenario = "อยากรู้ว่าคลังไหนพื้นที่ใกล้เต็มแล้วบ้าง → ใช้อันนี้",
                Description = "ดึงรายชื่อคลังสินค้าทั้งหมดของบริษัท พร้อมเปอร์เซ็นต์การใช้พื้นที่ปัจจุบัน",
                RespExample = "{\n  \"data\": [\n    { \"id\": \"WH-BKK-01\", \"name\": \"คลังกลาง บางนา\", \"capacity_pct\": 78 }\n  ]\n}",
                RespFieldsJson = "[[\"data[].id\",\"string\",\"รหัสคลัง\"],[\"data[].name\",\"string\",\"ชื่อคลัง\"],[\"data[].capacity_pct\",\"number\",\"เปอร์เซ็นต์การใช้พื้นที่คลัง\"]]" },

            new ApiEndpoint { CategoryId = catByKey["finance"].Id, Method = "GET", Path = "/invoices", Scope = "finance.read",
                Summary = "ดึงรายการใบแจ้งหนี้ พร้อมสถานะการชำระเงิน",
                Icon = "🧾", Scenario = "อยากรู้ว่าลูกค้ารายไหนยังค้างจ่ายใบแจ้งหนี้อยู่ → ใช้อันนี้",
                Description = "ดึงรายการใบแจ้งหนี้พร้อมสถานะการชำระเงินและวันครบกำหนด ใช้ติดตามลูกหนี้ค้างชำระ",
                ParamsJson = "[[\"status\",\"query\",\"string\",\"no\",\"unpaid, paid, overdue\"],[\"customer_id\",\"query\",\"string\",\"no\",\"กรองตามลูกค้า\"]]",
                RespExample = "{\n  \"data\": [\n    { \"id\": \"INV-2026-3391\", \"amount\": 184500, \"status\": \"unpaid\", \"due_date\": \"2026-08-25\" }\n  ]\n}",
                RespFieldsJson = "[[\"data[].id\",\"string\",\"รหัสใบแจ้งหนี้\"],[\"data[].amount\",\"number\",\"จำนวนเงิน (บาท)\"],[\"data[].status\",\"string\",\"สถานะการชำระเงิน\"],[\"data[].due_date\",\"string (date)\",\"วันครบกำหนดชำระ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["finance"].Id, Method = "POST", Path = "/payments", Scope = "finance.write",
                Summary = "บันทึกรายการรับ/จ่ายชำระเงิน",
                Icon = "💳", Scenario = "ลูกค้าโอนเงินมาแล้ว อยากบันทึกว่าใบแจ้งหนี้นี้จ่ายครบแล้ว → ใช้อันนี้",
                Description = "บันทึกรายการรับหรือจ่ายชำระเงินเข้าระบบบัญชี และอัปเดตสถานะใบแจ้งหนี้ที่เกี่ยวข้อง",
                ParamsJson = "[[\"invoice_id\",\"body\",\"string\",\"yes\",\"รหัสใบแจ้งหนี้\"],[\"amount\",\"body\",\"number\",\"yes\",\"จำนวนเงิน\"],[\"method\",\"body\",\"string\",\"yes\",\"bank_transfer, cheque, cash\"]]",
                ReqBody = "{\n  \"invoice_id\": \"INV-2026-3391\",\n  \"amount\": 184500,\n  \"method\": \"bank_transfer\"\n}",
                RespExample = "{\n  \"id\": \"PMT-88213\",\n  \"status\": \"confirmed\"\n}",
                RespFieldsJson = "[[\"id\",\"string\",\"รหัสรายการชำระเงิน\"],[\"status\",\"string\",\"สถานะการยืนยันรายการ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["finance"].Id, Method = "GET", Path = "/reports/summary", Scope = "finance.read",
                Summary = "สรุปภาพรวมทางการเงินรายเดือน (รายรับ/รายจ่าย)",
                Icon = "📊", Scenario = "สิ้นเดือนแล้ว อยากรู้ภาพรวมรายรับ-รายจ่ายของเดือนนี้ → ใช้อันนี้",
                Description = "สรุปภาพรวมรายรับ-รายจ่ายรายเดือน สำหรับจัดทำรายงานผู้บริหารและวางแผนงบประมาณ",
                ParamsJson = "[[\"month\",\"query\",\"string\",\"yes\",\"YYYY-MM\"]]",
                RespExample = "{\n  \"month\": \"2026-07\",\n  \"revenue\": 12480000,\n  \"expense\": 8920000,\n  \"net\": 3560000\n}",
                RespFieldsJson = "[[\"month\",\"string (YYYY-MM)\",\"เดือนที่สรุปรายงาน\"],[\"revenue\",\"number\",\"รายรับรวม (บาท)\"],[\"expense\",\"number\",\"รายจ่ายรวม (บาท)\"],[\"net\",\"number\",\"กำไร/ขาดทุนสุทธิ (บาท)\"]]" },

            new ApiEndpoint { CategoryId = catByKey["hr"].Id, Method = "GET", Path = "/employees/{id}", Scope = "hr.read",
                Summary = "ดึงข้อมูลพนักงานรายบุคคล (ข้อมูลส่วนบุคคล)",
                Icon = "🪪", Scenario = "อยากเช็คว่าพนักงานคนนี้อยู่แผนกไหน ตำแหน่งอะไร → ใช้อันนี้",
                Description = "ดึงข้อมูลพนักงานรายบุคคล ใช้สำหรับระบบ HR ภายในเท่านั้น (มีข้อมูลส่วนบุคคล)",
                ParamsJson = "[[\"id\",\"path\",\"string\",\"yes\",\"รหัสพนักงาน\"]]",
                RespExample = "{\n  \"id\": \"EMP-0512\",\n  \"name\": \"สมชาย ใจดี\",\n  \"department\": \"Sales\",\n  \"position\": \"Sales Executive\"\n}",
                RespFieldsJson = "[[\"id\",\"string\",\"รหัสพนักงาน\"],[\"name\",\"string\",\"ชื่อ-นามสกุล\"],[\"department\",\"string\",\"แผนก\"],[\"position\",\"string\",\"ตำแหน่ง\"]]" },
            new ApiEndpoint { CategoryId = catByKey["hr"].Id, Method = "GET", Path = "/leave-requests", Scope = "hr.read",
                Summary = "ดึงรายการคำขอลาที่รอดำเนินการ",
                Icon = "🗓️", Scenario = "อยากรู้ว่ามีใครยื่นขอลาที่ยังรอการอนุมัติอยู่บ้าง → ใช้อันนี้",
                Description = "ดึงรายการคำขอลาที่รอดำเนินการหรือประวัติการลาของพนักงาน",
                ParamsJson = "[[\"status\",\"query\",\"string\",\"no\",\"pending, approved, rejected\"]]",
                RespExample = "{\n  \"data\": [\n    { \"id\": \"LV-1092\", \"employee\": \"EMP-0512\", \"type\": \"annual\", \"days\": 2, \"status\": \"pending\" }\n  ]\n}",
                RespFieldsJson = "[[\"data[].id\",\"string\",\"รหัสคำขอลา\"],[\"data[].employee\",\"string\",\"รหัสพนักงาน\"],[\"data[].type\",\"string\",\"ประเภทการลา\"],[\"data[].days\",\"integer\",\"จำนวนวันลา\"],[\"data[].status\",\"string\",\"สถานะคำขอ\"]]" },
            new ApiEndpoint { CategoryId = catByKey["hr"].Id, Method = "POST", Path = "/payroll/run", Scope = "hr.write",
                Summary = "สั่งประมวลผลรอบเงินเดือน (สิทธิ์จำกัดเฉพาะ HR)",
                Icon = "💰", Scenario = "ถึงรอบจ่ายเงินเดือนแล้ว อยากสั่งให้ระบบประมวลผลเงินเดือนพนักงาน → ใช้อันนี้",
                Description = "สั่งประมวลผลรอบเงินเดือน สำหรับผู้มีสิทธิ์ระดับ HR เท่านั้น ไม่สามารถย้อนกลับได้หลังเริ่มประมวลผล",
                ParamsJson = "[[\"period\",\"body\",\"string\",\"yes\",\"YYYY-MM\"],[\"department\",\"body\",\"string\",\"no\",\"จำกัดเฉพาะแผนก\"]]",
                ReqBody = "{\n  \"period\": \"2026-08\",\n  \"department\": \"Sales\"\n}",
                RespExample = "{\n  \"run_id\": \"PR-2026-08\",\n  \"status\": \"processing\",\n  \"employees\": 214\n}",
                RespFieldsJson = "[[\"run_id\",\"string\",\"รหัสรอบประมวลผล\"],[\"status\",\"string\",\"สถานะการประมวลผล\"],[\"employees\",\"integer\",\"จำนวนพนักงานที่อยู่ในรอบนี้\"]]" }
        );
        db.SaveChanges();

        var salesUser = users[1];
        var purchaseUser = users[2];
        var financeUser = users[3];
        var hrUser = users[4];

        var app1 = new Application
        {
            Name = "Sales Mobile App",
            Description = "แอปพลิเคชันสำหรับทีมขายภาคสนาม ใช้เช็คสต๊อกสินค้าและสร้างคำสั่งขายผ่านมือถือแบบเรียลไทม์",
            Subdomain = "sales-mobile", Github = "github.com/megachem/sales-mobile-app",
            ProductsCsv = "sales,inventory", Status = AppStatus.Active, Type = AppType.Official,
            OwnerUserId = salesUser.Id, Icon = "📱",
            CreatedAt = new DateTime(2026, 3, 14), UpdatedAt = new DateTime(2026, 8, 5),
        };
        var app2 = new Application
        {
            Name = "PO Approval Bot",
            Description = "บอทแจ้งเตือนและอนุมัติใบสั่งซื้อผ่าน Line Notify สำหรับผู้บริหารฝ่ายจัดซื้อ",
            Subdomain = "po-approval-bot", Github = "github.com/megachem/po-approval-bot",
            ProductsCsv = "purchase", Status = AppStatus.Pending, Type = AppType.Registered, ReviewTarget = AppType.Verify, ReviewCycle = 1,
            OwnerUserId = purchaseUser.Id, Icon = "🤖",
            CreatedAt = new DateTime(2026, 6, 2), UpdatedAt = new DateTime(2026, 8, 10),
        };
        var app3 = new Application
        {
            Name = "Finance Insight Dashboard",
            Description = "แดชบอร์ดสรุปรายรับ-รายจ่ายและสถานะใบแจ้งหนี้แบบเรียลไทม์สำหรับทีมการเงิน",
            Subdomain = "finance-insight", Github = "github.com/megachem/finance-insight",
            ProductsCsv = "finance,sales", Status = AppStatus.Draft, Type = AppType.Registered,
            OwnerUserId = financeUser.Id, Icon = "📊",
            CreatedAt = new DateTime(2026, 7, 30), UpdatedAt = new DateTime(2026, 7, 30),
        };
        var app4 = new Application
        {
            Name = "Warehouse Scanner",
            Description = "แอปสแกนบาร์โค้ดสำหรับเช็คสต๊อกและรับ-โอนสินค้าระหว่างคลังผ่านมือถือ",
            Subdomain = "warehouse-scanner", Github = "github.com/megachem/warehouse-scanner",
            ProductsCsv = "inventory", Status = AppStatus.Active, Type = AppType.Verify,
            OwnerUserId = purchaseUser.Id, Icon = "📦",
            CreatedAt = new DateTime(2026, 5, 10), UpdatedAt = new DateTime(2026, 7, 2),
        };
        var app5 = new Application
        {
            Name = "HR Leave Portal",
            Description = "ระบบยื่นคำขอลาและตรวจสอบวันลาคงเหลือสำหรับพนักงานทุกแผนก",
            Subdomain = "hr-leave", Github = "github.com/megachem/hr-leave-portal",
            ProductsCsv = "hr", Status = AppStatus.Active, Type = AppType.Official,
            OwnerUserId = hrUser.Id, Icon = "🗓️",
            CreatedAt = new DateTime(2026, 2, 1), UpdatedAt = new DateTime(2026, 6, 20),
        };
        db.Applications.AddRange(app1, app2, app3, app4, app5);
        db.SaveChanges();

        AppCredential Cred(Application a, string env)
        {
            var c = CredentialGenerator.NewAppCredential(env);
            c.ApplicationId = a.Id;
            return c;
        }

        db.AppCredentials.AddRange(
            Cred(app1, CredEnv.Sandbox), Cred(app1, CredEnv.Production),
            Cred(app2, CredEnv.Sandbox),
            Cred(app3, CredEnv.Sandbox),
            Cred(app4, CredEnv.Sandbox), Cred(app4, CredEnv.Production),
            Cred(app5, CredEnv.Sandbox), Cred(app5, CredEnv.Production)
        );

        db.AppLogEntries.AddRange(
            new AppLogEntry { ApplicationId = app1.Id, ActionType = LogActionType.Create, OccurredAt = new DateTime(2026, 3, 14), Actor = salesUser.Email },
            new AppLogEntry { ApplicationId = app1.Id, ActionType = LogActionType.Review, OccurredAt = new DateTime(2026, 3, 20), Actor = salesUser.Email },
            new AppLogEntry { ApplicationId = app1.Id, ActionType = LogActionType.Publish, OccurredAt = new DateTime(2026, 4, 2), Actor = "it-digital@megachem.co.th", Note = "คณะกรรมการอนุมัติระดับ Official (3/3 เสียง)" },
            new AppLogEntry { ApplicationId = app1.Id, ActionType = LogActionType.Update, OccurredAt = new DateTime(2026, 8, 5), Actor = salesUser.Email, Note = "เพิ่มสิทธิ์ Inventory API" },

            new AppLogEntry { ApplicationId = app2.Id, ActionType = LogActionType.Create, OccurredAt = new DateTime(2026, 6, 2), Actor = purchaseUser.Email },
            new AppLogEntry { ApplicationId = app2.Id, ActionType = LogActionType.Update, OccurredAt = new DateTime(2026, 7, 15), Actor = purchaseUser.Email, Note = "แก้ไข GitHub repository" },
            new AppLogEntry { ApplicationId = app2.Id, ActionType = LogActionType.Review, OccurredAt = new DateTime(2026, 8, 10), Actor = purchaseUser.Email, Note = "ขอตรวจสอบระดับ Verify" },

            new AppLogEntry { ApplicationId = app3.Id, ActionType = LogActionType.Create, OccurredAt = new DateTime(2026, 7, 30), Actor = financeUser.Email },

            new AppLogEntry { ApplicationId = app4.Id, ActionType = LogActionType.Create, OccurredAt = new DateTime(2026, 5, 10), Actor = purchaseUser.Email },
            new AppLogEntry { ApplicationId = app4.Id, ActionType = LogActionType.Review, OccurredAt = new DateTime(2026, 5, 18), Actor = purchaseUser.Email, Note = "ขอตรวจสอบระดับ Verify" },
            new AppLogEntry { ApplicationId = app4.Id, ActionType = LogActionType.Publish, OccurredAt = new DateTime(2026, 5, 25), Actor = "it-digital@megachem.co.th", Note = "คณะกรรมการอนุมัติระดับ Verify (2/3 เสียง)" },

            new AppLogEntry { ApplicationId = app5.Id, ActionType = LogActionType.Create, OccurredAt = new DateTime(2026, 2, 1), Actor = hrUser.Email },
            new AppLogEntry { ApplicationId = app5.Id, ActionType = LogActionType.Review, OccurredAt = new DateTime(2026, 2, 10), Actor = hrUser.Email, Note = "ขอตรวจสอบระดับ Official" },
            new AppLogEntry { ApplicationId = app5.Id, ActionType = LogActionType.Publish, OccurredAt = new DateTime(2026, 2, 20), Actor = "it-digital@megachem.co.th", Note = "คณะกรรมการอนุมัติระดับ Official (3/3 เสียง)" }
        );

        var c1 = committee[0];
        db.AppVotes.Add(new AppVote { ApplicationId = app2.Id, CommitteeMemberId = c1.Id, ReviewCycle = 1, Approved = true });

        db.SaveChanges();
    }

    /// <summary>
    /// จัดโครงสร้างทีมและระดับองค์กรให้ผู้ใช้ — แยกจาก Seed() เพราะต้องรันได้กับฐานข้อมูลที่มีข้อมูลอยู่แล้ว
    /// เขียนแบบ idempotent: ข้ามทุกอย่างที่มีอยู่แล้ว จึงเรียกซ้ำได้อย่างปลอดภัย
    /// </summary>
    public static void SeedOrgStructure(PortalDbContext db)
    {
        if (db.Teams.Any()) return;

        var teams = new[]
        {
            new Team { Key = "sales", Name = "ทีมขาย" },
            new Team { Key = "purchase", Name = "ทีมจัดซื้อ" },
            new Team { Key = "finance", Name = "ทีมการเงิน" },
            new Team { Key = "hr", Name = "ทีมบุคคล" },
            new Team { Key = "it", Name = "ทีมไอที" },
        };
        db.Teams.AddRange(teams);
        db.SaveChanges();

        Team TeamOf(string key) => teams.First(t => t.Key == key);
        int RoleId(string key) => db.Roles.First(r => r.Key == key).Id;

        // จัดผู้ใช้เดิมเข้าทีม — ค่าเริ่มต้นทุกคนคือ Employee (เห็นเฉพาะของตัวเอง)
        var assignments = new (string Email, string TeamKey, string Level)[]
        {
            ("it-digital@megachem.co.th", "it", OrgLevel.Management),
            ("sales.staff@megachem.co.th", "sales", OrgLevel.Employee),
            ("purchase.staff@megachem.co.th", "purchase", OrgLevel.Employee),
            ("finance.staff@megachem.co.th", "finance", OrgLevel.Employee),
            ("hr.staff@megachem.co.th", "hr", OrgLevel.Employee),
        };
        foreach (var (email, teamKey, level) in assignments)
        {
            var u = db.Users.FirstOrDefault(x => x.Email == email);
            if (u is null) continue;
            u.TeamId = TeamOf(teamKey).Id;
            u.Level = level;
        }

        string Hash(string pw) => BCrypt.Net.BCrypt.HashPassword(pw);

        // ผู้ใช้ตัวอย่างเพิ่มเติม เพื่อให้เห็นผลของแต่ละระดับได้จริง
        var extras = new[]
        {
            // Manager — เห็นข้อมูลของทุกคนใน "ทีมขาย"
            new User { Email = "sales.manager@megachem.co.th", DisplayName = "หัวหน้าทีมขาย", PasswordHash = Hash("Sales@123"),
                       RoleId = RoleId("sales"), TeamId = TeamOf("sales").Id, Level = OrgLevel.Manager },

            // Employee คนที่สองในทีมขาย — ไว้พิสูจน์ว่าหัวหน้าเห็นของลูกทีมได้ แต่เพื่อนร่วมทีมเห็นกันไม่ได้
            new User { Email = "sales.staff2@megachem.co.th", DisplayName = "พนักงานขาย 2", PasswordHash = Hash("Sales@123"),
                       RoleId = RoleId("sales"), TeamId = TeamOf("sales").Id, Level = OrgLevel.Employee },

            // Management ที่ไม่ใช่ admin — พิสูจน์ว่าระดับองค์กรทำงานเองได้ ไม่ได้อาศัยสิทธิ์ admin
            new User { Email = "director@megachem.co.th", DisplayName = "ผู้บริหาร", PasswordHash = Hash("Director@123"),
                       RoleId = RoleId("finance"), TeamId = TeamOf("finance").Id, Level = OrgLevel.Management },

            // กรณี "บางตำแหน่งต้องเห็นทั้งหมด" — ระดับ Employee แต่ตั้ง override ให้เห็นทุกอย่าง
            new User { Email = "audit@megachem.co.th", DisplayName = "ผู้ตรวจสอบภายใน", PasswordHash = Hash("Audit@123"),
                       RoleId = RoleId("finance"), TeamId = TeamOf("it").Id, Level = OrgLevel.Employee,
                       DataScopeOverride = DataScope.All },
        };
        foreach (var u in extras)
            if (!db.Users.Any(x => x.Email == u.Email)) db.Users.Add(u);

        db.SaveChanges();
    }

    /// <summary>
    /// มาตรการชั่วคราว: ผู้ใช้ที่ยังไม่ถูกจัดเข้าทีม/ระดับองค์กร (สร้างก่อน feature นี้ หรือ IT ยังไม่ได้จัดให้)
    /// จะถูก DataScope.FromLevel บีบให้เห็นเฉพาะของตัวเอง (Self) ทำให้ข้อมูลเก่าดูเหมือนหายไป
    /// จึงให้เห็นข้อมูลทั้งหมดไปก่อนผ่าน DataScopeOverride จนกว่า IT จะจัดทีม/ระดับให้ถูกต้องผ่าน AccessController
    /// รันได้ทุกครั้งที่ระบบเริ่มทำงาน (idempotent) — ข้ามผู้ใช้ที่ถูกจัดทีมหรือตั้ง override ไว้แล้ว
    /// </summary>
    public static void BackfillUnassignedUsersToSeeAll(PortalDbContext db)
    {
        var unassigned = db.Users
            .Where(u => u.TeamId == null && u.DataScopeOverride != DataScope.All)
            .ToList();

        foreach (var u in unassigned)
            u.DataScopeOverride = DataScope.All;

        if (unassigned.Count > 0) db.SaveChanges();
    }
}
