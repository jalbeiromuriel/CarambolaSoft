namespace CarambolaSoft.API.Dtos;

public record LoginDto(string Usuario, string Pin);

public record LoginRespuestaDto(string Token, DateTime Vence, Guid UsuarioId, string Nombre, string Rol);
