namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>ชื่อ operation ที่ Gateway เขียนลงระบบปลายทาง — ใช้ใน audit log และ Idempotency-Key</summary>
public static class GatewayWriteOperation
{
    public const string CreateSalesOrder = "sales-order.create";
    public const string UpdateSalesOrder = "sales-order.update";
    public const string CancelSalesOrder = "sales-order.cancel";
}

/// <summary>
/// บันทึกทุกคำขอเขียน (Create/Update/Cancel) ที่แอปส่งผ่าน Gateway — ทำหน้าที่ 2 อย่าง
/// 1) audit log: แอปไหน env ไหน ทำอะไรกับ Sales Order เลขอะไร ผลเป็นอย่างไร
///    (SAP ใช้ communication user ร่วมชุดเดียว จึงรู้ว่าแอปไหนทำได้จากตารางนี้เท่านั้น)
/// 2) Idempotency-Key: ส่งคำขอเดิมซ้ำด้วย key เดิม จะได้ผลลัพธ์เดิมกลับไป ไม่สร้าง SO ซ้ำ
/// StatusCode = 0 แปลว่ากำลังทำอยู่ (ยังไม่ได้คำตอบจาก SAP)
/// </summary>
public class GatewayWriteRecord
{
    public long Id { get; set; }
    public int ApplicationId { get; set; }
    public string ApplicationName { get; set; } = "";
    public string Env { get; set; } = "";
    public string Operation { get; set; } = "";
    public string IdempotencyKey { get; set; } = "";
    /// <summary>SHA-256 ของ operation + เลข SO + body — key เดิมแต่ body ต่างกันจะถูกปฏิเสธ</summary>
    public string RequestHash { get; set; } = "";
    public string? SalesOrder { get; set; }
    public int StatusCode { get; set; }
    public string? ResponseJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
