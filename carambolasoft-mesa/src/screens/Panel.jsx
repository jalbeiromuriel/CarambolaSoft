// src/screens/Panel.jsx
// Panel principal — réplica mejorada del POS Mero Parche (v6.28).
// Fuente de verdad: IndexedDB. Mesa = dorado, Billar = verde. Garita y Venta rápida: Fase 1b.
import { useState, useEffect, useCallback } from 'react';
import { put, getAll, porIndice } from '../db/repository.js';
import { listarClientes, guardarCliente } from '../marcador/datos.js';
import LogoBola9 from '../components/LogoBola9.jsx';
import './Panel.css';

const TARIFA_BILLAR = 6000; // $/hora: precio del producto "Tiempo Mesa Billar" del POS (editable al abrir)
const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');
const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
const norm = (t) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const hms = (iso, ahora) => {
  const s = Math.max(0, Math.floor((ahora - new Date(iso)) / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
};

export default function Panel({ irACuenta, irAContador }) {
  const [mesas, setMesas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [fiadoPorCliente, setFiadoPorCliente] = useState({});
  const [clientes, setClientes] = useState([]);
  const [cliente, setCliente] = useState(null); // cliente registrado elegido para la cuenta nueva
  const [modal, setModal] = useState(null); // { tipo:'MESA' } | { tipo:'BILLAR', mesaId }
  const [nombre, setNombre] = useState('');   // nombre libre
  const [busca, setBusca] = useState('');
  const [nuevo, setNuevo] = useState(null);     // {nombre, apodo} mientras se crea un cliente rápido
  const [tarifa, setTarifa] = useState(String(TARIFA_BILLAR));
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(Date.now());

  const cargar = useCallback(async () => {
    setMesas((await getAll('MESAS_BILLAR')).sort((a, b) => a.Numero - b.Numero));
    setCuentas(await porIndice('CUENTAS', 'porEstado', 'ABIERTA'));
    setPedidos(await getAll('PEDIDOS_CUENTAS'));
    setClientes((await listarClientes()).filter((c) => c.Activo !== false)); // solo nombres: el teléfono no sale de Clientes

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
    const tiempo = c.TarifaPorHora
      ? Math.round((Math.ceil((ahora - new Date(c.HoraApertura)) / 60000) * c.TarifaPorHora) / 60)
      : 0;
    return { pedidos: items.reduce((t, p) => t + p.Cantidad, 0), total: consumo + tiempo };
  }

  const q = norm(busca);
  const sugeridos = clientes
    .filter((c) => !q || norm(c.Nombre).includes(q) || norm(c.Apodo).includes(q))
    ;

  function elegir(c) { setCliente(cliente?.Id === c.Id ? null : c); setError(''); }

  async function crearRapido() {
    if (!nuevo.nombre.trim()) { setError('Escribe el nombre.'); return; }
    const c = await guardarCliente({ Nombre: nuevo.nombre, Apodo: nuevo.apodo });
    setClientes((l) => [...l, c].sort((a, b) => a.Nombre.localeCompare(b.Nombre)));
    setCliente(c); setNuevo(null); setError('');
  }

  function abrirModal(m) { setError(''); setNombre(''); setBusca(''); setNuevo(null); setCliente(null); setTarifa(String(TARIFA_BILLAR)); setModal(m); }

  async function abrirCuenta() {
    const etiqueta = nombre.trim() || cliente?.Apodo || cliente?.Nombre || '';
    if (!etiqueta) { setError('Elige un cliente o escribe un nombre.'); return; }
    const esBillar = modal.tipo === 'BILLAR';
    if (esBillar && !modal.mesaId) { setError('Elige una mesa libre.'); return; }
    if (esBillar && !(Number(tarifa) > 0)) { setError('La tarifa por hora es obligatoria en billar.'); return; }

    const cuenta = await put('CUENTAS', {
      TipoCuenta: esBillar ? 'BILLAR' : 'LICORES',
      MesaId: esBillar ? modal.mesaId : null,
      ClienteId: cliente?.Id ?? null,   // null = no registrado: no puede fiar
      NombreLibre: etiqueta,
      HoraApertura: new Date().toISOString(),
      HoraCierre: null,
      TarifaPorHora: esBillar ? Number(tarifa) : null,
      Estado: 'ABIERTA',
    });
    if (esBillar) {
      const mesa = mesas.find((m) => m.Id === modal.mesaId);
      await put('MESAS_BILLAR', { ...mesa, Estado: 'OCUPADA' });
    }
    if (cliente) await put('CLIENTES', { ...cliente, Visitas: (cliente.Visitas ?? 0) + 1 }); // ⭐ suma una visita
    setModal(null);
    irACuenta(cuenta.Id); // directo al detalle, como en el POS
  }

  return (
    <div className="pn">
      <header className="pn-top">
        <LogoBola9 size={46} />
        <div>
          <div className="pn-t1">Mero Parche</div>
          <div className="pn-t2">Licores &amp; Billar · Sistema de Ventas</div>
        </div>
      </header>

      <div className="pn-wrap">
        <div className="pn-btns">
          <button className="pn-b mesa" onClick={() => abrirModal({ tipo: 'MESA' })}>
            <h3>+ MESA</h3><p>licores y snacks</p>
          </button>
          <button className="pn-b bil" onClick={() => abrirModal({ tipo: 'BILLAR', mesaId: mesasLibres[0]?.Id ?? null })}>
            <h3>+ BILLAR</h3><p>mesa con taxímetro</p>
          </button>
          <div className="pn-b off" aria-disabled="true"><h3>⏱ GARITA</h3><p>aviso de cobro cada hora</p><small>FASE 1B</small></div>
          <div className="pn-b off" aria-disabled="true"><h3>⚡ VENTA RÁPIDA</h3><p>granizados · pide y paga</p><small>FASE 1B</small></div>
        </div>

        <div className="pn-sec">Mesas de billar<i /></div>
        <div className="pn-mesas">
          {mesas.length === 0 && <div className="pn-vacio">Aún no hay mesas cargadas.</div>}
          {mesas.map((m) => {
            const c = cuentaDeMesa(m.Id);
            const oc = m.Estado === 'OCUPADA' && c;
            return (
              <button key={m.Id} className={`pn-m ${oc ? 'oc' : 'lib'}`}
                onClick={() => (oc ? irACuenta(c.Id) : abrirModal({ tipo: 'BILLAR', mesaId: m.Id }))}>
                <b>MESA {m.Numero}</b><span>{oc ? 'OCUPADA' : 'LIBRE'}</span>
              </button>
            );
          })}
        </div>

        <div className="pn-sec">Cuentas abiertas — toca para gestionar o liquidar<i />
          {irAContador && <button className="pn-chipbtn" onClick={irAContador}>🎱 CONTADOR DEL BILLAR</button>}
        </div>
        <div className="pn-cuentas">
          {cuentas.length === 0 && <div className="pn-vacio">No hay cuentas abiertas.</div>}
          {cuentas.map((c) => {
            const billar = c.TipoCuenta === 'BILLAR';
            const r = resumen(c);
            const deuda = c.ClienteId ? fiadoPorCliente[c.ClienteId] : 0;
            return (
              <div key={c.Id} className={`pn-c ${billar ? 'bi' : 'l'}`} onClick={() => irACuenta(c.Id)}>
                <div className="pn-k">
                  <span>{billar ? `🎱 BILLAR${numMesa(c.MesaId) ? ` · M${numMesa(c.MesaId)}` : ''}` : '🥃 MESA'}</span>
                  {deuda > 0 && <span className="pn-fia">FÍA {fmt(deuda)}</span>}
                </div>
                <h4>{c.NombreLibre}</h4>
                <div className="pn-f">
                  <span>desde {hora(c.HoraApertura)} · {r.pedidos} ped.
                    {billar && <span className="pn-cr">⏱ {hms(c.HoraApertura, ahora)}</span>}
                  </span>
                  <span className="pn-tot">{fmt(r.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className={`pn-modal ${modal.tipo === 'BILLAR' ? 'bil' : ''}`}>
            <h3>{modal.tipo === 'BILLAR' ? 'Abrir billar' : 'Abrir mesa · licores y snacks'}</h3>
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
            {nuevo ? (
              <>
                <label>Nuevo cliente rápido</label>
                <input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre completo" />
                <input value={nuevo.apodo} onChange={(e) => setNuevo({ ...nuevo, apodo: e.target.value })} placeholder="Apodo (El Tigre, La Reina…)" style={{ marginTop: 8 }} />
                {error && <div className="pn-err">{error}</div>}
                <div className="pn-acc">
                  <button className="no" onClick={() => { setNuevo(null); setError(''); }}>VOLVER</button>
                  <button className="si" onClick={crearRapido}>CREAR Y SELECCIONAR</button>
                </div>
              </>
            ) : (
              <>
                <div className="pn-cabcli">
                  <label>Seleccionar cliente</label>
                  <button onClick={() => { setNuevo({ nombre: '', apodo: '' }); setError(''); }}>+ Nuevo cliente</button>
                </div>
                <div className="pn-busca">
                  <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o apodo…" />
                  {busca && <span onClick={() => setBusca('')}>✕</span>}
                </div>
                <div className="pn-lista">
                  {sugeridos.length === 0 && <div className="pn-vacio">{clientes.length === 0 ? 'Aún no hay clientes. Crea uno con “+ Nuevo cliente”.' : 'Sin coincidencias.'}</div>}
                  {sugeridos.map((c) => (
                    <button key={c.Id} className={cliente?.Id === c.Id ? 'on' : ''} onClick={() => elegir(c)}>
                      <div><b>{c.Nombre}</b>{c.Apodo && <em>“{c.Apodo}”</em>}</div>
                      <span className="pn-est">⭐ {c.Visitas ?? 0}</span>
                    </button>
                  ))}
                </div>
                <label>O nombre libre (apodo, seña…)</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && abrirCuenta()} placeholder="El Tigre, mesa ventana, Doña Marta…" />
                <div className={`pn-reg ${cliente ? 'si' : ''}`}>
                  {cliente ? `✓ Cliente registrado: ${cliente.Nombre}` : nombre.trim() ? 'Sin cliente: no podrá fiar' : ''}
                </div>
              </>
            )}
            {!nuevo && modal.tipo === 'BILLAR' && (
              <>
                <label>Tarifa por hora (COP)</label>
                <input type="number" inputMode="numeric" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
              </>
            )}
            {!nuevo && error && <div className="pn-err">{error}</div>}
            {!nuevo && <div className="pn-acc">
              <button className="no" onClick={() => setModal(null)}>CANCELAR</button>
              <button className="si" onClick={abrirCuenta}>ABRIR CUENTA</button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
