namespace CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;

public class AbrirSesionCommand
{
    public Guid MesaId { get; set; }
    public List<Guid> JugadorIds { get; set; } = new();
}