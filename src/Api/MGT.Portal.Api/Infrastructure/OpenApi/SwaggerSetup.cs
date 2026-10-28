using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace MGT.Portal.Api.Infrastructure.OpenApi;

/// <summary>
/// OpenAPI (/openapi/v1.json) + หน้า Swagger UI (/swagger) สำหรับเทส API
/// - ปุ่ม Authorize รองรับ 2 แบบ: JWT ของหน้า Portal (api/*) และ Token ID/Secret ของแอป (Gateway api/v1/*)
/// - คำขอเขียนของ Gateway มีช่อง Idempotency-Key และ Swagger UI สุ่มค่าให้อัตโนมัติ
/// เปิดเฉพาะ Development (ดู Program.cs)
/// </summary>
public static class SwaggerSetup
{
    public const string DocumentUrl = "/openapi/v1.json";
    public const string UiPath = "/swagger";

    private const string PortalJwt = "PortalJwt";
    private const string GatewayTokenId = "GatewayTokenId";
    private const string GatewayTokenSecret = "GatewayTokenSecret";
    // ชื่อ header ตรงกับ GatewayAuth / GatewayIdempotency (ไม่อ้าง module Gateway ตรง ๆ)
    private const string TokenIdHeader = "X-Token-Id";
    private const string TokenSecretHeader = "X-Token-Secret";
    private const string IdempotencyHeader = "Idempotency-Key";
    private const string GatewayPrefix = "api/v1/";

    public static IServiceCollection AddPortalOpenApi(this IServiceCollection services) =>
        services.AddOpenApi(o =>
        {
            o.AddDocumentTransformer((doc, _, _) =>
            {
                doc.Info.Title = "MGT Portal API";
                doc.Info.Description =
                    "API ของ MGT Portal\n\n" +
                    "- **Gateway (`/api/v1/*`)** — กด Authorize แล้วใส่ `X-Token-Id` และ `X-Token-Secret` จากหน้ารายละเอียดแอปใน Portal " +
                    "(Sandbox token → SAP UAT / Supabase sandbox, Production token → ของจริง) " +
                    "**token แยกตามหมวด** — เรียก `/api/v1/sales` ต้องใช้ token ของหมวด Sales\n" +
                    "- **Portal (`/api/*`)** — เรียก `POST /api/auth/login` เอา token มาใส่ช่อง PortalJwt\n" +
                    "- คำขอเขียน (POST/PATCH) ของ Gateway ต้องมี `Idempotency-Key` — หน้า Swagger สุ่มให้แล้ว ส่งซ้ำด้วย key เดิมจะได้ผลเดิม ไม่สร้างซ้ำ";

                doc.Components ??= new OpenApiComponents();
                doc.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
                doc.Components.SecuritySchemes[PortalJwt] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Description = "token จาก POST /api/auth/login (ใส่เฉพาะตัว token ไม่ต้องพิมพ์ Bearer)",
                };
                doc.Components.SecuritySchemes[GatewayTokenId] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.ApiKey,
                    In = ParameterLocation.Header,
                    Name = TokenIdHeader,
                    Description = "Token ID ของแอป (หน้ารายละเอียดแอปใน Portal)",
                };
                doc.Components.SecuritySchemes[GatewayTokenSecret] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.ApiKey,
                    In = ParameterLocation.Header,
                    Name = TokenSecretHeader,
                    Description = "Token Secret ของแอป",
                };
                return Task.CompletedTask;
            });

            o.AddOperationTransformer((op, ctx, _) =>
            {
                var api = ctx.Description;
                var path = api.RelativePath ?? "";
                var method = api.HttpMethod?.ToUpperInvariant();

                if (path.StartsWith(GatewayPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    // ต้องส่งทั้ง 2 header พร้อมกัน → อยู่ใน requirement เดียวกัน
                    op.Security = [new OpenApiSecurityRequirement
                    {
                        [new OpenApiSecuritySchemeReference(GatewayTokenId, ctx.Document)] = [],
                        [new OpenApiSecuritySchemeReference(GatewayTokenSecret, ctx.Document)] = [],
                    }];

                    if (method is "POST" or "PATCH" or "PUT" or "DELETE")
                    {
                        op.Parameters ??= [];
                        op.Parameters.Add(new OpenApiParameter
                        {
                            Name = IdempotencyHeader,
                            In = ParameterLocation.Header,
                            Required = true,
                            Description = "ค่าไม่ซ้ำต่อคำขอ (แนะนำ GUID) — ส่งซ้ำด้วยค่าเดิมจะได้ผลลัพธ์เดิม ไม่เขียนซ้ำ",
                            Schema = new OpenApiSchema { Type = JsonSchemaType.String, MaxLength = 100 },
                        });
                    }
                    return Task.CompletedTask;
                }

                var metadata = api.ActionDescriptor.EndpointMetadata;
                var needsLogin = metadata.OfType<IAuthorizeData>().Any() && !metadata.OfType<IAllowAnonymous>().Any();
                if (needsLogin)
                {
                    op.Security = [new OpenApiSecurityRequirement
                    {
                        [new OpenApiSecuritySchemeReference(PortalJwt, ctx.Document)] = [],
                    }];
                }
                return Task.CompletedTask;
            });
        });

    /// <summary>/openapi/v1.json + หน้า /swagger (Swagger UI โหลดจาก CDN จึงไม่ต้องเพิ่ม NuGet package)</summary>
    public static WebApplication MapPortalSwagger(this WebApplication app)
    {
        app.MapOpenApi();
        // route นี้รับทั้ง /swagger และ /swagger/
        app.MapGet(UiPath, () => Results.Content(UiHtml, "text/html; charset=utf-8")).ExcludeFromDescription();
        return app;
    }

    private const string SwaggerUiVersion = "5.17.14";

    private static readonly string UiHtml = $$"""
        <!doctype html>
        <html lang="th">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>MGT Portal API — Swagger</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@{{SwaggerUiVersion}}/swagger-ui.css" />
          <style>body{margin:0;background:#fafafa}.swagger-ui .topbar{display:none}</style>
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@{{SwaggerUiVersion}}/swagger-ui-bundle.js"></script>
          <script>
            const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
            window.ui = SwaggerUIBundle({
              url: '{{DocumentUrl}}',
              dom_id: '#swagger-ui',
              deepLinking: true,
              persistAuthorization: true,   // จำ token ไว้ใน browser ไม่ต้องกรอกใหม่ทุกครั้งที่รีเฟรช
              displayRequestDuration: true,
              tryItOutEnabled: true,
              filter: true,
              docExpansion: 'list',
              // เติม Idempotency-Key ให้อัตโนมัติ (แก้เองได้ — ส่งซ้ำด้วยค่าเดิมเพื่อเทส idempotency)
              parameterMacro: (op, p) => p.name === '{{IdempotencyHeader}}' ? newKey() : undefined,
            });
          </script>
        </body>
        </html>
        """;
}
