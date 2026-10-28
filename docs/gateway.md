# Gateway — API จริงที่แอปซึ่งอนุมัติแล้วเรียกได้

Portal ทำหน้าที่อนุมัติแอปและออก Token ID/Secret ส่วน Gateway (`Modules/Gateway`) คือ API ปลายทางที่แอปใช้ token นั้นเรียกข้อมูลจริง

## Endpoint ที่เปิดแล้ว

| Method | Path | ข้อมูลจาก | หมวดที่แอปต้องได้รับอนุมัติ |
|---|---|---|---|
| GET | `/api/v1/sales/orders` | Supabase ตาราง `SaleOrder` | `sales` |
| POST | `/api/v1/sales/orders` | สร้าง Sales Order ใน SAP | `sales` |
| PATCH | `/api/v1/sales/orders/{salesOrder}` | แก้ Sales Order ใน SAP | `sales` |
| POST | `/api/v1/sales/orders/{salesOrder}/cancel` | ยกเลิก Sales Order ใน SAP | `sales` |
| GET / POST / PATCH | `/api/v1/sales/sap/{odataPath}` | SAP `API_SALES_ORDER_SRV` ครบทุก operation (143 เส้นที่เปิด) — ดูหัวข้อด้านล่าง | `sales` |
| GET / POST / PUT | `/api/v1/sales/zoho/{module}…` | Zoho CRM API v8 — Deals, Quotes, Sales_Orders (ดูหัวข้อด้านล่าง) | `sales` |
| GET | `/api/v1/specs/sales-order-sap.json` | OpenAPI ของเส้นด้านบน พร้อม `x-mgt-scope` (ไม่ต้องใช้ token) | — |

Query parameters: `year`, `customer` (ค้นจากชื่อบางส่วน), `productCode`, `category`, `limit` (1–500, ค่าเริ่มต้น 50), `offset`

Headers ที่ต้องส่งทุกครั้ง: `X-Token-Id`, `X-Token-Secret`

**Token แยกตามหมวด API** — แอปที่ขอ Purchase + Inventory จะได้ 2 token ต่อ env (Sandbox 2, Production 2) token ของหมวดไหนใช้ได้กับ `/api/v1/<หมวด>` นั้นเท่านั้น (Token ID มีชื่อหมวดอยู่ในตัว เช่น `mgc_id_test_sales_…`)

## Gateway ตรวจอะไร

1. Token ID/Secret ตรงกัน และยังไม่ถูกเพิกถอน → ไม่ผ่านได้ 401
1. token เป็นของหมวดที่เรียก (เช่นเรียก `/api/v1/sales` ต้องใช้ token หมวด `sales`) → ไม่ผ่านได้ 403
2. credential ของ env นั้นใช้ได้ในขั้นนี้ของแอป (`ApplicationWorkflow.CredentialAllowed`) → ไม่ผ่านได้ 403
   - **Sandbox:** ตั้งแต่ IT เตรียม repo เสร็จ (ช่วงพัฒนาและรอรีวิว) จนหลังอนุมัติ
   - **Production:** หลังอนุมัติ (Active) เท่านั้น
   - ต้องเป็น Tier 2 หรือ 3 และแอปไม่ได้ถูกระงับ
3. แอปเลือก API หมวดนั้นไว้ในคำขอ (`ProductsCsv`) → ไม่ผ่านได้ 403

## ได้ token เมื่อไร

| จังหวะ | ได้อะไร |
|---|---|
| IT กด "เตรียมเสร็จ" ในขั้น IT preparation | Sandbox token (ออกให้อัตโนมัติ) |
| ผ่าน IT code review + กรรมการ 3 คน | Production token (ออกให้อัตโนมัติ) |
| แอปถูกระงับ | token ทั้งหมดถูกเพิกถอน |
| รายการ API ของแอปเปลี่ยน | ออก token ให้หมวดที่เพิ่ม และเพิกถอน token ของหมวดที่เอาออก |

ทุกจังหวะออก 1 token ต่อ 1 หมวดที่ขอ

**ย้ายจาก token เดียวต่อแอป:** migration `PerCategoryCredentials` ผูก token เดิมกับหมวดแรกใน `ProductsCsv` (แอปที่ใช้อยู่ไม่สะดุด) แล้วตอนเริ่ม API จะออก token ให้หมวดที่เหลือเอง ดูได้ที่หน้ารายละเอียดแอป

Admin ออกใหม่หรือเพิกถอนเองได้ที่หน้ารายละเอียดแอป ทีละหมวดทีละ env (`POST /api/applications/{id}/credentials/{env}/{category}/regenerate|revoke`) ตามกติกาเดียวกัน

## ตั้งค่า Supabase (ครั้งเดียว)

```
cd src\Api\MGT.Portal.Api
dotnet user-secrets set Supabase:Url "https://<project-ref>.supabase.co"
dotnet user-secrets set Supabase:Key "<key>"
```

Production ใช้อีกชุด (`Supabase:Production:Url`, `Supabase:Production:Key`) บนเซิร์ฟเวอร์ตั้งเป็น environment variable `Supabase__Url`, `Supabase__Key`, `Supabase__Production__Url`, `Supabase__Production__Key`

ถ้ายังไม่ได้ตั้งค่าของ env ไหน Gateway จะตอบ 503

## เขียน Sales Order เข้า SAP (Create / Update / Cancel)

เขียนตรงเข้า SAP S/4HANA Cloud ผ่าน `API_SALES_ORDER_SRV` (OData V2, Communication Arrangement `SAP_COM_0109`) **ยังไม่เขียน Supabase** ดังนั้น GET `/orders` จะยังไม่เห็น SO ที่สร้างผ่าน API

| token ที่ใช้ | เขียนเข้า |
|---|---|
| Sandbox | SAP DEV (`my423387`) ชั่วคราว ภายหลังย้ายเป็น SAP UAT — `Sap:*` |
| Production | SAP Production (`my425819`) — `Sap:Production:*` |

กติกา:

- ทุกคำขอเขียนต้องส่ง header `Idempotency-Key` (เช่น UUID ใหม่ทุกคำขอ) ถ้าเน็ตหลุดแล้วส่งซ้ำด้วยค่าเดิม จะได้ผลเดิมกลับมา (header `Idempotent-Replayed: true`) ไม่สร้าง SO ซ้ำ key เดิมแต่ body ต่างกัน → 422
- แก้และยกเลิกได้เฉพาะ SO ที่**แอปเดียวกันสร้างผ่าน Gateway ใน env เดียวกัน** → ไม่ใช่ได้ 403
- ไม่มี DELETE — ยกเลิก = ใส่ Rejection Reason ให้ทุกรายการที่ยังเปิดอยู่ ยกเลิกซ้ำได้ผลเดิม
- Sales Org / Distribution Channel / Division / Order Type Gateway เติมจาก config แอปส่งแค่ลูกค้า PO วันส่ง และรายการสินค้า
- ทุกคำขอถูกบันทึกในตาราง `GatewayWriteRecords` ของ Portal (แอปไหน env ไหน ทำอะไรกับ SO เลขอะไร ผลเป็นอย่างไร) เพราะฝั่ง SAP ใช้ communication user ร่วมชุดเดียว

ตัวอย่างสร้าง SO:

```
curl -X POST "http://localhost:5038/api/v1/sales/orders" \
  -H "X-Token-Id: mgc_id_test_xxxxxx" -H "X-Token-Secret: mgc_secret_test_xxxxxxxx" \
  -H "Idempotency-Key: 7b1c3c2e-1f7a-4c55-9d1e-2f0a6c9e1a11" -H "Content-Type: application/json" \
  -d '{"soldToParty":"1000123","customerPurchaseOrder":"PO-TEST-001","requestedDeliveryDate":"2026-11-15","items":[{"productCode":"CHM-010","quantity":1000,"unit":"KG"}]}'
```

แก้: `PATCH /orders/{salesOrder}` body `{"customerPurchaseOrder":"...","requestedDeliveryDate":"2026-11-20","items":[{"item":"10","quantity":1200}]}` (ส่งเฉพาะที่เปลี่ยน) · ยกเลิก: `POST /orders/{salesOrder}/cancel` body `{}` หรือ `{"reasonCode":"Z1"}`

ผลลัพธ์ (อ่านกลับจาก SAP หลังเขียน):

```json
{
  "data": { "salesOrder": "1000045", "soldToParty": "1000123", "requestedDeliveryDate": "2026-11-15", "totalNetAmount": 208604.8, "currency": "THB",
            "items": [{ "item": "10", "productCode": "CHM-010", "quantity": 1000, "unit": "KG", "rejectionReason": null }] },
  "meta": { "source": "sap", "env": "sandbox" }
}
```

| status | ความหมาย |
|---|---|
| 201 / 200 | สำเร็จ |
| 400 | body ไม่ครบ หรือไม่มี `Idempotency-Key` |
| 403 | token ใช้ไม่ได้ หรือ SO นี้ไม่ใช่ของแอป |
| 404 | ไม่พบ SO ใน SAP |
| 409 | SO ถูกแก้ใน SAP ระหว่างนี้ หรือคำขอด้วย key นี้ยังทำไม่เสร็จ |
| 422 | SAP ไม่รับข้อมูล (ข้อความจาก SAP อยู่ใน `message`) หรือใช้ key ซ้ำกับคำขออื่น |
| 502 / 504 | SAP ล้มหรือไม่ตอบ — **SO อาจถูกบันทึกแล้ว** ตรวจใน SAP ก่อนส่งใหม่ด้วย key ใหม่ |
| 503 | Gateway ยังไม่ได้ตั้งค่า SAP ของ env นั้น |

ถ้า SAP ปฏิเสธตั้งแต่คำขอแรก (เช่น 422, 404) ส่งซ้ำด้วย key เดิมหลังแก้ปัญหาฝั่ง SAP ได้ แต่ถ้าแก้ body ต้องใช้ key ใหม่

### ตั้งค่า SAP (ครั้งเดียว)

```
cd src\Api\MGT.Portal.Api
dotnet user-secrets set Sap:Url "https://my423387-api.s4hana.cloud.sap"
dotnet user-secrets set Sap:User "<communication user>"
dotnet user-secrets set Sap:Password "<password>"
dotnet user-secrets set Sap:SalesOrganization "<เช่น 1010>"
dotnet user-secrets set Sap:DistributionChannel "<เช่น 10>"
dotnet user-secrets set Sap:OrganizationDivision "<เช่น 00>"
dotnet user-secrets set Sap:RejectionReason "<รหัส Rejection Reason ที่ใช้ยกเลิก>"
```

ใช้ host ที่มี `-api` เสมอ (host ที่ไม่มี `-api` เป็นหน้า login ของคน communication user เรียกไม่ผ่าน) · Production: `https://my425819-api.s4hana.cloud.sap` · `Sap:SalesOrderType` ไม่ตั้งก็ได้ (ค่าเริ่มต้น `OR`) · `Sap:Url` ใส่ host ของ tenant หรือ URL เต็มของ service ก็ได้ · Production ใช้ชุด `Sap:Production:*` บนเซิร์ฟเวอร์ตั้งเป็น environment variable เช่น `Sap__Production__Url` · ถ้ายังไม่ได้ตั้งค่าของ env ไหน Gateway จะตอบ 503

## SAP Sales Order ครบทุก operation (`/api/v1/sales/sap/*`)

ส่งต่อคำขอไป SAP `API_SALES_ORDER_SRV` ตรง ๆ ผ่านโดเมนบริษัท — path หลัง `/api/v1/sales/sap` **เหมือนเอกสารของ SAP ทุกตัว** (SAP Business Accelerator Hub → Sales Order (A2X)) คำตอบเป็น JSON ของ SAP (OData V2 `{"d": ...}`) ตามเดิม ใช้ token หมวด Sales ตัวเดิม

```
GET   /api/v1/sales/sap/A_SalesOrder?$filter=SoldToParty eq '1000123'&$top=20
GET   /api/v1/sales/sap/A_SalesOrder('1000045')/to_Item
POST  /api/v1/sales/sap/A_SalesOrder                      (สร้าง — deep insert to_Item / to_Partner / to_Text ได้)
POST  /api/v1/sales/sap/A_SalesOrder('1000045')/to_Text   (เพิ่ม text ใน SO ของแอป)
PATCH /api/v1/sales/sap/A_SalesOrderItem(SalesOrder='1000045',SalesOrderItem='10')
GET   /api/v1/sales/sap/$metadata                         (field จริงของ tenant รวม custom field YY1_)
```

รายการทั้งหมดอยู่ที่ `GET /api/v1/specs/sales-order-sap.json` (OpenAPI สร้างจาก spec ของ SAP ตัด operation ที่ไม่เปิดออกแล้ว) — MGT MCP ใช้ไฟล์นี้ตอบผู้ใช้ว่าต้องใช้เส้นไหน

### Scope — ผู้ใช้เลือก "แอปทำอะไร" ไม่ต้องเลือก endpoint

| scope | ผู้ขอแอปเลือกว่า | operation |
|---|---|---|
| `sales.order.read` | ดูใบสั่งขาย | GET ทั้งหมด 98 เส้น + `$metadata` |
| `sales.order.create` | สร้างใบสั่งขาย | POST `A_SalesOrder` |
| `sales.order.update` | แก้ไขใบสั่งขาย | PATCH 16 เส้น + POST เพิ่ม item / partner / text / ราคา / schedule line ฯลฯ 26 เส้น |
| `sales.order.cancel` | ยกเลิกใบสั่งขาย | PATCH ที่ใส่ `SalesDocumentRjcnReason` และ `POST /orders/{so}/cancel` |
| `sales.order.approve` | อนุมัติใบสั่งขาย | `releaseApprovalRequest` / `rejectApprovalRequest` — **ปิดไว้** จนกว่าจะผูกกับ Flow อนุมัติ (`Gateway:Sap:EnableApprove=true` เพื่อเปิด) |
| — | ไม่เปิด | DELETE 14 เส้น และ `$batch` |

ตอนนี้ **ยังไม่บังคับ scope** แอปที่ได้หมวด Sales ใช้ได้ทุก scope (ยกเว้น approve) ทุกคำตอบมี header `X-Gateway-Scope` และ log บันทึกว่าแอปใช้ scope / operation ไหน — ใช้เสนอ scope ให้อัตโนมัติตอนขอขึ้น Production ในขั้นถัดไป รายการ operation → scope อยู่ใน `Modules/Gateway/Services/SapSalesOrderOperations.g.cs`

### กติกา (เหมือน `/orders`)

- คำขอเขียน (POST / PATCH) ต้องมี `Idempotency-Key` และถูกบันทึกใน `GatewayWriteRecords` (ชื่อ operation เช่น `PATCH SalesOrderItem`)
- แก้ / เพิ่มของ / ยกเลิก ได้เฉพาะ SO ที่แอปสร้างผ่าน Gateway ใน env เดียวกัน (สร้างผ่าน `/orders` หรือ `/sap/A_SalesOrder` ก็นับ) — Gateway หาเลข SO จาก path, ฟิลด์ `SalesOrder` ใน body หรือ query `SalesOrder='…'`
- POST `A_SalesOrder`: Gateway เติม `SalesOrderType` / `SalesOrganization` / `DistributionChannel` / `OrganizationDivision` จาก config ส่งค่าอื่นมาได้ 422
- PATCH ไม่ส่ง `If-Match` ก็ได้ Gateway อ่าน ETag ล่าสุดจาก SAP ให้ (ถ้าอยากกันการเขียนทับ ให้ส่ง ETag ที่อ่านมาเอง)
- query ที่รองรับ: `$filter`, `$select`, `$expand`, `$orderby`, `$top` (สูงสุด 1000, list ที่ไม่ส่งได้ 100), `$skip`, `$inlinecount`, `$skiptoken` — `$format` ถูกตัดทิ้ง ตอบ JSON เสมอ
- URL ของ SAP ใน `__metadata.uri` / `__next` ถูกเปลี่ยนเป็น URL ของ Gateway

| status | ความหมาย |
|---|---|
| 200 / 201 / 204 | สำเร็จ (ตามที่ SAP ตอบ) |
| 400 | query ไม่รองรับ, body ไม่ใช่ JSON, ไม่มี `Idempotency-Key` หรือ SAP ไม่รับคำขอ (ข้อความ SAP อยู่ใน `message`) |
| 403 | DELETE / `$batch` / approve, หรือ SO นี้ไม่ใช่ของแอป |
| 404 | ไม่มี operation นี้ใน API หรือไม่พบข้อมูลใน SAP |
| 405 | path มีอยู่แต่ใช้ method อื่น (ดู header `Allow`) |
| 409 | ETag ไม่ตรง (ถูกแก้ใน SAP ระหว่างนี้) หรือคำขอด้วย key นี้ยังทำไม่เสร็จ |
| 422 | ค่าองค์กรไม่ตรง config หรือใช้ key ซ้ำกับคำขออื่น |
| 502 / 504 | SAP ล้มหรือไม่ตอบ — **อาจถูกบันทึกแล้ว** ตรวจใน SAP ก่อนส่งใหม่ด้วย key ใหม่ |
| 503 | Gateway ยังไม่ได้ตั้งค่า SAP ของ env นั้น |

**สร้างรายการ operation ใหม่** เมื่อ SAP เปลี่ยน API: ดาวน์โหลด `API_SALES_ORDER_SRV.json` จาก SAP Business Accelerator Hub แล้วรัน

```
python tools/gen-sap-sales-order-ops.py API_SALES_ORDER_SRV.json src/Api/MGT.Portal.Api/Modules/Gateway/Services/SapSalesOrderOperations.g.cs src/Api/MGT.Portal.Api/Modules/Gateway/Specs/sales-order-sap.json
```

## Zoho CRM — Deals, Quotes, Sales Orders (`/api/v1/sales/zoho/*`)

ส่งต่อไป Zoho CRM REST API v8 — path หลัง `/api/v1/sales/zoho` เหมือนเอกสารของ Zoho คำตอบที่สำเร็จเป็น JSON ของ Zoho ตามเดิม (`{"data": [...], "info": {...}}`) ใช้ token หมวด Sales ตัวเดิม

| Method | Path | ทำอะไร | scope |
|---|---|---|---|
| GET | `/zoho/{module}` | รายการ — ไม่ส่ง `fields` ได้ field พื้นฐาน, `per_page` ค่าเริ่มต้น 50 สูงสุด 200 | `sales.{deal\|quote\|order}.read` |
| GET | `/zoho/{module}/{id}` | ระเบียนเดียว (รวมรายการสินค้า) | read |
| GET | `/zoho/{module}/search?criteria=…` | ค้นหา (หรือ `email` / `phone` / `word`) | read |
| GET | `/zoho/settings/fields?module=Deals` | รายชื่อ field รวม custom field ของ Megachem | read |
| POST | `/zoho/{module}` | สร้าง — body `{"data":[{...}], "trigger":["workflow"]}` ไม่เกิน 100 ระเบียน | `….create` |
| PUT | `/zoho/{module}/{id}` | แก้ 1 ระเบียน — body `{"data":[{...}]}` | `….update` |

`{module}` = `Deals`, `Quotes` หรือ `Sales_Orders` · ไม่เปิด DELETE และแก้หลายระเบียนพร้อมกัน (`PUT /{module}`)

กติกา:

- POST / PUT ต้องมี `Idempotency-Key` และถูกบันทึกใน `GatewayWriteRecords` (operation เช่น `POST Zoho Deals`)
- แก้ได้เฉพาะระเบียนที่แอปสร้างผ่าน Gateway ใน env เดียวกัน — ปิดได้ด้วย `Gateway:Zoho:RestrictUpdatesToOwnRecords=false` ถ้าต้องให้แอปแก้ดีลที่พนักงานสร้างเองใน Zoho
- Sales Order ที่สร้างใน Zoho เข้า Flow อนุมัติของ Zoho และ RPA ส่งต่อ SAP ตามปกติ ส่วน `/sap/...` เขียน SAP ตรง (สำหรับแอปที่จะมาแทน Zoho ในอนาคต)
- error เป็น `{"message": "<code ของ Zoho> …", "zoho": <error เดิมของ Zoho>}` · 429 = เกิน API limit ของ Zoho · 401/403 จาก Zoho = credential ของ Gateway ผิด (ตอบแอปเป็น 502)

### ตั้งค่า Zoho

Gateway อ่าน `ZohoConfig:sandbox:*` สำหรับ Sandbox token และ `ZohoConfig:prod:*` สำหรับ Production token (ไม่ใช้ `ActiveEnvironment`)

```json
"ZohoConfig": {
  "prod":    { "ClientId": "…", "ClientSecret": "…", "RefreshToken": "…", "AccountsUrl": "https://accounts.zoho.com", "ApiDomain": "https://www.zohoapis.com" },
  "sandbox": { "ClientId": "…", "ClientSecret": "…", "RefreshToken": "…", "AccountsUrl": "https://accounts.zoho.com", "ApiDomain": "https://sandbox.zohoapis.com" }
}
```

Self Client ต้องมี scope `ZohoCRM.modules.deals.ALL,ZohoCRM.modules.quotes.ALL,ZohoCRM.modules.salesorders.ALL,ZohoCRM.settings.fields.READ` · แนะนำเก็บ `ClientSecret` / `RefreshToken` ด้วย `dotnet user-secrets set "ZohoConfig:sandbox:RefreshToken" "…"` แทนไฟล์ appsettings ที่อยู่ใน git · access token ขอใหม่อัตโนมัติทุก ~55 นาที · ยังไม่ได้ตั้งค่าของ env ไหน Gateway ตอบ 503

## ทดสอบใน Postman

1. รัน backend (`dotnet run --project src/Api/MGT.Portal.Api`) ที่ http://localhost:5038
2. ใน Portal: แอปต้องเลือก API Sales และ IT ต้องกดเตรียมเสร็จแล้ว จากนั้นคัดลอก Sandbox Token ID/Secret จากหน้ารายละเอียดแอป (ส่วน API credentials)
3. Import `docs/postman/MGT-Gateway.postman_collection.json` แล้วใส่ตัวแปร `tokenId` และ `tokenSecret` ของ collection
4. ส่ง request "SaleOrder ปี 2026" หรือ "สร้าง Sales Order (SAP)" — request สร้างจะเก็บเลข SO ไว้ในตัวแปร `salesOrder` ให้ request แก้และยกเลิกใช้ต่อ

ตัวอย่างด้วย curl:

```
curl "http://localhost:5038/api/v1/sales/orders?year=2026&limit=5" -H "X-Token-Id: mgc_id_test_xxxxxx" -H "X-Token-Secret: mgc_secret_test_xxxxxxxx"
```

ตัวอย่าง response:

```json
{
  "data": [{ "transactionId": "TRX-2026-020248", "customerName": "Rayong Auto Parts", "salesAmountThb": 208604.8 }],
  "page": { "limit": 5, "offset": 0, "total": 25000 },
  "meta": { "source": "supabase", "env": "sandbox" }
}
```
