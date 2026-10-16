using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MGT.Portal.Api.Infrastructure.Persistence;
using MGT.Portal.Api.Modules.Access;
using MGT.Portal.Api.Modules.Apps;
using MGT.Portal.Api.Modules.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<PortalDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// ---- Modules ----
// Identity
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<DataBoundaryResolver>();
// Access — เพิ่ม scope จาก AccessGrant ให้ Identity ตอนสร้างข้อมูลผู้ใช้
builder.Services.AddScoped<IUserScopeProvider, GrantedScopeProvider>();
// Apps — กติกาการอนุมัติตาม Tier
builder.Services.AddScoped<ApplicationWorkflow>();
// Catalog — ตอนนี้มีแค่ controller ไม่มี service ที่ต้องลงทะเบียน

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
    });
builder.Services.AddAuthorization();

// ตอนพัฒนา หน้าเว็บ (Vite, พอร์ต 5173) เรียก /api ผ่าน proxy ของ Vite จึงเป็น origin เดียวกันอยู่แล้ว
// CORS นี้เผื่อกรณีเปิดหน้าเว็บตรงจากพอร์ตอื่นเท่านั้น
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
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
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");

// หน้าเว็บ React ที่ build แล้ว (npm run build ใน src/Web) จะอยู่ใน wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// URL ของหน้าเว็บ (เช่น /my-apps/5) ให้คืน index.html แล้วให้ React Router จัดการต่อ
// ส่วน /api/* ที่ไม่มีจริงยังคืน 404 ตามปกติ
app.MapFallback("/api/{**rest}", () => Results.NotFound());
app.MapFallbackToFile("index.html");

app.Run();
