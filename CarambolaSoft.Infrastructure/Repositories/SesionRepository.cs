using CarambolaSoft.Application.Interfaces;
using CarambolaSoft.Application.Sesiones.Commands.AbrirSesion;
using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;
using CarambolaSoft.Infrastructure.Persistence;
using CarambolaSoft.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarambolaSoft.Infrastructure.Repositories;

public class SesionRepository : ISesionRepository
{
    private readonly CarambolaSoftDbContext _context;

    public SesionRepository(CarambolaSoftDbContext context)
    {
        _context = context;
    }

    public async Task<AbrirSesionResponse> AbrirSesionAsync(AbrirSesionCommand command)
    {
        // Obtener mesa
        var mesa = await _context.MesasBillars
            .FirstOrDefaultAsync(m => m.Id == command.MesaId)
            ?? throw new InvalidOperationException("Mesa no encontrada.");

        if (mesa.Estado != "DISPONIBLE")
            throw new InvalidOperationException($"La mesa #{mesa.Numero} no está disponible.");

        // Obtener turno de caja abierto
        var turno = await _context.TurnosCajas
            .FirstOrDefaultAsync(t => t.FechaCierre == null)
            ?? throw new InvalidOperationException("No hay un turno de caja abierto. Abra un turno antes de iniciar una partida.");

        // Validar jugadores
        var jugadores = await _context.Jugadores
            .Where(j => command.JugadorIds.Contains(j.Id))
            .ToListAsync();

        if (jugadores.Count != command.JugadorIds.Count)
            throw new InvalidOperationException("Uno o más jugadores no existen en el sistema.");

        // Crear sesión
        var sesion = new SesionesMesa
        {
            Id = Guid.NewGuid(),
            MesaId = mesa.Id,
            TurnoCajaId = turno.Id,
            HoraInicio = DateTime.Now,
            TarifaPorHora = mesa.TarifaPorHora,
            EsSincronizado = false,
            UltimaModificacion = DateTime.Now
        };

        _context.SesionesMesas.Add(sesion);

        // Crear participantes
        var participantes = jugadores.Select(j => new Participante
        {
            Id = Guid.NewGuid(),
            SesionMesaId = sesion.Id,
            JugadorId = j.Id,
            Puntaje = 0,
            EsGanador = false
        }).ToList();

        _context.Participantes.AddRange(participantes);

        // Cambiar estado mesa
        mesa.Estado = "OCUPADA";
        mesa.EsSincronizado = false;
        mesa.UltimaModificacion = DateTime.Now;

        await _context.SaveChangesAsync();

        return new AbrirSesionResponse
        {
            SesionId = sesion.Id,
            NumeroMesa = mesa.Numero,
            TipoMesa = mesa.Tipo,
            TarifaPorHora = sesion.TarifaPorHora,
            HoraInicio = sesion.HoraInicio,
            Participantes = participantes.Select(p => new ParticipanteResponse
            {
                ParticipanteId = p.Id,
                JugadorId = p.JugadorId,
                Username = jugadores.First(j => j.Id == p.JugadorId).Username
            }).ToList()
        };
    }
    public async Task<SesionActivaResponse?> ObtenerSesionActivaAsync(Guid mesaId)
    {
        var sesion = await _context.SesionesMesas
            .Include(s => s.Mesa)
            .Include(s => s.Participantes)
                .ThenInclude(p => p.Jugador)
            .FirstOrDefaultAsync(s => s.MesaId == mesaId && s.HoraFin == null);

        if (sesion == null) return null;

        var minutosTranscurridos = (DateTime.Now - sesion.HoraInicio).TotalMinutes;
        var costoAcumulado = (decimal)(minutosTranscurridos / 60) * sesion.TarifaPorHora;

        return new SesionActivaResponse
        {
            SesionId = sesion.Id,
            NumeroMesa = sesion.Mesa.Numero,
            TipoMesa = sesion.Mesa.Tipo,
            TarifaPorHora = sesion.TarifaPorHora,
            HoraInicio = sesion.HoraInicio,
            MinutosTranscurridos = Math.Round(minutosTranscurridos, 2),
            CostoAcumulado = Math.Round(costoAcumulado, 2),
            Participantes = sesion.Participantes.Select(p => new ParticipanteResponse
            {
                ParticipanteId = p.Id,
                JugadorId = p.JugadorId,
                Username = p.Jugador.Username
            }).ToList()
        };
    }
}