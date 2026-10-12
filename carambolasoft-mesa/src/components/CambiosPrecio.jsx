// src/components/CambiosPrecio.jsx — Aviso a los administradores cuando cambia un precio de venta + lista de cambios con WhatsApp.
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { esAdmin } from '../cuenta/auth.js';
import { cambiosSinVer, textoCambiosPrecio } from '../cuenta/inventario.js';
import { leerCambiosPrecio, leerVisto, marcarVisto, marcarAvisados } from '../cuenta/inventarioDb.js';
import { enlaceWhatsApp } from '../informes/datos.js';
import './CambiosPrecio.css';

const fmt = (n) => '$' + Math.round(n ?? 0).toLocaleString('es-CO');
const cuando = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const hoyLargo = () => new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const HACE_30_DIAS = () => new Date(Date.now() - 30 * 864e5).toISOString();

/** Lista de los cambios de los últimos 30 días. "Avisar" abre WhatsApp con lo que aún no se ha avisado al grupo de ADM. */
export function CambiosPrecioModal({ usuario, cerrar }) {
  const [lista, setLista] = useState([]);
  const cargar = useCallback(async () => setLista((await leerCambiosPrecio()).filter((c) => c.Fecha >= HACE_30_DIAS())), []);
  useEffect(() => { cargar(); }, [cargar]);
  const pendientes = lista.filter((c) => !c.Avisado);
  async function avisar() {
    window.open(enlaceWhatsApp(textoCambiosPrecio(pendientes, hoyLargo()), ''), '_blank', 'noopener');   // sin número: eliges el grupo de ADM en WhatsApp
    await marcarAvisados(pendientes.map((c) => c.Id)); await cargar();
  }
  async function listo() { if (usuario?.Id) await marcarVisto(usuario.Id); cerrar(); }
  return createPortal(
    <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && listo()}>
      <div className="pn-modal cp-modal">
        <h3>📣 Cambios de precio</h3>
        <p className="cp-hint">Últimos 30 días. {pendientes.length ? <>Faltan por avisar al grupo de ADM: <b>{pendientes.length}</b>.</> : 'Todo avisado al grupo de ADM.'}</p>
        <div className="cp-scroll"><table className="cp-t">
          <thead><tr><th>Producto</th><th className="n">Antes</th><th className="n">Ahora</th><th>Quién</th><th>Cuándo</th></tr></thead>
          <tbody>{lista.map((c) => (
            <tr key={c.Id} className={c.Avisado ? 'ok' : ''}><td>{c.Nombre}{!c.Avisado && <span className="cp-nuevo">sin avisar</span>}</td>
              <td className="n">{fmt(c.Antes)}</td><td className="n"><b className={c.Despues > c.Antes ? 'sube' : 'baja'}>{fmt(c.Despues)}</b></td>
              <td>{c.Usuario || '—'}<small> · {c.Motivo}</small></td><td>{cuando(c.Fecha)}</td></tr>))}
          </tbody></table>
          {lista.length === 0 && <div className="cp-vacio">Todavía no hay cambios de precio registrados.</div>}</div>
        <div className="pn-acc">
          <button className="no" disabled={pendientes.length === 0} onClick={avisar}>📲 Avisar al grupo de ADM ({pendientes.length})</button>
          <button className="si" onClick={listo}>✓ Visto</button></div>
      </div>
    </div>, document.body
  );
}

/** Franja para los administradores: precios que cambió OTRA persona desde la última vez que lo vio. `clave` cambia al navegar para refrescar. */
export default function AvisoPrecios({ usuario, visible, clave }) {
  const [n, setN] = useState(0);
  const [ver, setVer] = useState(false);
  const refrescar = useCallback(async () => {
    if (!usuario || !esAdmin(usuario.Rol)) return setN(0);
    setN(cambiosSinVer(await leerCambiosPrecio(), await leerVisto(usuario.Id), usuario.Id).length);
  }, [usuario]);
  useEffect(() => { refrescar(); }, [refrescar, clave]);
  if (!usuario || !esAdmin(usuario.Rol)) return null;
  return (
    <>
      {visible && n > 0 && !ver && (
        <div className="cp-franja" role="alert">
          <span>📣 {n === 1 ? 'Cambió 1 precio' : `Cambiaron ${n} precios`} desde la última vez que entraste</span>
          <button onClick={() => setVer(true)}>Ver</button>
          <button onClick={async () => { await marcarVisto(usuario.Id); setN(0); }}>✓ Visto</button>
        </div>
      )}
      {ver && <CambiosPrecioModal usuario={usuario} cerrar={() => { setVer(false); refrescar(); }} />}
    </>
  );
}
