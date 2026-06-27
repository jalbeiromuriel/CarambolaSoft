// 1. Agrega el namespace de tu proyecto de infraestructura arriba del todo
using Microsoft.EntityFrameworkCore;
using CarambolaSoft.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

// Registrar el DbContext leyendo la conexión desde el archivo de configuración
builder.Services.AddDbContext<CarambolaSoftDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
