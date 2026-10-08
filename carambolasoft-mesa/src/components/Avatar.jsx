// src/components/Avatar.jsx — Círculo con iniciales: dorado = Admin, azul = Empleado.
import { esAdmin } from '../cuenta/auth.js';

export const iniciales = (nombre = '') => {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] ?? '?').slice(0, 2)).toUpperCase();
};

export default function Avatar({ nombre, rol, grande = false }) {
  return <span className={`av ${esAdmin(rol) ? '' : 'e'} ${grande ? 'g' : ''}`} aria-hidden="true">{iniciales(nombre)}</span>;
}
