// src/screens/Panel.jsx
// Panel principal — réplica mejorada del POS Mero Parche (v6.28).
// Fuente de verdad: IndexedDB. Mesa = dorado, Billar = verde. Garita y Venta rápida: Fase 1b.
import { useState, useEffect, useCallback } from 'react';
import { put, getAll, porIndice } from '../db/repository.js';
import SelectorCliente, { etiquetaDe, sumarVisita } from '../components/SelectorCliente.jsx';
import { agrupar } from '../cuenta/grupos.js';
import { cobroTiempo, msJugados, estaCorriendo, hms } from '../cuenta/tiempo.js';
import { estadoReloj, mmss } from '../cuenta/garita.js';
import { abrirGarita } from '../cuenta/garitaDb.js';
import VentaRapida from '../components/VentaRapida.jsx';
import Encabezado from '../components/Encabezado.jsx';
import CuentaPagos from '../components/CuentaPagos.jsx';
import { Gasto } from './Caja.jsx';
import { registrarGasto } from '../cuenta/cajaDb.js';
import { PremioModal } from './Maquinas.jsx';
import { cargarMaquinas } from '../cuenta/maquinasDb.js';
import { saldoFondo } from '../cuenta/maquinas.js';
import { useSesion } from '../components/Sesion.jsx';
import { esAdmin } from '../cuenta/auth.js';
import './Panel.css';

const TARIFA_BILLAR = 6000; // $/hora: precio del producto "Tiempo Mesa Billar" del POS (editable al abrir)
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

export default function Panel({ irACuenta, irAContador }) {
  const [mesas, setMesas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const { usuario } = useSesion();
  const admin = esAdmin(usuario?.Rol);
  const [acc, setAcc] = useState(null); // 'pagos' | 'gasto'
  const [maqs, setMaqs] = useState({ maquinas: [], saldo: 0 });
  const [avisoVR, setAvisoVR] = useState('');
  const [rapida, setRapida] = useState(false);
  const [relojes, setRelojes] = useState([]);
  const [fiadoPorCliente, setFiadoPorCliente] = useState({});
  const [modal, setModal] = useState(null); // { tipo:'MESA' } | { tipo:'BILLAR', mesaId }
  const [sel, setSel] = useState({ cliente: null, nombre: '' }); // cliente elegido + nombre libre
  const [creando, setCreando] = useState(false);                  // el selector está en 'nuevo cliente'
  const [tarifa, setTarifa] = useState(String(TARIFA_BILLAR));
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(Date.now());

  const cargar = useCallback(async () => {
    setMesas((await getAll('MESAS_BILLAR')).sort((a, b) => a.Numero - b.Numero));
    setCuentas(await porIndice('CUENTAS', 'porEstado', 'ABIERTA'));
    setPedidos(await getAll('PEDIDOS_CUENTAS'));
    setRelojes(await getAll('GARITAS_RELOJ'));

    // Deuda de fiado por cliente: facturas con saldo, unidas a su cuenta para saber el cliente.
    const todas = await getAll('CUENTAS');
    const clienteDe = Object.fromEntries(todas.map((c) => [c.Id, c.ClienteId]));
    const deuda = {};
    for (const f of await getAll('FACTURAS')) {
      const cli = clienteDe[f.CuentaId];
      if (cli && (f.TotalPendienteFiado ?? 0) > 0) deuda[cli] = (deuda[cli] ?? 0) + f.TotalPendienteFiado;
    }
    setFiadoPorCliente(deuda);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000); // cronómetros y total de billar en vivo
    return () => clearInterval(t);
  }, []);

  const cuentaDeMesa = (mesaId) => cuentas.find((c) => c.MesaId === mesaId);
  const mesasLibres = mesas.filter((m) => !(m.Estado === 'OCUPADA' && cuentaDeMesa(m.Id)));
  const numMesa = (id) => mesas.find((m) => m.Id === id)?.Numero;

  function resumen(c) {
    const items = pedidos.filter((p) => p.CuentaId === c.Id && p.EstadoPedido === 'ENTREGADO');
    const consumo = items.reduce((t, p) => t + p.PrecioUnitarioHist * p.Cantidad, 0);
    const tiempo = cobroTiempo(c, ahora);
    return { pedidos: items.reduce((t, p) => t + p.Cantidad, 0), total: consumo + tiempo };
  }

  function abrirModal(m) { setError(''); setSel({ cliente: null, nombre: '' }); setCreando(false); setTarifa(String(TARIFA_BILLAR)); setModal(m); }

  async function abrirCuenta() {
    const { cliente } = sel;
    const etiqueta = etiquetaDe(sel);
    if (!etiqueta) { setError('Elige un cliente o escribe un nombre.'); return; }
    if (modal.tipo === 'GARITA') {
      const c = await abrirGarita({ cliente, etiqueta });
      await sumarVisita(cliente);
      setModal(null);
      irACuenta(c.Id);
      return;
    }
    const esBillar = modal.tipo === 'BILLAR';
    if (esBillar && !modal.mesaId) { setError('Elige una mesa libre.'); return; }
    if (esBillar && !(Number(tarifa) > 0)) { setError('La tarifa por hora es obligatoria en billar.'); return; }

    const cuenta = await put('CUENTAS', {
      TipoCuenta: esBillar ? 'BILLAR' : 'LICORES',
      MesaId: esBillar ? modal.mesaId : null,
      ClienteId: cliente?.Id ?? null,   // null = no registrado: no puede fiar
      NombreLibre: etiqueta,
      HoraApertura: new Date().toISOString(),
      GrupoMesaId: esBillar ? null : crypto.randomUUID(), // cuentas de una misma mesa de licores comparten grupo
      HoraCierre: null,
      TarifaPorHora: esBillar ? Number(tarifa) : null,
      ...(esBillar ? { MsAcumulados: 0, InicioChico: null } : {}), // el taxímetro arranca con ▶ INICIAR
      Estado: 'ABIERTA',
    });
    if (esBillar) {
      const mesa = mesas.find((m) => m.Id === modal.mesaId);
      await put('MESAS_BILLAR', { ...mesa, Estado: 'OCUPADA' });
    }
    await sumarVisita(cliente);
    setModal(null);
    irACuenta(cuenta.Id); // directo al detalle, como en el POS
  }

  const tarjeta = (g) => {

    const c = g[0];                                   // la mesa lleva el nombre de su primera cuenta
    const billar = c.TipoCuenta === 'BILLAR';
    const garita = c.TipoCuenta === 'GARITA';
    const reloj = garita ? relojes.find((r) => r.Id === c.GaritaRelojId) : null;
    const er = reloj ? estadoReloj(reloj, ahora) : null;
    const rs = g.map(resumen);
    const pedidosN = rs.reduce((t, r) => t + r.pedidos, 0);
    const total = rs.reduce((t, r) => t + r.total, 0);
    const conTaxi = g.find((x) => x.TarifaPorHora);
    const clientesDeuda = [...new Set(g.map((x) => x.ClienteId).filter(Boolean))];
    const deuda = clientesDeuda.reduce((t, id) => t + (fiadoPorCliente[id] ?? 0), 0);
    return (
      <div key={c.Id} className={`pn-c ${billar ? 'bi' : garita ? 'ga' : 'l'} ${er?.enAviso ? 'al' : ''}`} onClick={() => irACuenta(c.Id)}>
        <div className="pn-k">
          <span>{billar ? `🎱 BILLAR${numMesa(c.MesaId) ? ` · M${numMesa(c.MesaId)}` : ''}` : garita ? '⏱ GARITA' : '🥃 MESA'}</span>
          <span className="pn-der">
            {deuda > 0 && <span className="pn-fia">FÍA {fmt(deuda)}</span>}
            <span className="pn-n" title={g.map((x) => x.NombreLibre).join(', ')}>👥 {g.length}</span>
          </span>
        </div>
        <h4>{c.NombreLibre}</h4>
        {reloj && <div className="pn-cr ga garita-r">⏱ {hms(er.transcurrido)} · {er.enAviso ? '⏰ 5 MIN ¡cobrar!' : `aviso en ${mmss(er.faltaAviso)}`}</div>}
        <div className="pn-f">
          <span>desde {hora(c.HoraApertura)} · {pedidosN} ped.
            {conTaxi && <span className="pn-cr">{estaCorriendo(conTaxi) ? '⏱' : '⏸'} {hms(msJugados(conTaxi, ahora))}</span>}
          </span>
          <span className="pn-tot">{fmt(total)}</span>
        </div>
        <div className="pn-tip">
          <div className="pn-tip-t">{g.length} {g.length === 1 ? 'cliente' : 'clientes'} en la mesa</div>
          {g.map((x, i) => <div key={x.Id}><span>👤 {x.NombreLibre}</span><b>{fmt(rs[i].total)}</b></div>)}
        </div>
      </div>
    );
  };
  const grupos = agrupar(cuentas);
  const enJuego = grupos.filter((g) => g[0].TipoCuenta === 'BILLAR' || g[0].TipoCuenta === 'GARITA');
  const licores = grupos.filter((g) => !enJuego.includes(g));

  return (
    <div className="pn">
      <Encabezado activo="panel" />

      <div className="pn-wrap">
        <div className="pn-acc2">
          <button className="v" onClick={() => setAcc('pagos')}>💳 CUENTA PARA PAGOS</button>
          {admin && <button className="r" onClick={() => setAcc('gasto')}>− REGISTRAR GASTO</button>}
          {admin && <button className="r" onClick={async () => { const x = await cargarMaquinas(); setMaqs({ maquinas: x.maquinas, saldo: saldoFondo(x.movs, x.base) }); setAcc('premio'); }}>🎰 PREMIO MÁQUINA</button>}
        </div>
        <div className="pn-btns">
          <button className="pn-b mesa" onClick={() => abrirModal({ tipo: 'MESA' })}>
            <h3>+ MESA</h3><p>licores y snacks</p>
          </button>
          <button className="pn-b bil" onClick={() => abrirModal({ tipo: 'BILLAR', mesaId: mesasLibres[0]?.Id ?? null })}>
            <h3>+ BILLAR</h3><p>mesa con taxímetro</p>
          </button>
          <button className="pn-b ga" onClick={() => abrirModal({ tipo: 'GARITA' })}>
            <h3>⏱ GARITA</h3><p>aviso de cobro cada hora</p>
          </button>
          <button className="pn-b vel" onClick={() => setRapida(true)}>
            <h3>⚡ VENTA RÁPIDA</h3><p>granizados · pide y paga</p>
          </button>
        </div>

        <div className="pn-sec ver">Billar y garita en juego<span className="pn-nota">· aparecen al abrir, desaparecen al cobrar</span><i />
          {irAContador && <button className="pn-chipbtn" onClick={irAContador}>🎱 CONTADOR DEL BILLAR</button>}
        </div>
        <div className="pn-cuentas">
          {enJuego.length === 0 && <div className="pn-vacio">Nada en juego.</div>}
          {enJuego.map(tarjeta)}
        </div>

        <div className="pn-sec">Mesas de licores<span className="pn-nota">· solo licores y snacks</span><i /></div>
        <div className="pn-cuentas">
          {licores.length === 0 && <div className="pn-vacio">No hay mesas de licores abiertas.</div>}
          {licores.map(tarjeta)}
        </div>
      </div>

      {rapida && <VentaRapida cerrar={() => setRapida(false)} alCobrar={(t) => { setRapida(false); setAvisoVR(`Venta registrada ✓ ${fmt(t)}`); setTimeout(() => setAvisoVR(''), 2800); cargar(); }} />}
      {avisoVR && <div className="ms-aviso">{avisoVR}</div>}
      {acc === 'pagos' && <CuentaPagos admin={admin} cerrar={() => setAcc(null)} />}
      {acc === 'premio' && <PremioModal maquinas={maqs.maquinas} saldo={maqs.saldo} cerrar={() => setAcc(null)} guardado={() => { setAcc(null); setAvisoVR('Premio registrado ✓'); setTimeout(() => setAvisoVR(''), 2600); }} />}
      {acc === 'gasto' && <Gasto cerrar={() => setAcc(null)} guardar={async (g, autorizo) => { await registrarGasto({ ...g, usuarioId: usuario?.Id, autorizoId: autorizo.Id }); setAcc(null); setAvisoVR('Gasto registrado ✓'); setTimeout(() => setAvisoVR(''), 2600); }} />}

      {modal && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className={`pn-modal ${modal.tipo === 'BILLAR' ? 'bil' : modal.tipo === 'GARITA' ? 'ga' : ''}`}>
            <h3>{modal.tipo === 'BILLAR' ? 'Abrir billar' : modal.tipo === 'GARITA' ? 'Iniciar garita · primera persona' : 'Abrir mesa · licores y snacks'}</h3>
            {modal.tipo === 'BILLAR' && (
              <>
                <label>Mesa</label>
                <div className="pn-elegir">
                  {mesasLibres.length === 0 && <span className="pn-vacio">No hay mesas libres.</span>}
                  {mesasLibres.map((m) => (
                    <button key={m.Id} className={modal.mesaId === m.Id ? 'on' : ''} onClick={() => setModal({ ...modal, mesaId: m.Id })}>
                      MESA {m.Numero}
                    </button>
                  ))}
                </div>
              </>
            )}
            <SelectorCliente valor={sel} onChange={setSel} onModoNuevo={setCreando} error={error} setError={setError} />
            {!creando && modal.tipo === 'BILLAR' && (
              <>
                <label>Tarifa por hora (COP)</label>
                <input type="number" inputMode="numeric" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
              </>
            )}
            {!creando && error && <div className="pn-err">{error}</div>}
            {!creando && <div className="pn-acc">
              <button className="no" onClick={() => setModal(null)}>CANCELAR</button>
              <button className="si" onClick={abrirCuenta}>{modal.tipo === 'GARITA' ? 'INICIAR GARITA' : 'ABRIR CUENTA'}</button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
