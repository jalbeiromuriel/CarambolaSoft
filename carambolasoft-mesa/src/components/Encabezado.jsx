// src/components/Encabezado.jsx — Logo + pestañas de secciones + menú del usuario en turno. Lo no construido sale atenuado;
// el Empleado solo ve las secciones que le tocan (auth.js → seccionVisible). «Administración» vive en el menú del usuario.
import { useState, useEffect, useRef } from 'react';
import LogoBola9 from './LogoBola9.jsx';
import { SECCIONES } from '../cuenta/menu.js';
import { seccionVisible, esAdmin } from '../cuenta/auth.js';
import Avatar from './Avatar.jsx';
import { useSesion } from './Sesion.jsx';

export default function Encabezado({ activo = 'panel', irPanel }) {
  const { usuario, irA, cerrarSesion } = useSesion();
  const [menu, setMenu] = useState(false); const caja = useRef(null);
  const rol = usuario?.Rol ?? null;
  const ir = (s) => (s.id === 'panel' && irPanel ? irPanel() : irA(s.id));
  useEffect(() => {
    if (!menu) return undefined;
    const fuera = (e) => { if (!caja.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc); };
  }, [menu]);
  const visibles = SECCIONES.filter((s) => (!usuario || seccionVisible(s.id, rol)));
  return (
    <header className="pn-top">
      <div className="pn-logo"><LogoBola9 size={38} />
        <div><div className="pn-t1">Mero Parche</div><div className="pn-t2">Licores &amp; Billar</div></div></div>
      <nav className="pn-nav" aria-label="Secciones">
        {visibles.filter((s) => !s.enMenu).map((s) => (
          <button key={s.id} className={`${s.id === activo ? 'on' : ''} ${s.listo ? '' : 'off'}`} disabled={!s.listo}
            title={s.listo ? '' : `Próximamente · Fase ${s.fase}`} onClick={() => ir(s)}><i aria-hidden="true">{s.ic}</i><span>{s.t}</span></button>
        ))}
      </nav>
      {usuario && (
        <div className="pn-user" ref={caja}>
          <button className={`pn-who ${esAdmin(rol) ? '' : 'emp'}`} onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} title="Menú del usuario">
            <Avatar nombre={usuario.Nombre} rol={rol} /><span className="pn-who-n">{usuario.Nombre} ▾</span>
          </button>
          {menu && (
            <div className="pn-menu" role="menu">
              {esAdmin(rol) && <button role="menuitem" className={activo === 'adm' ? 'on' : ''} onClick={() => { setMenu(false); irA('adm'); }}>⚙ Administración</button>}
              <button role="menuitem" onClick={() => { setMenu(false); cerrarSesion(); }}>🔒 Cambiar de usuario</button>
              <button role="menuitem" className="r" onClick={() => { setMenu(false); cerrarSesion(); }}>⎋ Salir</button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
