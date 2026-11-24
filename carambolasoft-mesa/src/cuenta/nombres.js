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
