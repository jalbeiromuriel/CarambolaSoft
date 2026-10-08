// src/components/Encabezado.jsx — Logo + barra de secciones (réplica de la barra del POS). Lo no construido sale atenuado.
import LogoBola9 from './LogoBola9.jsx';
import { SECCIONES, bloqueada } from '../cuenta/menu.js';

export default function Encabezado({ activo = 'panel', irPanel, rol = null }) {
  const ir = (s) => { if (s.id === 'panel') irPanel?.(); };
  return (
    <header className="pn-top">
      <LogoBola9 size={46} />
      <div>
        <div className="pn-t1">Mero Parche</div>
        <div className="pn-t2">Licores &amp; Billar · Sistema de Ventas</div>
      </div>
      <nav className="pn-nav" aria-label="Secciones">
        {SECCIONES.map((s) => (
          <button key={s.id} className={`${s.id === activo ? 'on' : ''} ${s.listo ? '' : 'off'}`} disabled={!s.listo}
            title={s.listo ? '' : `Próximamente · Fase ${s.fase}`} onClick={() => ir(s)}>
            {s.t}{bloqueada(s, rol) ? ' 🔒' : ''}
          </button>
        ))}
      </nav>
    </header>
  );
}
