using Microsoft.EntityFrameworkCore;
using CarambolaSoft.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// ── DbContext ────────────────────────────────────────────────
builder.Services.AddDbContext<CarambolaSoftDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Controllers + OpenAPI ────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ── Infrastructure — Repositorios ───────────────────────────
builder.Services.AddScoped<CarambolaSoft.Application.Interfaces.IMesaRepository, CarambolaSoft.Infrastructure.Repositories.MesaRepository>();

// ── Application — Use Cases (Mesas) ─────────────────────────
builder.Services.AddScoped<CarambolaSoft.Application.UseCases.Mesas.ObtenerMesasUseCase>();
builder.Services.AddScoped<CarambolaSoft.Application.UseCases.Mesas.ObtenerMesaPorIdUseCase>();
builder.Services.AddScoped<CarambolaSoft.Application.UseCases.Mesas.CambiarEstadoMesaUseCase>();

// ── Pipeline ─────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.Run();