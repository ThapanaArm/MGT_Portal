# Test Case: การ Approve Application / Deployment Request

วันที่จัดทำ: 10 พฤศจิกายน 2026  
ระบบ: MGT Portal  
ขอบเขต: การอนุมัติคำขอ Deploy Application รวมถึงการส่งกลับแก้ไข การกำหนดกรรมการ และผลต่อ API credentials  
สถานะเอกสาร: ออกแบบกรณีทดสอบ ยังไม่ได้ดำเนินการทดสอบ

## กติกาอ้างอิง

- Tier 1: ไม่ใช้ API อนุมัติอัตโนมัติหลังผ่านการเตรียมพัฒนาและส่ง Deployment Request
- Tier 2 และ Tier 3: ต้องได้กรรมการที่ได้รับมอบหมายให้แอปนั้นอนุมัติครบทุกคน — คำขอใหม่ 5 คน, คำขอที่มีอยู่ก่อน migration `CommitteeSizePerApplication` 3 คน (`Applications.CommitteeSize`) และ IT Code Review ผ่านในรอบปัจจุบัน ทั้งสองส่วนทำก่อนหรือหลังกันได้
- ผู้ขอเป็นกรรมการให้คำขอของตนเองไม่ได้ และ Admin ที่ไม่ได้รับมอบหมายเป็นกรรมการไม่สามารถลงคะแนนได้
- Approved หมายถึงอนุมัติให้ Deploy; ขั้นตอน Deployed และ Live ต้องบันทึกแยก
- ใช้คำขอรูปแบบ Development Request เป็นหลัก หากเป็นข้อมูลเก่าให้แยกชุดทดสอบ เพราะขั้นตอนและการออก credentials บางส่วนต่างกัน

## ข้อมูลและเงื่อนไขก่อนทดสอบ

| ข้อมูล | รายละเอียด |
|---|---|
| Owner A | เจ้าของคำขอ ไม่ใช่กรรมการของคำขอตนเอง |
| IT A / IT B | บัญชี Admin สองบัญชีสำหรับ Code Review และตรวจประวัติผู้ดำเนินการ |
| R1–R5 | กรรมการที่ได้รับมอบหมายให้คำขอ (คำขอเดิมใช้ R1–R3) |
| R6 | ผู้ใช้สำหรับแทนกรรมการเดิม |
| User X | ผู้ใช้ทั่วไปที่ไม่ใช่เจ้าของหรือกรรมการ |
| APP-T1 | Tier 1 ไม่มี API ผ่าน IT preparation แล้ว |
| APP-T2 | Tier 2 ขอ API หมวด Sales และ Purchase ผ่าน IT preparation แล้ว |
| APP-T3 | Tier 3 สร้างและเตรียมโดยผู้มีสิทธิ์ ผ่าน IT preparation แล้ว |
| Branch / Commit | ใช้ branch และ commit จริงของชุดทดสอบ เช่น main และ commit ที่เลือกไว้ |
| หลักฐาน | เก็บภาพหน้าจอ ผลตอบกลับ API และประวัติที่เกี่ยวข้อง โดยปกปิด Token Secret |

แต่ละกรณีใช้คำขอใหม่หรือคืนสถานะให้ตรง Precondition ห้ามนำผลจากกรณีก่อนมาปะปน ยกเว้นกรณีที่ระบุว่าทดสอบต่อเนื่อง

## กรณีทดสอบ

P1 = สำคัญสูง / เส้นทางหลักและสิทธิ์, P2 = กรณีรองและการตรวจข้อมูล

| ID | Priority | เรื่อง / Precondition | ขั้นตอนทดสอบ | ผลที่คาดหวัง |
|---|---|---|---|---|
| APR-001 | P1 | Tier 1 อนุมัติอัตโนมัติ; APP-T1 อยู่ขั้น Development | Owner ส่ง Deployment Request พร้อม branch และ commit | สถานะ Active และขั้น Awaiting deployment; ไม่ต้องมีคะแนนกรรมการหรือ IT Code Review; ไม่ออก API credentials |
| APR-002 | P1 | Tier 2 เส้นทางหลัก; APP-T2 อยู่ Pending และมี R1–R3 | R1, R2, R3 Approve จากนั้น IT Pass Code Review | ก่อนครบเงื่อนไขยัง Pending; เมื่อครบเป็น Active / Awaiting deployment และอนุมัติ Tier 2 |
| APR-003 | P1 | Tier 3 เส้นทางหลัก; APP-T3 อยู่ Pending และมี R1–R3 | R1–R3 Approve และ IT Pass Code Review | ต้องครบ 3 เสียงพร้อม IT ผ่าน จึง Active / Awaiting deployment และอนุมัติ Tier 3 |
| APR-004 | P1 | มีกรรมการผ่าน 4 คนและ IT ผ่าน | ตรวจสถานะ แล้วให้ R5 Approve | ก่อน R5 ยัง Pending แม้ได้ 4/5; หลัง R5 เป็น Active |
| APR-005 | P1 | กรรมการผ่านครบ 5 คน แต่ IT ยังไม่ตัดสิน | Refresh รายละเอียดและตรวจ credentials | ยัง Pending และไม่ออก Production credentials |
| APR-006 | P1 | IT ผ่านก่อนกรรมการ | IT Pass แล้วให้ R1–R5 Approve ตามลำดับ | IT ผ่านอย่างเดียวไม่ทำให้ Active; เสียงสุดท้ายทำให้อนุมัติสำเร็จ |
| APR-007 | P1 | คำขอ Tier 2 อยู่ Pending แต่ยังไม่มีกรรมการหรือมีเพียง 1–4 คน | IT Pass และให้กรรมการที่มีลงคะแนนครบ | ยังไม่อนุมัติ ต้องมีคะแนนจากกรรมการต่างคนครบ 5 คน |
| APR-008 | P1 | R1 เคย Approve แล้ว; คำขอยัง Pending | R1 กด Approve ซ้ำ แล้ว Refresh | มีคะแนน R1 เพียงหนึ่งรายการในรอบนี้ ไม่เพิ่มจำนวนเสียงซ้ำ |
| APR-009 | P1 | User X ไม่ได้รับมอบหมาย | เปิดหน้าหรือเรียก API vote โดยตรงด้วยบัญชี User X | ถูกปฏิเสธการลงคะแนน; HTTP 403; คะแนนและสถานะไม่เปลี่ยน |
| APR-010 | P1 | IT A เป็น Admin แต่ไม่ได้เป็นกรรมการของแอป | IT A เรียก API vote | HTTP 403; สิทธิ์ Admin ไม่ทำให้ลงคะแนนกรรมการได้โดยอัตโนมัติ |
| APR-011 | P1 | R1 เป็นกรรมการ | ส่ง vote พร้อม ReviewerUserId ของ R2 แล้วตรวจผล | ระบบบันทึกตามตัวตน R1 ที่เข้าสู่ระบบเท่านั้น ไม่บันทึกแทน R2 |
| APR-012 | P1 | User X ไม่ใช่ Admin | เรียก API Code Review, ถอน Code Review และกำหนดกรรมการ | ถูกปฏิเสธสิทธิ์; ไม่เปลี่ยนข้อมูล |
| APR-013 | P1 | IT กำหนดกรรมการ | เลือก Owner A เป็นหนึ่งในกรรมการ แล้วบันทึก | ไม่บันทึกและแจ้งว่าผู้ขอเป็นกรรมการให้แอปของตนเองไม่ได้ |
| APR-014 | P2 | IT กำหนดกรรมการ | ทดสอบแยก: คนซ้ำ, มากกว่า 5 คน (คำขอเดิม: มากกว่า 3 คน), User ID ไม่มีอยู่ | ปฏิเสธแต่ละรายการพร้อมข้อความเหมาะสม; ไม่บันทึกชุดกรรมการที่ไม่ถูกต้อง |
| APR-015 | P1 | Pending; R1 และ R2 ลงคะแนนแล้ว | IT เปลี่ยน R1 เป็น R4 จากนั้นตรวจคะแนนและให้ R4 Approve | คะแนน R1 ของรอบปัจจุบันถูกทิ้ง; คะแนน R2 ยังอยู่; R4 ต้องตัดสินเอง; มีประวัติการเปลี่ยนกรรมการ |
| APR-016 | P1 | กรรมการมีหน้าที่กับ APP-A แต่ไม่มีหน้าที่กับ APP-B ซึ่งยัง Pending | เปิด Review Queue และเรียก vote ของ APP-B | Queue แสดงเฉพาะ Pending ที่ได้รับมอบหมาย; ลงคะแนน APP-B ไม่ได้ |
| APR-017 | P1 | ผู้ใช้ยังไม่เข้าสู่ระบบหรือ session หมดอายุ | เรียก API vote หรือ Code Review | ไม่รับการตัดสิน; API ตอบ 401 และข้อมูลไม่เปลี่ยน |
| APR-018 | P1 | Pending | R1 เลือก Request changes พร้อมเหตุผล | คำขอกลับ Draft / ขั้น Changes; เก็บเหตุผล ผู้ตัดสิน และเวลา; ไม่อนุมัติและไม่ออก Production credentials |
| APR-019 | P2 | Pending | R1 Request changes โดยเว้นเหตุผลว่าง แล้วทดสอบด้วยช่องว่างล้วน | ปฏิเสธและให้ระบุเหตุผล; คำขอยังอยู่สถานะเดิม |
| APR-020 | P1 | Pending แบบ Development Request | IT Request changes พร้อมเหตุผลและลิงก์ HTTPS | กลับ Draft / Changes; เจ้าของเห็นเหตุผลและลิงก์; เก็บประวัติ IT ของรอบนี้ |
| APR-021 | P2 | Pending | IT Request changes โดยไม่กรอกเหตุผล | ปฏิเสธ; ไม่บันทึกผลไม่ผ่านหรือเปลี่ยนสถานะ |
| APR-022 | P1 | คำขอถูกส่งกลับแก้ไขและมีคะแนนอนุมัติเดิม | Owner แก้ไข ส่ง Deployment Request ใหม่พร้อม commit ใหม่ | ReviewCycle เพิ่มหนึ่ง; เก็บ branch/commit ใหม่; เริ่มนับคะแนนและ IT review ของรอบใหม่ ไม่ใช้ผลผ่านจากรอบก่อน |
| APR-023 | P1 | รอบใหม่มี IT change requests ที่ยังไม่ยืนยันการแก้ไขหลายรอบ รวมจาก IT B | IT A พยายาม Pass โดยยืนยันไม่ครบ จากนั้นยืนยันครบแล้ว Pass | ครั้งแรกถูกปฏิเสธ; เมื่อยืนยันครบทุกรายการจึงผ่านได้ และแต่ละรายการมี resolving cycle, IT A และเวลา |
| APR-024 | P1 | มี IT change requests ค้างในรอบก่อน; รอบปัจจุบัน Pending | IT เลือก Pass เฉพาะบางรายการด้วย ResolveOnly | เฉพาะรายการที่เลือกถูกยืนยัน; ยังไม่ถือว่า IT review รวมผ่าน และไม่อนุมัติแอปจากการทำรายการนี้เพียงอย่างเดียว |
| APR-025 | P2 | มีรายการ IT ค้าง | ส่ง ResolveOnly โดยไม่เลือกรอบ หรือเลือกรอบที่ไม่มี/ยืนยันแล้ว | ปฏิเสธและให้ตรวจข้อมูลล่าสุด; ไม่แก้รายการอื่น |
| APR-026 | P1 | Pending; IT ผ่านแล้ว แต่กรรมการยังไม่ครบ | IT ถอนผล Code Review | กลับเป็นรอ IT review; คะแนนกรรมการคงเดิม; ผล Pass รายการแก้ไขเดิมและผู้ยืนยัน/เวลาคงเดิม |
| APR-027 | P2 | IT ผ่านแล้วและคำขอยัง Pending | บันทึก IT decision ใหม่โดยยังไม่ถอนผลเดิม | ปฏิเสธและให้ถอนผลผ่านปัจจุบันก่อน |
| APR-028 | P2 | มีประวัติ IT Request changes | พยายามถอนผล Request changes | ปฏิเสธ; รักษาประวัติไว้และให้ส่งรอบใหม่หลังแก้ไข |
| APR-029 | P2 | Pending | IT Pass พร้อมลิงก์ HTTPS ต่างกัน 5 ลิงก์ จากนั้นทดสอบคำขอใหม่ด้วย 6 ลิงก์ | 5 ลิงก์บันทึกได้; 6 ลิงก์ถูกปฏิเสธ; ระบบเก็บลิงก์ ไม่อัปโหลดไฟล์ |
| APR-030 | P2 | Pending | ทดสอบลิงก์ HTTP, relative URL, ข้อความไม่ใช่ URL และ URL ยาวเกิน 2,000 ตัวอักษรทีละกรณี | ปฏิเสธทุกกรณี; ไม่บันทึกผล Code Review |
| APR-031 | P1 | คำขอเป็น Draft, Active หรือ Suspended | เรียก vote / Code Review ในแต่ละสถานะ | ไม่รับการตัดสินเพราะไม่ได้อยู่ Pending; ไม่เกิดคะแนนหรือ credentials เพิ่ม |
| APR-032 | P1 | APP-T2 มี Sandbox ของ Sales และ Purchase จาก IT preparation แล้ว | ตรวจ credentials ก่อนอนุมัติ แล้วอนุมัติครบทุกเงื่อนไข | ก่อนอนุมัติไม่มี Production; หลังอนุมัติมี Production แยกตาม Sales/Purchase; ไม่ออก Sandbox ซ้ำในหมวดเดิม และไม่มี token หมวดที่ไม่ได้ขอ |
| APR-033 | P1 | คำขออนุมัติแล้ว | ตรวจสถานะหน้า Owner, หน้า Admin, Refresh และ Activity Log | แสดงผลตรงกันว่า Approved / Awaiting deployment; มีผู้ดำเนินการและเวลา; ไม่แสดง Deployed หรือ Live โดยอัตโนมัติ |
| APR-034 | P1 | ระบบหลัก Live และมีคำขอ Update ที่เชื่อมกับระบบหลัก | อนุมัติ Update ครบเงื่อนไขของ Tier | Update ไป Awaiting deployment; ระบบหลักยัง Live และใช้ credentials เดิม; Update ไม่มี credentials แยก |
| APR-035 | P1 | คำขออนุมัติและ Awaiting deployment | Admin บันทึก Deployed แล้ว Live; ทดสอบแยกการข้ามไป Live ทันที | เปลี่ยนได้ตาม Awaiting deployment → Deployed → Live พร้อมผู้ดำเนินการและเวลา; การข้ามขั้นถูกปฏิเสธ |
| APR-036 | P1 | เปิดข้อมูล Deployment เดียวกันด้วย Admin สองบัญชี | IT A บันทึกสถานะสำเร็จ; IT B ส่งข้อมูลจากหน้าจอเก่าพร้อม ExpectedUpdatedAt เดิม | HTTP 409 สำหรับการเขียนจากข้อมูลเก่า; หน้า Admin โหลดข้อมูลล่าสุด; ไม่เขียนทับสถานะใหม่ |
| APR-037 | P2 | Pending | ทดสอบลิงก์ IT ซ้ำ มีช่องว่างหัวท้าย และช่องลิงก์ว่าง | ตัดช่องว่าง ตัดรายการว่าง และเก็บลิงก์ซ้ำเพียงครั้งเดียว |
| APR-038 | P1 | คำขอยังอยู่ IT preparation หรือ Development โดยยังไม่ส่ง Deploy | ตรวจสถานะและพยายามข้ามขั้นไป review | ไม่อนุมัติจากการเตรียมพัฒนาเพียงอย่างเดียว; ต้องส่ง Deployment Request และมี branch/commit ตาม validation |

## แบบบันทึกผลการทดสอบ

สร้างหนึ่งรายการต่อ Test Case และแยกผลเมื่อทดสอบหลาย Tier หรือหลายชุดข้อมูล

| Test Case ID | Tier / Application ID | Actual Result | Status | Defect ID | ผู้ทดสอบ / วันที่ | หลักฐาน |
|---|---|---|---|---|---|---|
| APR-___ | | | Not Run | | | |

Status: Not Run / Pass / Fail / Blocked  
หากผลจริงต่างจาก Expected ให้บันทึก Defect พร้อมขั้นตอนทำซ้ำ ข้อมูลคำขอ รอบรีวิว และหลักฐาน

## จุดที่ต้องตรวจยืนยันระหว่างทดสอบ

- กรณีการตัดสินพร้อมกันหรือการส่งซ้ำหลังการเชื่อมต่อขาดหาย: ตรวจว่าไม่เกิดคะแนนซ้ำ credentials ซ้ำ หรือสถานะค้าง และบันทึกผลจริงเพื่อประเมินความถูกต้องของการทำงานพร้อมกัน
- ข้อมูล legacy: ทดสอบแยกจาก Development Request และไม่อนุมานว่า IT change requests ในอดีตผ่านแล้ว หากไม่มีหลักฐานยืนยันในระบบ

## แหล่งอ้างอิงภายในโปรเจกต์

- `docs/application-request-flow.md`
- `src/Api/MGT.Portal.Api/Modules/Apps/Services/ApplicationWorkflow.cs`
- `src/Api/MGT.Portal.Api/Modules/Apps/Api/ApplicationsController.cs`
- `src/Api/MGT.Portal.Api/Modules/Apps/Api/DevelopmentRequestsController.cs`
- `tests/MGT.Portal.UnitTests/ApplicationWorkflowTests.cs`
- `tests/MGT.Portal.UnitTests/ReviewAuthorizationTests.cs`
