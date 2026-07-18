//using CarambolaSoft.Application.Interfaces;
//using CarambolaSoft.Application.Sesiones.Commands.AbrirSesion;
//using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;

//namespace CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;

//public class AbrirSesionHandler
//{
//    private readonly ISesionRepository _repository;

//    public AbrirSesionHandler(ISesionRepository repository)
//    {
//        _repository = repository;
//    }

//    public async Task<AbrirSesionResponse> HandleAsync(AbrirSesionCommand command)
//    {
//        if (command.JugadorIds.Count < 2 || command.JugadorIds.Count > 4)
//            throw new InvalidOperationException("Una partida requiere entre 2 y 4 jugadores.");

//        if (command.JugadorIds.Distinct().Count() != command.JugadorIds.Count)
//            throw new InvalidOperationException("No se permiten jugadores duplicados en la misma partida.");

//        return await _repository.AbrirSesionAsync(command);
//    }
//}