// src/cuenta/garita.js — Garita: un reloj compartido, cada persona paga $1.000 por hora.
// Cobra al entrar y en cada aviso (a los 55 min de cada hora). Lógica pura, sin IndexedDB.
export const HORA_MS = 3600000;
export const AVISO_MS = 5 * 60000;          // el aviso salta 5 min antes de cumplir la hora
export const NUEVO_MS = 10 * 60000;         // quien entró hace menos de esto no se marca por defecto
export const VALOR_HORA = 1000;
export const PRODUCTO_LIBRE_ID = '00000000-0000-0000-0000-000000000202'; // "Venta libre": ítem sin producto en venta rápida
export const PRODUCTO_GARITA_ID = '00000000-0000-0000-0000-000000000201';

export function nuevoReloj(ahora = Date.now(), valor = VALOR_HORA) {
  return {
    Nombre: 'Garita', Valor: valor, InicioUtc: new Date(ahora).toISOString(),
    ProximoCobroUtc: new Date(ahora + HORA_MS).toISOString(), Cobros: 1, Activa: true,
  };
}

const t = (iso) => new Date(iso).getTime();

/** ms transcurridos del reloj, ms que faltan para el aviso (negativo = ya pasó) y si está en aviso. */
export function estadoReloj(reloj, ahora = Date.now()) {
  const faltaAviso = t(reloj.ProximoCobroUtc) - AVISO_MS - ahora;
  return { transcurrido: Math.max(0, ahora - t(reloj.InicioUtc)), faltaAviso, enAviso: faltaAviso <= 0 };
}

/** Pasa a la siguiente hora: una cobrada más y el próximo aviso 1 h después. */
export const avanzarReloj = (reloj) => ({
  ...reloj, Cobros: reloj.Cobros + 1, ProximoCobroUtc: new Date(t(reloj.ProximoCobroUtc) + HORA_MS).toISOString(),
});

/** Marca por defecto en el aviso: todos salvo los que acaban de llegar. */
export const marcadaPorDefecto = (cuenta, ahora = Date.now()) => ahora - t(cuenta.HoraApertura) >= NUEVO_MS;

export const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
