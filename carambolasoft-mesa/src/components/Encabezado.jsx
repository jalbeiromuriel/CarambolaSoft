// src/components/Encabezado.jsx — Logo + barra de secciones + usuario en turno. Lo no construido sale atenuado;
// el Empleado solo ve las secciones que le tocan (auth.js → seccionVisible).
import LogoBola9 from './LogoBola9.jsx';
import { SECCIONES } from '../cuenta/menu.js';
import { seccionVisible, esAdmin } from '../cuenta/auth.js';
import { useSesion } from './Sesion.jsx';

export default function Encabezado({ activo = 'panel', irPanel }) {
  const { usuario, irA, cerrarSesion } = useSesion();
  const rol = usuario?.Rol ?? null;
  const ir = (s) => (s.id === 'panel' && irPanel ? irPanel() : irA(s.id));
  return (
    <header className="pn-top">
      <LogoBola9 size={46} />
      <div>
        <div className="pn-t1">Mero Parche</div>
        <div className="pn-t2">Licores &amp; Billar · Sistema de Ventas</div>
      </div>
      <nav className="pn-nav" aria-label="Secciones">
        {SECCIONES.filter((s) => !usuario || seccionVisible(s.id, rol)).map((s) => (
          <button key={s.id} className={`${s.id === activo ? 'on' : ''} ${s.listo ? '' : 'off'}`} disabled={!s.listo}
            title={s.listo ? '' : `Próximamente · Fase ${s.fase}`} onClick={() => ir(s)}>{s.t}</button>
        ))}
        {usuario && (
          <button className={`pn-who ${esAdmin(rol) ? '' : 'emp'}`} onClick={cerrarSesion} title="Cambiar de usuario">
            {esAdmin(rol) ? '👑' : '🧑'} {usuario.Nombre} · Salir
          </button>
        )}
      </nav>
    </header>
  );
}
