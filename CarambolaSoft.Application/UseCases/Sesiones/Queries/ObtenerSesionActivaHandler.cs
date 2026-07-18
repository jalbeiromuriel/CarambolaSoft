//using CarambolaSoft.Application.Interfaces;
//using CarambolaSoft.Application.Sesiones.Commands.AbrirSesion;
//using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;

//namespace CarambolaSoft.Application.UseCases.Sesiones.Queries;

//public class ObtenerSesionActivaHandler
//{
//    private readonly ISesionRepository _repository;

//    public ObtenerSesionActivaHandler(ISesionRepository repository)
//    {
//        _repository = repository;
//    }

//    public async Task<SesionActivaResponse?> HandleAsync(Guid mesaId)
//    {
//        return await _repository.ObtenerSesionActivaAsync(mesaId);
//    }
//}