using CarambolaSoft.Application.Interfaces;
using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;
using CarambolaSoft.Application.UseCases.Sesiones.Queries;
using CarambolaSoft.Infrastructure.Persistence;
using CarambolaSoft.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;



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


builder.Services.AddScoped<ISesionRepository, SesionRepository>();
builder.Services.AddScoped<AbrirSesionHandler>();

builder.Services.AddScoped<ObtenerSesionActivaHandler>();
// ── Pipeline ─────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.Run();