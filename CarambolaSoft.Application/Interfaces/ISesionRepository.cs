using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;
using CarambolaSoft.Application.Sesiones.Commands.AbrirSesion;


namespace CarambolaSoft.Application.Interfaces;

public interface ISesionRepository
{
    Task<AbrirSesionResponse> AbrirSesionAsync(AbrirSesionCommand command);
    Task<SesionActivaResponse?> ObtenerSesionActivaAsync(Guid mesaId);

}