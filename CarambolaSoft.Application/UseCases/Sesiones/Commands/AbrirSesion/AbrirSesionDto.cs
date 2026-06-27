namespace CarambolaSoft.Application.Sesiones.Commands.AbrirSesion;

public class AbrirSesionRequest
{
    public Guid MesaId { get; set; }
    public List<Guid> JugadorIds { get; set; } = new();
}

public class AbrirSesionResponse
{
    public Guid SesionId { get; set; }
    public int NumeroMesa { get; set; }
    public string TipoMesa { get; set; } = null!;
    public decimal TarifaPorHora { get; set; }
    public DateTime HoraInicio { get; set; }
    public List<ParticipanteResponse> Participantes { get; set; } = new();
}

public class ParticipanteResponse
{
    public Guid ParticipanteId { get; set; }
    public Guid JugadorId { get; set; }
    public string Username { get; set; } = null!;
}

public class SesionActivaResponse
{
    public Guid SesionId { get; set; }
    public int NumeroMesa { get; set; }
    public string TipoMesa { get; set; } = null!;
    public decimal TarifaPorHora { get; set; }
    public DateTime HoraInicio { get; set; }
    public double MinutosTranscurridos { get; set; }
    public decimal CostoAcumulado { get; set; }
    public List<ParticipanteResponse> Participantes { get; set; } = new();
}