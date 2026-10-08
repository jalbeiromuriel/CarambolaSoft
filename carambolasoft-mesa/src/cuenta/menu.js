// src/cuenta/menu.js — Secciones de la barra superior. `fase` = cuándo se construye; `rol` = quién la abre sin PIN (login por PIN: siguiente PR).
export const SECCIONES = [
  { id: 'panel',        t: 'Panel',        listo: true },
  { id: 'inventario',   t: 'Inventario',   listo: false, fase: 3, soloPatrona: true },
  { id: 'clientes',     t: 'Clientes',     listo: false, fase: 2 },
  { id: 'caja',         t: 'Caja',         listo: false, fase: 4, soloPatrona: true },
  { id: 'maquinas',     t: 'Máquinas',     listo: false, fase: 4, soloPatrona: true },
  { id: 'estadisticas', t: 'Estadísticas', listo: false, fase: 4, soloPatrona: true },
  { id: 'adm',          t: 'Adm ⚙',        listo: false, fase: 5, soloPatrona: true },
];

/** Candado: solo cuando la sección ya existe y el usuario en turno es Empleado. Sin login todavía → nunca. */
export const bloqueada = (sec, rol) => !!sec.soloPatrona && rol === 'EMPLEADO';
