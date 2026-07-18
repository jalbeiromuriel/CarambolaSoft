//using CarambolaSoft.Application.Sesiones.Commands.AbrirSesion;
//using CarambolaSoft.Application.UseCases.Sesiones.Commands.AbrirSesion;
//using CarambolaSoft.Application.UseCases.Sesiones.Queries;
//using Microsoft.AspNetCore.Mvc;

//namespace CarambolaSoft.API.Controllers;

//[ApiController]
//[Route("api/sesiones")]
//public class SesionesController : ControllerBase
//{
//    private readonly AbrirSesionHandler _abrirSesionHandler;
//    private readonly ObtenerSesionActivaHandler _obtenerSesionActivaHandler;

//    public SesionesController(
//        AbrirSesionHandler abrirSesionHandler,
//        ObtenerSesionActivaHandler obtenerSesionActivaHandler)
//    {
//        _abrirSesionHandler = abrirSesionHandler;
//        _obtenerSesionActivaHandler = obtenerSesionActivaHandler;
//    }

//    // POST /api/sesiones
//    [HttpPost]
//    public async Task<IActionResult> AbrirSesion([FromBody] AbrirSesionRequest request)
//    {
//        try
//        {
//            var command = new AbrirSesionCommand
//            {
//                MesaId = request.MesaId,
//                JugadorIds = request.JugadorIds
//            };

//            var response = await _abrirSesionHandler.HandleAsync(command);
//            return CreatedAtAction(nameof(AbrirSesion), new { id = response.SesionId }, response);
//        }
//        catch (InvalidOperationException ex)
//        {
//            return BadRequest(new { error = ex.Message });
//        }
//    }

//    // GET /api/sesiones/activa/{mesaId}
//    [HttpGet("activa/{mesaId:guid}")]
//    public async Task<IActionResult> ObtenerSesionActiva(Guid mesaId)
//    {
//        var sesion = await _obtenerSesionActivaHandler.HandleAsync(mesaId);

//        if (sesion == null)
//            return NotFound(new { error = "No hay sesión activa en esta mesa." });

//        return Ok(sesion);
//    }
//}