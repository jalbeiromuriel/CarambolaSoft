using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CarambolaSoft.API.Dtos;
using CarambolaSoft.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CarambolaSoft.API.Controllers;

/// <summary>
/// Login del API: usuario + PIN → token (JWT) de corta vida. Mismas reglas que la app:
/// PIN de 4 a 6 dígitos, 5 intentos fallidos = bloqueo de 5 minutos.
/// Siempre responde igual ante usuario inexistente o PIN errado (no revela qué usuarios existen).
/// </summary>
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthController(CarambolaSoftDbContext db, IConfiguration cfg, ILogger<AuthController> log) : ControllerBase
{
    private const int MaxIntentos = 5;
    private static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(5);

    /// Hash compatible con la app: 'S256:' + SHA-256 hex minúscula de "{salt}:{pin}".
    internal static string HashPin(string salt, string pin)
        => "S256:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{salt}:{pin}"))).ToLowerInvariant();

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var rechazo = Unauthorized(new { error = "Usuario o PIN incorrectos." });
        if (string.IsNullOrWhiteSpace(dto.Usuario) || dto.Pin is null || dto.Pin.Length is < 4 or > 6 || !dto.Pin.All(char.IsAsciiDigit))
            return rechazo;

        var nombre = dto.Usuario.Trim();
        var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Nombre == nombre && x.Activo);
        if (u is null) { log.LogWarning("Login: usuario inexistente o inactivo ({Usuario})", nombre); return rechazo; }

        if (u.BloqueadoHasta is { } hasta && hasta > DateTime.Now)
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { error = $"Usuario bloqueado. Intenta de nuevo en {Math.Ceiling((hasta - DateTime.Now).TotalMinutes)} min." });

        var esperado = Encoding.UTF8.GetBytes(u.PinHash);
        var recibido = Encoding.UTF8.GetBytes(HashPin(u.Salt, dto.Pin));
        if (!CryptographicOperations.FixedTimeEquals(esperado, recibido))
        {
            u.Intentos++;
            if (u.Intentos >= MaxIntentos) { u.Intentos = 0; u.BloqueadoHasta = DateTime.Now.Add(Bloqueo); }
            u.UltimaModificacion = DateTime.Now;
            await db.SaveChangesAsync();
            log.LogWarning("Login: PIN errado para {Usuario}", nombre);
            return rechazo;
        }

        u.Intentos = 0; u.BloqueadoHasta = null; u.UltimoLogin = DateTime.Now; u.UltimaModificacion = DateTime.Now;
        await db.SaveChangesAsync();

        var clave = cfg["Jwt:Key"];
        if (string.IsNullOrEmpty(clave) || clave.Length < 32)
            return StatusCode(500, new { error = "El servidor no tiene configurada la clave del token (Jwt:Key)." });

        var horas = cfg.GetValue("Jwt:HorasVigencia", 12);
        var vence = DateTime.UtcNow.AddHours(horas);
        var token = new JwtSecurityToken(
            issuer: cfg["Jwt:Issuer"] ?? "CarambolaSoft",
            audience: cfg["Jwt:Audience"] ?? "CarambolaSoft.Tablets",
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, u.Id.ToString()),
                new Claim(ClaimTypes.Name, u.Nombre),
                new Claim(ClaimTypes.Role, u.Rol),
            },
            expires: vence,
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(clave)), SecurityAlgorithms.HmacSha256));

        return Ok(new LoginRespuestaDto(new JwtSecurityTokenHandler().WriteToken(token), vence, u.Id, u.Nombre, u.Rol));
    }
}
