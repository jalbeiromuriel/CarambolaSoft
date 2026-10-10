// src/components/SelectorCliente.jsx — Elegir cliente registrado (⭐ visitas), crear uno rápido o usar nombre libre.
// Valor controlado: { cliente, nombre }. Estilos: clases pn-* de Panel.css (se importa allí).
import { useState, useEffect } from 'react';
import { put } from '../db/repository.js';
import { listarClientes, guardarCliente } from '../marcador/datos.js';
import { norm } from '../cuenta/catalogo.js';

/** Etiqueta de la cuenta: nombre libre, si no apodo o nombre del cliente. */
export const etiquetaDe = ({ cliente, nombre }) => nombre.trim() || cliente?.Apodo || cliente?.Nombre || '';

/** ⭐ suma una visita al cliente elegido. */
/** Personas a abrir: modo varios → toda la lista; modo uno → la selección única. */
export const personasDe = (valor, varios = false) => (varios
  ? (valor.lista ?? []).map((x) => ({ cliente: x.cliente ?? null, etiqueta: etiquetaDe({ cliente: x.cliente, nombre: x.nombre ?? '' }) })).filter((x) => x.etiqueta)
  : (etiquetaDe(valor) ? [{ cliente: valor.cliente ?? null, etiqueta: etiquetaDe(valor) }] : []));

export const sumarVisita = (cliente) => cliente && put('CLIENTES', { ...cliente, Visitas: (cliente.Visitas ?? 0) + 1 });

export default function SelectorCliente({ valor, onChange, onModoNuevo, error, setError, soloCliente = false, varios = false }) {
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [nuevo, setNuevo] = useState(null);

  useEffect(() => {
    listarClientes().then((l) => setClientes(l.filter((c) => c.Activo !== false))); // nombres y apodos: nunca el teléfono
  }, []);

  const q = norm(busca);
  const lista = clientes.filter((c) => !q || norm(c.Nombre).includes(q) || norm(c.Apodo).includes(q));
  const modoNuevo = (v) => { setNuevo(v); onModoNuevo?.(!!v); setError(''); };

  async function crear() {
    if (!nuevo.nombre.trim()) { setError('Escribe el nombre.'); return; }
    const c = await guardarCliente({ Nombre: nuevo.nombre, Apodo: nuevo.apodo });
    setClientes((l) => [...l, c].sort((a, b) => a.Nombre.localeCompare(b.Nombre)));
    if (varios) onChange({ ...valor, lista: [...(valor.lista ?? []), { k: c.Id, cliente: c, nombre: '' }] });
    else onChange({ ...valor, cliente: c });
    modoNuevo(null);
  }

  if (nuevo) {
    return (
      <>
        <label>Nuevo cliente rápido</label>
        <input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre completo" />
        <input value={nuevo.apodo} onChange={(e) => setNuevo({ ...nuevo, apodo: e.target.value })} placeholder="Apodo (El Tigre, La Reina…)" style={{ marginTop: 8 }} />
        {error && <div className="pn-err">{error}</div>}
        <div className="pn-acc">
          <button className="no" onClick={() => modoNuevo(null)}>VOLVER</button>
          <button className="si" onClick={crear}>CREAR Y SELECCIONAR</button>
        </div>
      </>
    );
  }

  const { cliente, nombre } = valor;
  const lis = valor.lista ?? [];
  const estaEn = (c) => lis.some((x) => x.cliente?.Id === c.Id);
  const alternar = (c) => { onChange({ ...valor, lista: estaEn(c) ? lis.filter((x) => x.cliente?.Id !== c.Id) : [...lis, { k: c.Id, cliente: c, nombre: '' }] }); setError(''); };
  const agregarLibre = () => { const n = (valor.nombre ?? '').trim(); if (!n) return; onChange({ ...valor, nombre: '', lista: [...lis, { k: `l${Date.now()}`, cliente: null, nombre: n }] }); setError(''); };
  if (varios) {
    const filtrados = clientes.filter((c) => !q || norm(c.Nombre).includes(q) || norm(c.Apodo).includes(q));
    return (
      <>
        <div className="pn-cabcli">
          <label>Seleccionar clientes (puedes marcar varios)</label>
          <button onClick={() => modoNuevo({ nombre: '', apodo: '' })}>+ Nuevo cliente</button>
        </div>
        <div className="pn-busca">
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o apodo…" />
          {busca && <span onClick={() => setBusca('')}>✕</span>}
        </div>
        <div className="pn-lista pn-multi">
          {filtrados.length === 0 && <div className="pn-vacio">{clientes.length === 0 ? 'Aún no hay clientes. Crea uno con “+ Nuevo cliente”.' : 'Sin coincidencias.'}</div>}
          {filtrados.map((c) => (
            <button key={c.Id} className={estaEn(c) ? 'on' : ''} onClick={() => alternar(c)}>
              <span className="pn-chk">{estaEn(c) ? '✓' : ''}</span>
              <div><b>{c.Nombre}</b>{c.Apodo && <em>“{c.Apodo}”</em>}</div>
              <span className="pn-est">⭐ {c.Visitas ?? 0}</span>
            </button>
          ))}
        </div>
        <label>O nombre libre (apodo, seña…) · Enter para agregar otro</label>
        <input value={valor.nombre ?? ''} onChange={(e) => onChange({ ...valor, nombre: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarLibre(); } }} placeholder="El Tigre, mesa ventana, Doña Marta…" />
        <div className="pn-van">
          <label>Van a abrir · {lis.length} {lis.length === 1 ? 'cuenta' : 'cuentas'}</label>
          <div className="pn-chips">
            {lis.length === 0 && <span className="pn-vacio">Marca clientes o escribe un nombre.</span>}
            {lis.map((x) => <span key={x.k} className="pn-chip">{x.cliente ? (x.nombre?.trim() || x.cliente.Apodo || x.cliente.Nombre) : x.nombre}
              <i onClick={() => onChange({ ...valor, lista: lis.filter((y) => y.k !== x.k) })}>✕</i></span>)}
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="pn-cabcli">
        <label>Seleccionar cliente</label>
        <button onClick={() => modoNuevo({ nombre: '', apodo: '' })}>+ Nuevo cliente</button>
      </div>
      <div className="pn-busca">
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o apodo…" />
        {busca && <span onClick={() => setBusca('')}>✕</span>}
      </div>
      <div className="pn-lista">
        {lista.length === 0 && <div className="pn-vacio">{clientes.length === 0 ? 'Aún no hay clientes. Crea uno con “+ Nuevo cliente”.' : 'Sin coincidencias.'}</div>}
        {lista.map((c) => (
          <button key={c.Id} className={cliente?.Id === c.Id ? 'on' : ''}
            onClick={() => { onChange({ ...valor, cliente: cliente?.Id === c.Id ? null : c }); setError(''); }}>
            <div><b>{c.Nombre}</b>{c.Apodo && <em>“{c.Apodo}”</em>}</div>
            <span className="pn-est">⭐ {c.Visitas ?? 0}</span>
          </button>
        ))}
      </div>
      {!soloCliente && (
        <>
          <label>O nombre libre (apodo, seña…)</label>
          <input value={nombre} onChange={(e) => onChange({ ...valor, nombre: e.target.value })}
            placeholder="El Tigre, mesa ventana, Doña Marta…" />
          <div className={`pn-reg ${cliente ? 'si' : ''}`}>
            {cliente ? `✓ Cliente registrado: ${cliente.Nombre}` : nombre.trim() ? 'Sin cliente: no podrá fiar' : ''}
          </div>
        </>
      )}
      {soloCliente && <div className={`pn-reg ${cliente ? 'si' : ''}`}>{cliente ? `✓ ${cliente.Nombre}` : ''}</div>}
    </>
  );
}
