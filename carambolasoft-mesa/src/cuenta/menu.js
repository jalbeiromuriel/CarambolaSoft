// src/cuenta/menu.js — Secciones de la barra superior. `fase` = cuándo se construye. Quién ve qué: auth.js → seccionVisible.
export const SECCIONES = [
  { id: 'panel',        t: 'Panel',        listo: true },
  { id: 'inventario',   t: 'Inventario',   listo: true },
  { id: 'clientes',     t: 'Clientes',     listo: true },
  { id: 'caja',         t: 'Caja',         listo: true },
  { id: 'maquinas',     t: 'Máquinas',     listo: true },
  { id: 'estadisticas', t: 'Estadísticas', listo: false, fase: 4 },
  { id: 'adm',          t: 'Adm ⚙',        listo: true },
];
