// src/screens/Configuracion.jsx — Valores del negocio (solo Admin): tarifa de billar, redondeo, garita y horario de atención.
import { useState, useEffect } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { useSesion } from '../components/Sesion.jsx';
import { cargarAjustes, guardarAjustes } from '../cuenta/ajustesDb.js';
import { AJUSTES_BASE } from '../cuenta/ajustes.js';
import './Panel.css';
import './Configuracion.css';

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
const REDONDEOS = [1, 10, 50, 100, 500, 1000];
const cuando = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Configuracion() {
  const { usuario } = useSesion();
  const [f, setF] = useState(null); const [ultimo, setUltimo] = useState(null);
  const [error, setError] = useState(''); const [ok, setOk] = useState(false);
  useEffect(() => { (async () => { const { ultimo: u, ...a } = await cargarAjustes(); setF({ ...AJUSTES_BASE, ...a }); setUltimo(u ?? null); })(); }, []);
  if (!f) return <><Encabezado activo="config" /><div className="cf" /></>;
  const set = (k, v) => { setOk(false); setError(''); setF({ ...f, [k]: v }); };
  async function guardar() {
    const r = await guardarAjustes(f, usuario);
    if (r.error) { setError(r.error); return; }
    setUltimo(r.ultimo); setOk(true);
  }
  return (
    <>
      <Encabezado activo="config" />
      <div className="cf">
        <h2>Configuración</h2>
        <p className="cf-sub">Solo el administrador ve y cambia estos valores. Aplican a las mesas que abras desde ahora.</p>
        <div className="cf-g">
          <section className="cf-c">
            <h3>🎱 Billar</h3><p>Tarifa que se cobra por hora de mesa (taxímetro).</p>
            <div className="cf-lab">TARIFA POR HORA</div>
            <div className="cf-f"><input className="cf-money" inputMode="numeric" value={fmt(f.tarifaBillar)} onChange={(e) => set('tarifaBillar', num(e.target.value))} /><span>por hora</span></div>
            <div className="cf-lab">REDONDEO AL COBRAR</div>
            <div className="cf-f"><select className="cf-num" value={f.redondeo} onChange={(e) => set('redondeo', Number(e.target.value))}>{REDONDEOS.map((r) => <option key={r} value={r}>{r === 1 ? 'Sin redondeo' : fmt(r)}</option>)}</select>
              <span>el total de la mesa sube al siguiente múltiplo</span></div>
            <div className="cf-nota">Las mesas que ya están en juego conservan la tarifa con la que se abrieron.</div>
          </section>
          <section className="cf-c">
            <h3>⏱ Garita</h3><p>Cobro por persona y por hora, con aviso antes de cumplirse.</p>
            <div className="cf-lab">PRECIO POR PERSONA / HORA</div>
            <div className="cf-f"><input className="cf-money" inputMode="numeric" value={fmt(f.precioGarita)} onChange={(e) => set('precioGarita', num(e.target.value))} /><span>es el precio del producto «Garita» del inventario</span></div>
            <div className="cf-lab">AVISO ANTES DE CUMPLIR LA HORA</div>
            <div className="cf-f"><input className="cf-num" inputMode="numeric" value={f.avisoGaritaMin} onChange={(e) => set('avisoGaritaMin', num(e.target.value))} /><span>minutos</span></div>
            <div className="cf-nota">Las garitas abiertas conservan el precio con el que empezaron.</div>
          </section>
          <section className="cf-c">
            <h3>🕘 Horario de atención</h3><p>Sirve para calcular qué tan ocupada está cada mesa.</p>
            <div className="cf-lab">HORAS DE ATENCIÓN POR DÍA</div>
            <div className="cf-f"><input className="cf-num" inputMode="numeric" value={f.horasAtencion} onChange={(e) => set('horasAtencion', num(e.target.value))} /><span>horas</span></div>
          </section>
          <section className="cf-c">
            <h3>Guardar</h3><p>Queda registrado quién cambió los valores y cuándo.</p>
            {error && <div className="cf-err">{error}</div>}
            <button className="cf-ok" onClick={guardar}>Guardar cambios</button>
            {ok && <span className="cf-hecho">✓ Guardado</span>}
            {ultimo && <div className="cf-ult">Último cambio: {ultimo.por} · {cuando(ultimo.fecha)}</div>}
          </section>
        </div>
      </div>
    </>
  );
}
