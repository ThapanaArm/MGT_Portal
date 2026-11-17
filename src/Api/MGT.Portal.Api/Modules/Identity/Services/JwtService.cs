using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace MGT.Portal.Api.Modules.Identity;

public class JwtService(IConfiguration config)
{
    public static string CredentialStamp(string passwordHash, string signingKey) =>
        Convert.ToHexString(System.Security.Cryptography.HMACSHA256.HashData(Encoding.UTF8.GetBytes(signingKey), Encoding.UTF8.GetBytes(passwordHash)));

    public string CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, string.IsNullOrWhiteSpace(user.DisplayName) ? user.Email : user.DisplayName),
            new(ClaimTypes.Role, user.Role.Key),
            new("credential_stamp", CredentialStamp(user.PasswordHash, config["Jwt:Key"]!)),
        };

        var token = new JwtSecurityToken(
            issuer: "mgt-portal",
            audience: "mgt-portal-client",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
