using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MGT.Portal.Api.Data;
using MGT.Portal.Api.Dtos;
using MGT.Portal.Api.Models;
using MGT.Portal.Api.Services;

namespace MGT.Portal.Api.Controllers;

[ApiController]
[Route("api/categories")]
[Authorize]
public class CategoriesController(PortalDbContext db) : ControllerBase
{
    private static EndpointDto ToDto(ApiEndpoint e) => new(
        e.Id, e.CategoryId, e.Method, e.Path, e.Summary, e.Description, e.Scope, e.Icon, e.Scenario,
        JsonHelpers.ParseRows(e.ParamsJson), e.ReqBody, e.RespExample, JsonHelpers.ParseRows(e.RespFieldsJson));

    private static string DefaultIcon(string method) => method switch
    {
        "GET" => "🔍",
        "POST" => "➕",
        "PUT" or "PATCH" => "🔄",
        "DELETE" => "🗑️",
        _ => "📋",
    };

    [HttpGet]
    public async Task<ActionResult<List<CategoryDto>>> GetAll()
    {
        var cats = await db.ApiCategories.Include(c => c.Endpoints).ToListAsync();
        return cats.Select(c => new CategoryDto(c.Id, c.Key, c.Name, c.BasePath, c.Description, c.RateLimit, c.Endpoints.Count)).ToList();
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
        var entity = await db.ApiEndpoints.FindAsync(id);
        if (entity is null) return NotFound();

        entity.Method = req.Method;
        entity.Path = req.Path.StartsWith('/') ? req.Path : "/" + req.Path;
        entity.Summary = req.Summary;
        entity.Description = req.Description;
        entity.Scope = req.Scope;
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
