// src/cuenta/menu.js — Secciones de la barra superior. `fase` = cuándo se construye. Quién ve qué: auth.js → seccionVisible.
export const SECCIONES = [
  { id: 'panel',        t: 'Panel',        listo: true },
  { id: 'inventario',   t: 'Inventario',   listo: false, fase: 3 },
  { id: 'clientes',     t: 'Clientes',     listo: true },
  { id: 'caja',         t: 'Caja',         listo: false, fase: 4 },
  { id: 'maquinas',     t: 'Máquinas',     listo: false, fase: 4 },
  { id: 'estadisticas', t: 'Estadísticas', listo: false, fase: 4 },
  { id: 'adm',          t: 'Adm ⚙',        listo: true },
];
