// src/screens/Estadisticas.jsx — Tablero de estadísticas (solo Admin). Cálculo en cuenta/estadisticas.js; sin librerías de gráficas (rápido en la tablet).
import { Fragment, useState, useEffect, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import { PERIODOS, BINS_HORA, estadisticas } from '../cuenta/estadisticas.js';
import { cargarEstadisticas } from '../cuenta/estadisticasDb.js';
import './Panel.css';
import './Estadisticas.css';

const fmt = (n) => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n ?? 0)).toLocaleString('es-CO');
const pct = (n) => `${Math.round(n)} %`;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'], DIA_L = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const METODO = { EFECTIVO: 'Efectivo', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', TARJETA: 'Bancolombia', TRANSFERENCIA: 'Transferencia' };

function Var({ v, malo }) {
  if (v == null) return <span className="es-mut">sin periodo anterior</span>;
  const sube = v >= 0, bien = malo ? !sube : sube;
  return <span className={bien ? 'es-up' : 'es-dn'}>{sube ? '▲' : '▼'} {Math.abs(Math.round(v))} % vs periodo anterior</span>;
}

export default function Estadisticas() {
  const [datos, setDatos] = useState(null); const [filtro, setFiltro] = useState('mes');
  const [desde, setDesde] = useState(''); const [hasta, setHasta] = useState('');
  useEffect(() => { cargarEstadisticas().then(setDatos); }, []);
  const e = useMemo(() => (datos ? estadisticas({ ...datos, filtro, desde, hasta }) : null), [datos, filtro, desde, hasta]);
  if (!e) return <><Encabezado activo="estadisticas" /><div className="es" /></>;
  const maxDia = Math.max(1, ...e.porDia.map((d) => d.total)), maxCalor = Math.max(1, ...e.calor.flat());
  const totalOrigen = Math.max(1, e.origen.tiempo + e.origen.licor + e.origen.snacks + e.origen.garita);
  const totalMetodos = Math.max(1, Object.values(e.metodos).reduce((t, x) => t + x, 0));
  const edadTotal = Math.max(1, e.fiadosEdad.reciente + e.fiadosEdad.medio + e.fiadosEdad.viejo);
  const k = e.kpi;
  const ORIGEN = [['⏱ Tiempo de mesa', e.origen.tiempo, 'cy'], ['🍺 Licor', e.origen.licor, 'mg'], ['🍿 Snacks y otros', e.origen.snacks, 'am'], ['⏳ Garita', e.origen.garita, 'vd']];
  return (
    <>
      <Encabezado activo="estadisticas" />
      <div className="es">
        <div className="es-top"><h1>📊 Estadísticas</h1>
          <div className="es-tabs">{PERIODOS.map(([v, t]) => <button key={v} className={filtro === v ? 'on' : ''} onClick={() => setFiltro(v)}>{t}</button>)}
            {filtro === 'rango' && <><input type="date" value={desde} onChange={(x) => setDesde(x.target.value)} /><input type="date" value={hasta} onChange={(x) => setHasta(x.target.value)} /></>}</div></div>

        <div className="es-k">
          <div><small>VENDIDO</small><b className="v">{fmt(k.vendido)}</b><Var v={k.vVendido} /><i>{k.nVentas} ventas</i></div>
          <div><small>GANANCIA</small><b className="v">{fmt(k.ganancia)}</b><Var v={k.vGanancia} /><i>margen {pct(k.margen)}</i></div>
          <div><small>GASTOS</small><b className="r">{fmt(k.gastos)}</b><Var v={k.vGastos} malo /></div>
          <div><small>POR COBRAR (FIADOS)</small><b className="a">{fmt(k.porCobrar)}</b><span className="es-mut">{k.nDeudores} clientes{k.nViejos ? ` · ${k.nViejos} con más de 30 días` : ''}</span></div>
        </div>

        <div className="es-g">
          <div className="es-c"><h3>VENTAS POR DÍA</h3>
            {e.porDia.every((d) => !d.total) ? <div className="es-mut">Sin ventas en este periodo.</div> :
              <div className="es-bars">{e.porDia.map((d) => <div className="es-bar" key={d.fecha} title={fmt(d.total)}><i style={{ height: `${(d.total / maxDia) * 100}%` }} /><span>{DIA_L[new Date(d.fecha).getDay()]}</span></div>)}</div>}</div>
          <div className="es-c"><h3>ALERTAS</h3>
            {e.alertas.length === 0 && <div className="es-ok">✓ Sin alertas</div>}
            {e.alertas.map((a) => <div className="es-alerta" key={a.tipo}>⚠️ {a.texto}</div>)}</div>
        </div>

        <div className="es-g">
          <div className="es-c"><h3>CUÁNDO SE VENDE · DÍA × HORA</h3>
            <div className="es-hm"><b />{BINS_HORA.map((h) => <small key={h}>{h}</small>)}
              {DIAS.map((d, i) => <Fragment key={d}><small>{d}</small>{e.calor[i].map((v, j) => <u key={j} title={fmt(v)} style={{ background: `rgba(0,229,255,${v ? 0.1 + (v / maxCalor) * 0.85 : 0.04})` }} />)}</Fragment>)}</div></div>
          <div className="es-c"><h3>DE DÓNDE VIENE LA PLATA</h3>
            {ORIGEN.map(([t, v, c]) => <div key={t}><div className="es-row"><span>{t}</span><b>{fmt(v)} · {pct((v / totalOrigen) * 100)}</b></div><div className="es-pb"><i className={c} style={{ width: `${(v / totalOrigen) * 100}%` }} /></div></div>)}</div>
        </div>

        <div className="es-g2">
          <div className="es-c"><h3>TOP PRODUCTOS · POR GANANCIA</h3>
            {e.top.length === 0 && <div className="es-mut">Sin productos vendidos.</div>}
            {e.top.map((p) => <div className="es-row" key={p.nombre}><span>{p.nombre} <small className="es-mut">×{p.cant}</small></span><span><b>{fmt(p.ganancia)}</b> <small className={p.margen < (datos.objetivo ?? 40) ? 'es-am' : 'es-mut'}>· {pct(p.margen)}{p.margen < (datos.objetivo ?? 40) ? ' ⚠️' : ''}</small></span></div>)}</div>
          <div className="es-c"><h3>FIADOS · ANTIGÜEDAD</h3>
            {[['0 – 7 días', e.fiadosEdad.reciente, 'vd'], ['8 – 30 días', e.fiadosEdad.medio, 'am'], ['Más de 30 días', e.fiadosEdad.viejo, 'ro']].map(([t, v, c]) => <div key={t}><div className="es-row"><span>{t}</span><b>{fmt(v)}</b></div><div className="es-pb"><i className={c} style={{ width: `${(v / edadTotal) * 100}%` }} /></div></div>)}
            {e.deudores.length > 0 && <><h3 style={{ marginTop: 12 }}>QUIÉN MÁS DEBE</h3>{e.deudores.map((d) => <div className="es-row" key={d.nombre}><span>{d.nombre} <small className="es-mut">hace {d.masVieja} d</small></span><b>{fmt(d.deuda)}</b></div>)}</>}</div>
          <div className="es-c"><h3>CÓMO PAGAN</h3>
            {Object.keys(e.metodos).length === 0 && <div className="es-mut">Sin ventas.</div>}
            {Object.entries(e.metodos).sort((a, b) => b[1] - a[1]).map(([m, v]) => <div key={m}><div className="es-row"><span>{METODO[m] ?? m}</span><b>{fmt(v)} · {pct((v / totalMetodos) * 100)}</b></div><div className="es-pb"><i className="vd" style={{ width: `${(v / totalMetodos) * 100}%` }} /></div></div>)}</div>
        </div>
      </div>
    </>
  );
}
