using System.ComponentModel.DataAnnotations;

namespace MGT.Portal.Api.Modules.Gateway;

// ---- คำขอจากแอป ----
// แอปส่งเฉพาะข้อมูลที่รู้ ส่วน Order Type / Sales Org / Distribution Channel / Division
// Gateway เติมจาก config ของ env นั้น (Sap:SalesOrderType ฯลฯ) แอปไม่ต้องรู้โครงสร้างองค์กรใน SAP

/// <summary>สร้าง Sales Order ใน SAP</summary>
public sealed record CreateSalesOrderRequest(
    [Required, StringLength(10, MinimumLength = 1)] string SoldToParty,
    [StringLength(35)] string? CustomerPurchaseOrder,
    DateOnly? RequestedDeliveryDate,
    [Required, MinLength(1), MaxLength(100)] List<CreateSalesOrderItem> Items);

public sealed record CreateSalesOrderItem(
    [Required, StringLength(40, MinimumLength = 1)] string ProductCode,
    [Range(typeof(decimal), "0.001", "999999999")] decimal Quantity,
    [StringLength(3)] string? Unit);

/// <summary>แก้ Sales Order — ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน อย่างน้อย 1 ฟิลด์</summary>
public sealed record UpdateSalesOrderRequest(
    [StringLength(35)] string? CustomerPurchaseOrder,
    DateOnly? RequestedDeliveryDate,
    [MaxLength(100)] List<UpdateSalesOrderItem>? Items)
{
    public bool HasHeaderChanges => CustomerPurchaseOrder is not null || RequestedDeliveryDate is not null;
    public bool IsEmpty => !HasHeaderChanges && (Items is null || Items.Count == 0);
}

public sealed record UpdateSalesOrderItem(
    [Required, RegularExpression("^[0-9]{1,6}$")] string Item,
    [Range(typeof(decimal), "0.001", "999999999")] decimal Quantity);

/// <summary>ยกเลิก Sales Order = ใส่ Rejection Reason ให้ทุกรายการ (ไม่ลบเอกสารใน SAP)</summary>
public sealed record CancelSalesOrderRequest([StringLength(2)] string? ReasonCode);

// ---- ผลลัพธ์ที่ส่งกลับ (อ่านจาก SAP หลังเขียนเสร็จ) ----

public sealed record SalesOrderItemResult(
    string Item, string? ProductCode, decimal? Quantity, string? Unit, decimal? NetAmount, string? RejectionReason);

public sealed record SalesOrderResult(
    string SalesOrder, string? SalesOrderType, string? SoldToParty, string? CustomerPurchaseOrder,
    string? RequestedDeliveryDate, decimal? TotalNetAmount, string? Currency, string? OverallStatus,
    List<SalesOrderItemResult> Items);

public sealed record SalesOrderWriteResponse(SalesOrderResult Data, GatewayMeta Meta);
