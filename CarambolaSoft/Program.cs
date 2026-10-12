using CarambolaSoft.Application.Interfaces;
using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;
//using CarambolaSoft.Application.UseCases.Sesiones.Queries;
using CarambolaSoft.Infrastructure.Persistence;
using CarambolaSoft.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;



var builder = WebApplication.CreateBuilder(args);

// ── DbContext ────────────────────────────────────────────────
builder.Services.AddDbContext<CarambolaSoftDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Autenticación: token (JWT) que entrega /api/auth/login ───
// La clave sale de la configuración (user-secrets / variable de entorno Jwt__Key), NUNCA del repositorio.
var jwtKey = builder.Configuration["Jwt:Key"];
if (!string.IsNullOrEmpty(jwtKey) && jwtKey.Length >= 32)
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "CarambolaSoft",
                ValidateAudience = true, ValidAudience = builder.Configuration["Jwt:Audience"] ?? "CarambolaSoft.Tablets",
                ValidateLifetime = true, ClockSkew = TimeSpan.FromMinutes(1),
                ValidateIssuerSigningKey = true, IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                RoleClaimType = System.Security.Claims.ClaimTypes.Role, NameClaimType = System.Security.Claims.ClaimTypes.Name,
            };
        });
}
else
{
    // Sin clave configurada el API arranca, pero rechaza todo lo protegido (401) en vez de quedar abierto.
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
}
// Todo endpoint exige sesión salvo los marcados [AllowAnonymous] (el login).
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// ── Controllers + OpenAPI ────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ── CORS: permitir que la tablet (Vite :5173) le pegue al API ──
builder.Services.AddCors(options =>
{
    // Orígenes permitidos: localhost en desarrollo + los de la sección Cors:Origins (la URL de la app en producción).
    var origenes = new List<string> { "http://localhost:5173" };
    origenes.AddRange(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? []);
    options.AddPolicy("TabletDev", policy =>
        policy.WithOrigins(origenes.ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// ── Infrastructure — Repositorios ───────────────────────────
builder.Services.AddScoped<CarambolaSoft.Application.Interfaces.IMesaRepository, CarambolaSoft.Infrastructure.Repositories.MesaRepository>();

// ── Application — Use Cases (Mesas) ─────────────────────────
builder.Services.AddScoped<CarambolaSoft.Application.UseCases.Mesas.ObtenerMesasUseCase>();
builder.Services.AddScoped<CarambolaSoft.Application.UseCases.Mesas.ObtenerMesaPorIdUseCase>();
builder.Services.AddScoped<CarambolaSoft.Application.UseCases.Mesas.CambiarEstadoMesaUseCase>();


//builder.Services.AddScoped<ISesionRepository, SesionRepository>();
//builder.Services.AddScoped<AbrirSesionHandler>();

//builder.Services.AddScoped<ObtenerSesionActivaHandler>();
// ── Pipeline ─────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // La documentación/pruebas (Scalar) quedan abiertas SOLO en desarrollo; los endpoints siguen protegidos.
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

app.UseHttpsRedirection();
app.UseCors("TabletDev");   // ← va ANTES de Authorization y MapControllers
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();