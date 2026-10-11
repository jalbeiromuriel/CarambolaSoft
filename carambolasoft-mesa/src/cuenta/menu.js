// src/cuenta/menu.js — Secciones de la barra superior. `ic` = ícono de la pestaña. Quién ve qué: auth.js → seccionVisible.
// `adm` no es pestaña: se abre desde el menú del usuario (Encabezado.jsx).
export const SECCIONES = [
  { id: 'panel',        t: 'Panel',        ic: '🎱', listo: true },
  { id: 'inventario',   t: 'Inventario',   ic: '📦', listo: true },
  { id: 'clientes',     t: 'Clientes',     ic: '👥', listo: true },
  { id: 'caja',         t: 'Caja',         ic: '💵', listo: true },
  { id: 'maquinas',     t: 'Máquinas',     ic: '🎰', listo: true },
  { id: 'prestamos',    t: 'Préstamos',    ic: '🤝', listo: true },
  { id: 'estadisticas', t: 'Estadísticas', ic: '📊', listo: true },
  { id: 'config',       t: 'Ajustes', ic: '⚙️', listo: true },
  { id: 'adm',          t: 'Administración', ic: '⚙', listo: true, enMenu: true },
];
