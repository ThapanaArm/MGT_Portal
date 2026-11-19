using System.Net.Http.Headers;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MGT.Portal.Api.Infrastructure.OpenApi;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Catalog;
using MGT.Portal.Api.Modules.Gateway;
using MGT.Portal.Api.Modules.Identity;
using MGT.Portal.Api.Shared;
using MGT.Portal.Api.Modules.Audit;
using MGT.Portal.Api.Modules.Scheduling;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddPortalOpenApi(); // /openapi/v1.json + /swagger — ดู Infrastructure/OpenApi/SwaggerSetup.cs

builder.Services.AddDbContext<PortalDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default"), sql =>
        sql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null)));

// ---- Modules ----
// Identity
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<DataBoundaryResolver>();
builder.Services.AddScoped<IUserDirectorySource, SqlUserDirectorySource>();
builder.Services.AddScoped<UserDirectorySync>();
// Access — เพิ่ม scope จาก AccessGrant ให้ Identity ตอนสร้างข้อมูลผู้ใช้
builder.Services.AddScoped<IUserScopeProvider, GrantedScopeProvider>();
builder.Services.AddScoped<ApiPermissionService>();
builder.Services.AddScoped<GatewayUserPermissionFilter>();
builder.Services.AddHttpContextAccessor();
// Apps — กติกาการอนุมัติตาม Tier
builder.Services.AddScoped<ApplicationWorkflow>();
builder.Services.AddScoped<CalendarService>();
builder.Services.AddScoped<GatewayUserContext>();
// Catalog — ตอนนี้มีแค่ controller ไม่มี service ที่ต้องลงทะเบียน
// Gateway — แอปใช้ Token ID/Secret เรียกข้อมูลจริง (ตอนนี้: SaleOrder จาก Supabase)
// Sandbox ใช้ Supabase:Url / Supabase:Key, Production ใช้ Supabase:Production:Url / Supabase:Production:Key
builder.Services.AddScoped<GatewayAuth>();
builder.Services.AddScoped<SupabaseSaleOrderClient>();
foreach (var (env, section) in new[] { (CredEnv.Sandbox, "Supabase"), (CredEnv.Production, "Supabase:Production") })
{
    builder.Services.AddHttpClient(SupabaseSaleOrderClient.HttpClientName(env), http =>
    {
        var url = builder.Configuration[$"{section}:Url"];
        var key = builder.Configuration[$"{section}:Key"];
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(key)) return; // Gateway จะตอบ 503 ว่ายังไม่ได้ตั้งค่า
        http.BaseAddress = new Uri(url.TrimEnd('/') + "/rest/v1/");
        http.DefaultRequestHeaders.Add("apikey", key);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", key);
        http.Timeout = TimeSpan.FromSeconds(15);
    });
}

// Gateway — เขียน Sales Order เข้า SAP (API_SALES_ORDER_SRV)
// Sandbox → SAP DEV ตอนนี้ (ภายหลังย้ายเป็น UAT): Sap:Url / Sap:User / Sap:Password, Production → Sap:Production:Url / User / Password
// ค่าองค์กรที่เติมให้ทุก SO: Sap[:Production]:SalesOrderType (ค่าเริ่มต้น OR), SalesOrganization, DistributionChannel, OrganizationDivision, RejectionReason
builder.Services.AddScoped<GatewayIdempotency>();
builder.Services.AddScoped<SapSalesOrderClient>();
// SAP API_SALES_ORDER_SRV ครบทุก operation ที่ /api/v1/sales/sap/* (passthrough) ใช้ HttpClient / credential ชุดเดียวกัน
// Gateway:Sap:EnableApprove = true เพื่อเปิด releaseApprovalRequest / rejectApprovalRequest (ค่าเริ่มต้นปิด)
builder.Services.AddScoped<SapODataProxy>();

// Gateway — Zoho CRM (Deals / Quotes / Sales_Orders) ที่ /api/v1/sales/zoho/*
// Sandbox token → ZohoConfig:sandbox, Production token → ZohoConfig:prod (ClientId, ClientSecret, RefreshToken, AccountsUrl, ApiDomain)
builder.Services.AddSingleton<ZohoTokenStore>();
builder.Services.AddScoped<ZohoCrmClient>();
builder.Services.AddHttpClient(ZohoCrmClient.HttpClientName, http => http.Timeout = TimeSpan.FromSeconds(30));
foreach (var env in new[] { CredEnv.Sandbox, CredEnv.Production })
{
    var section = SapSalesOrderClient.ConfigSection(env);
    builder.Services.AddHttpClient(SapSalesOrderClient.HttpClientName(env), http =>
    {
        var url = builder.Configuration[$"{section}:Url"];
        var user = builder.Configuration[$"{section}:User"];
        var password = builder.Configuration[$"{section}:Password"];
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password)) return; // Gateway จะตอบ 503 ว่ายังไม่ได้ตั้งค่า
        // รับได้ทั้ง host ของ tenant (https://myXXXXXX-api.s4hana.cloud.sap) และ URL เต็มของ service
        var root = url.Trim().TrimEnd('/');
        http.BaseAddress = new Uri(root.Contains("/sap/opu/odata/", StringComparison.OrdinalIgnoreCase) ? root + "/" : root + "/" + SapSalesOrderClient.ServicePath);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{user}:{password}")));
        http.Timeout = TimeSpan.FromSeconds(30);
    })
    // cookie ของ session SAP ต้องผูกกับ x-csrf-token ของคำขอนั้น จึงจัดการเองต่อคำขอ ไม่ใช้ cookie container ร่วม
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { UseCookies = false });
}

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured. Run 'dotnet user-secrets set Jwt:Key <value>'.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "mgt-portal",
            ValidateAudience = true,
            ValidAudience = "mgt-portal-client",
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        };
        opt.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<PortalDbContext>();
                var aborted = context.HttpContext.RequestAborted;
                try
                {
                    if (!await JwtSessionValidator.IsCurrentAsync(db, context.Principal, aborted, jwtKey))
                        context.Fail("Your account has changed. Sign in again.");
                }
                catch (OperationCanceledException) when (aborted.IsCancellationRequested)
                {
                    // เบราว์เซอร์ยกเลิกคำขอระหว่างตรวจ session (เปลี่ยนหน้า / refresh / React ยกเลิก fetch) — ไม่มีใครรอคำตอบแล้ว
                    // จบคำขอนี้เงียบ ๆ แทนการปล่อย exception ขึ้นไป (ซึ่งทำให้ Visual Studio หยุดที่ OperationCanceledException)
                    context.Fail("Request canceled by the client.");
                }
            }
        };
    });
builder.Services.AddAuthorization();

// ตอนพัฒนา หน้าเว็บ (Vite, พอร์ต 5174) เรียก /api ผ่าน proxy ของ Vite จึงเป็น origin เดียวกันอยู่แล้ว
// CORS นี้เผื่อกรณีเปิดหน้าเว็บตรงจากพอร์ตอื่นเท่านั้น
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5174", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Large base64 image payloads (logo/screenshots) need a larger request body limit than the 30MB default.
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = 50_000_000);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 50_000_000);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PortalDbContext>();
    db.Database.Migrate();

    // ข้อมูลตัวอย่างและรหัสผ่านทดสอบ — ใส่เฉพาะตอนพัฒนา ไม่ให้หลุดขึ้น production
    if (app.Environment.IsDevelopment())
    {
        DbSeeder.Seed(db);
        DbSeeder.SeedOrgStructure(db);
    }
    DbSeeder.BackfillUnassignedUsersToSeeAll(db);

    // การ์ด API Catalog ที่ฝังในโปรเจกต์ (Modules/Catalog/Seed) — ใส่เฉพาะใบที่ยังไม่มี ไม่ทับการ์ดที่ Admin แก้ในหน้าเว็บ
    // ถ้าพังไม่ให้ Portal เปิดไม่ขึ้น แค่ log ไว้
    try
    {
        var seeded = CatalogSeed.AddMissingFromResource(db, CatalogSeed.PurchaseResource);
        if (seeded.CategoryMissing)
            app.Logger.LogWarning("Catalog seed: ไม่พบหมวด {Category} ใน ApiCategories — ข้าม", seeded.Category);
        else
            app.Logger.LogInformation("Catalog seed {Category}: เพิ่ม {Added} ใบ, มีอยู่แล้ว {Existing} ใบ", seeded.Category, seeded.Added, seeded.Existing);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Catalog seed ล้มเหลว — Portal ทำงานต่อโดยไม่เติมการ์ด");
    }

    // token แยกตามหมวด API — แอปที่เคยได้ token เดียวจะได้ token ของหมวดที่เหลือเพิ่ม (ตัวเดิมยังใช้ได้กับหมวดของมัน)
    var workflow = scope.ServiceProvider.GetRequiredService<ApplicationWorkflow>();
    foreach (var a in db.Applications.Where(x => x.ProductsCsv != "").ToList())
        await workflow.SyncCredentialsAsync(a, "system");
    db.SaveChanges();
}

if (app.Environment.IsDevelopment())
{
    app.MapPortalSwagger(); // เปิด http://localhost:5038/swagger
}

app.UseCors("Frontend");

// หน้าเว็บ React ที่ build แล้ว (npm run build ใน src/Web) จะอยู่ใน wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseMiddleware<AuditFailureMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// URL ของหน้าเว็บ (เช่น /my-apps/5) ให้คืน index.html แล้วให้ React Router จัดการต่อ
// ส่วน /api/* ที่ไม่มีจริงยังคืน 404 ตามปกติ
app.MapFallback("/api/{**rest}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

app.Run();
