namespace MGT.Portal.Api.Dtos;

public record CategoryDto(int Id, string Key, string Name, string BasePath, string Description, string RateLimit, int EndpointCount);

public record EndpointDto(
    int Id, int CategoryId, string Method, string Path, string Summary, string Description, string Scope,
    string Icon, string Scenario,
    List<List<string>> Params, string? ReqBody, string RespExample, List<List<string>> RespFields);

public record UpsertEndpointRequest(
    string Method, string Path, string Summary, string Description, string Scope, string? RespExample,
    string? Icon, string? Scenario);
