// src/cuenta/nombres.js — Cómo se llama una cuenta de cliente (funciones puras).
// Regla (Albeiro, 2026-11-24): se usa el PRIMER nombre y el apodo, no el nombre completo: «Luis «Chiqui»».
// Sin apodo: primer nombre + inicial del apellido («Luis A.») para que dos Luis no se confundan.
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function etiquetaCliente(c) {
  if (!c) return '';
  const partes = String(c.Nombre ?? '').trim().split(/\s+/).filter(Boolean);
  const primero = partes[0] ?? '';
  const apodo = String(c.Apodo ?? '').trim();
  if (!primero) return apodo;
  if (apodo && sinTildes(apodo) !== sinTildes(primero)) return `${primero} «${apodo}»`;
  return partes[1] ? `${primero} ${partes[1][0].toUpperCase()}.` : primero;
}

/**
 * Antes de crear un cliente: ¿ya existe? Devuelve el mensaje para la barra o '' si se puede crear.
 * - Mismo nombre completo y mismo apodo (sin importar tildes ni mayúsculas) → es la misma persona.
 * - Distinto nombre pero se verían igual en la cuenta (mismo «Luis «Chiqui»») → hay que diferenciarlos con el apodo.
 */
export function duplicadoDe(clientes = [], { Nombre, Apodo }) {
  const nuevo = { Nombre: String(Nombre ?? '').trim(), Apodo: String(Apodo ?? '').trim() };
  const activos = clientes.filter((c) => c.Activo !== false);
  const igual = activos.find((c) => sinTildes(c.Nombre) === sinTildes(nuevo.Nombre) && sinTildes(c.Apodo) === sinTildes(nuevo.Apodo));
  if (igual) return `Ya existe ${etiquetaCliente(igual)}: búscalo en la lista y selecciónalo.`;
  const mismaEtiqueta = activos.find((c) => sinTildes(etiquetaCliente(c)) === sinTildes(etiquetaCliente(nuevo)));
  if (mismaEtiqueta) return `Ya hay un cliente que se ve como «${etiquetaCliente(mismaEtiqueta)}» (${mismaEtiqueta.Nombre}). Ponle un apodo distinto para no confundirlos.`;
  return '';
}

// ── Una cuenta abierta por cliente (Albeiro, 2026-11-24)
// Licores y garita cuentan juntas: máximo UNA abierta entre las dos.
// Billar va aparte (máximo una): el que juega puede tener la cuenta del chico y además una de licores para invitar.
// Venta rápida no cuenta (se paga en el momento). Los nombres libres no se pueden revisar.
const ambito = (tipo) => (tipo === 'BILLAR' ? 'BILLAR' : tipo === 'VENTA_RAPIDA' ? null : 'LICOR');
const lugarDe = (c) => (c.TipoCuenta === 'BILLAR' ? 'el billar' : c.TipoCuenta === 'GARITA' ? 'la garita' : 'una mesa de licores');

/** La cuenta abierta que ya tiene este cliente en el mismo ámbito (o null). */
export function cuentaQueChoca(abiertas = [], clienteId, tipo, excluirId = null) {
  const a = ambito(tipo);
  if (!clienteId || !a) return null;
  return abiertas.find((c) => c.Estado !== 'LIQUIDADA' && c.Estado !== 'CANCELADA' && c.Id !== excluirId && c.ClienteId === clienteId && ambito(c.TipoCuenta) === a) ?? null;
}

/**
 * Antes de abrir cuentas para varias personas: { error, cuenta } del primer choque, o { error: '' }.
 * También avisa si el mismo cliente viene dos veces en la misma lista.
 */
export function revisarAperturas(abiertas = [], personas = [], tipo) {
  const vistos = new Set();
  for (const p of personas) {
    const id = p.cliente?.Id;
    if (!id) continue;
    if (vistos.has(id)) return { error: `${p.etiqueta} está dos veces en la lista.`, cuenta: null };
    vistos.add(id);
    const c = cuentaQueChoca(abiertas, id, tipo);
    if (c) return { error: `${p.etiqueta} ya tiene cuenta abierta en ${lugarDe(c)} (${c.NombreLibre}). Cóbrale o pásale el saldo antes de abrirle otra.`, cuenta: c };
  }
  return { error: '', cuenta: null };
}
