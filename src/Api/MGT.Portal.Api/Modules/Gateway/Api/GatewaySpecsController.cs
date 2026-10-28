using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MGT.Portal.Api.Modules.Gateway;

/// <summary>
/// OpenAPI ของ API ที่ Gateway ส่งต่อไประบบปลายทาง — เปิดอ่านได้โดยไม่ต้องใช้ token (เป็นเอกสาร ไม่มีข้อมูลจริง)
/// MGT MCP และนักพัฒนาใช้ดูว่ามี operation อะไร ต้องส่งอะไร และต้องใช้ scope ไหน (x-mgt-scope)
/// </summary>
[ApiController]
[Route("api/v1/specs")]
[AllowAnonymous]
public class GatewaySpecsController : ControllerBase
{
    private const string SalesOrderSapResource = "MGT.Portal.Api.Gateway.Specs.sales-order-sap.json";

    /// <summary>SAP Sales Order (API_SALES_ORDER_SRV) ผ่าน /api/v1/sales/sap — 143 operation ที่เปิด พร้อม x-mgt-scope</summary>
    [HttpGet("sales-order-sap.json")]
    public IActionResult SalesOrderSap()
    {
        var stream = typeof(GatewaySpecsController).Assembly.GetManifestResourceStream(SalesOrderSapResource);
        return stream is null ? NotFound() : File(stream, "application/json; charset=utf-8");
    }
}
