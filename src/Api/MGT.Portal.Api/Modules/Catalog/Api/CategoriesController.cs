using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Infrastructure.Persistence;

namespace MGT.Portal.Api.Modules.Catalog;

[ApiController]
[Route("api/categories")]
[Authorize]
public class CategoriesController(PortalDbContext db) : ControllerBase
{
    private static EndpointDto ToDto(ApiEndpoint e) => new(
        e.Id, e.CategoryId, e.Method, e.Path, e.Summary, e.Description, e.Scope, e.Icon, e.Scenario,
        JsonHelpers.ParseRows(e.ParamsJson), e.ReqBody, e.RespExample, JsonHelpers.ParseRows(e.RespFieldsJson), e.SourcePlatform);

    private static string DefaultIcon(string method) => method switch
    {
        "GET" => "fa:search",
        "POST" => "fa:plus",
        "PUT" or "PATCH" => "fa:rotate",
        "DELETE" => "fa:trash",
        _ => "fa:clipboard",
    };

    private static CategoryDto CategoryToDto(ApiCategory c, int endpointCount) =>
        new(c.Id, c.Key, c.Name, c.BasePath, c.Description, c.RateLimit, endpointCount, c.Icon);

    // Lowercase letter first, then lowercase letters, digits or "-" (it becomes the URL segment and the scope prefix).
    private static readonly Regex CategoryKey = new("^[a-z][a-z0-9-]{1,39}$", RegexOptions.Compiled);

    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> GetAll()
    {
        var cats = await db.ApiCategories.Include(c => c.Endpoints).OrderBy(c => c.Id).ToListAsync();
        return cats.Select(c => CategoryToDto(c, c.Endpoints.Count)).ToList();
    }

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<CategoryDto>> CreateCategory(UpsertCategoryRequest req)
    {
        var key = req.Key?.Trim().ToLowerInvariant() ?? "";
        if (!CategoryKey.IsMatch(key))
            return BadRequest(new { message = "Key must be 2-40 characters: lowercase letters, numbers or \"-\", starting with a letter" });
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length > 100)
            return BadRequest(new { message = "Enter a category name of up to 100 characters" });
        if (await db.ApiCategories.AnyAsync(c => c.Key == key))
            return Conflict(new { message = $"Category key \"{key}\" already exists" });

        var entity = new ApiCategory
        {
            Key = key,
            Name = req.Name.Trim(),
            BasePath = $"/api/v1/{key}",
            Description = req.Description?.Trim() ?? "",
            RateLimit = string.IsNullOrWhiteSpace(req.RateLimit) ? "60 requests / minute" : req.RateLimit.Trim(),
            Icon = string.IsNullOrWhiteSpace(req.Icon) ? "fa:box" : req.Icon.Trim(),
        };
        db.ApiCategories.Add(entity);
        await db.SaveChangesAsync();
        return CategoryToDto(entity, 0);
    }

    [HttpPut("{key}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<CategoryDto>> UpdateCategory(string key, UpsertCategoryRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length > 100)
            return BadRequest(new { message = "Enter a category name of up to 100 characters" });
        var entity = await db.ApiCategories.Include(c => c.Endpoints).FirstOrDefaultAsync(c => c.Key == key);
        if (entity is null) return NotFound();

        entity.Name = req.Name.Trim();
        if (req.Description is not null) entity.Description = req.Description.Trim();
        if (!string.IsNullOrWhiteSpace(req.RateLimit)) entity.RateLimit = req.RateLimit.Trim();
        if (!string.IsNullOrWhiteSpace(req.Icon)) entity.Icon = req.Icon.Trim();
        await db.SaveChangesAsync();
        return CategoryToDto(entity, entity.Endpoints.Count);
    }

    /// <summary>Only an empty category can be deleted, so no API card is removed by accident.</summary>
    [HttpDelete("{key}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteCategory(string key)
    {
        var entity = await db.ApiCategories.Include(c => c.Endpoints).FirstOrDefaultAsync(c => c.Key == key);
        if (entity is null) return NotFound();
        if (entity.Endpoints.Count > 0)
            return Conflict(new { message = "Delete or move every API in this category before deleting it" });
        db.ApiCategories.Remove(entity);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // Another table still points at this category (for example an access grant given to a user).
            return Conflict(new { message = "This category is still used by access grants. Revoke them before deleting the category" });
        }
        return NoContent();
    }

    [HttpGet("{key}/endpoints")]
    public async Task<ActionResult<List<EndpointDto>>> GetEndpoints(string key)
    {
        var cat = await db.ApiCategories.Include(c => c.Endpoints).FirstOrDefaultAsync(c => c.Key == key);
        if (cat is null) return NotFound();
        return cat.Endpoints.Select(ToDto).ToList();
    }

    /// <summary>All endpoints across every category, for the cross-category discovery/search page.</summary>
    [HttpGet("endpoints")]
    public async Task<ActionResult<List<EndpointDto>>> GetAllEndpoints()
    {
        var endpoints = await db.ApiEndpoints.ToListAsync();
        return endpoints.Select(ToDto).ToList();
    }

    [HttpPost("{key}/endpoints")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<EndpointDto>> CreateEndpoint(string key, UpsertEndpointRequest req)
    {
        if (req.SourcePlatform?.Length > 100) return BadRequest(new { message = "Source platform must be 100 characters or fewer" });
        var cat = await db.ApiCategories.FirstOrDefaultAsync(c => c.Key == key);
        if (cat is null) return NotFound();

        var path = req.Path.StartsWith('/') ? req.Path : "/" + req.Path;
        var entity = new ApiEndpoint
        {
            CategoryId = cat.Id,
            Method = req.Method,
            Path = path,
            Summary = req.Summary,
            Description = req.Description,
            Scope = req.Scope,
            SourcePlatform = req.SourcePlatform?.Trim() ?? "",
            Icon = string.IsNullOrWhiteSpace(req.Icon) ? DefaultIcon(req.Method) : req.Icon,
            Scenario = req.Scenario ?? "",
            ParamsJson = "[]",
            RespExample = string.IsNullOrWhiteSpace(req.RespExample) ? "{}" : req.RespExample,
            RespFieldsJson = "[]",
        };
        db.ApiEndpoints.Add(entity);
        await db.SaveChangesAsync();
        return ToDto(entity);
    }

    [HttpPut("endpoints/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<EndpointDto>> UpdateEndpoint(int id, UpsertEndpointRequest req)
    {
        if (req.SourcePlatform?.Length > 100) return BadRequest(new { message = "Source platform must be 100 characters or fewer" });
        var entity = await db.ApiEndpoints.FindAsync(id);
        if (entity is null) return NotFound();

        entity.Method = req.Method;
        entity.Path = req.Path.StartsWith('/') ? req.Path : "/" + req.Path;
        entity.Summary = req.Summary;
        entity.Description = req.Description;
        entity.Scope = req.Scope;
        if (req.SourcePlatform is not null) entity.SourcePlatform = req.SourcePlatform.Trim();
        if (!string.IsNullOrWhiteSpace(req.Icon)) entity.Icon = req.Icon;
        if (req.Scenario is not null) entity.Scenario = req.Scenario;
        if (!string.IsNullOrWhiteSpace(req.RespExample)) entity.RespExample = req.RespExample;

        await db.SaveChangesAsync();
        return ToDto(entity);
    }

    [HttpDelete("endpoints/{id:int}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteEndpoint(int id)
    {
        var entity = await db.ApiEndpoints.FindAsync(id);
        if (entity is null) return NotFound();
        db.ApiEndpoints.Remove(entity);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
