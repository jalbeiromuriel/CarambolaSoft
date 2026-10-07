// src/components/SelectorCliente.jsx — Elegir cliente registrado (⭐ visitas), crear uno rápido o usar nombre libre.
// Valor controlado: { cliente, nombre }. Estilos: clases pn-* de Panel.css (se importa allí).
import { useState, useEffect } from 'react';
import { put } from '../db/repository.js';
import { listarClientes, guardarCliente } from '../marcador/datos.js';
import { norm } from '../cuenta/catalogo.js';

/** Etiqueta de la cuenta: nombre libre, si no apodo o nombre del cliente. */
export const etiquetaDe = ({ cliente, nombre }) => nombre.trim() || cliente?.Apodo || cliente?.Nombre || '';

/** ⭐ suma una visita al cliente elegido. */
export const sumarVisita = (cliente) => cliente && put('CLIENTES', { ...cliente, Visitas: (cliente.Visitas ?? 0) + 1 });

export default function SelectorCliente({ valor, onChange, onModoNuevo, error, setError }) {
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
    onChange({ ...valor, cliente: c });
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
      <label>O nombre libre (apodo, seña…)</label>
      <input value={nombre} onChange={(e) => onChange({ ...valor, nombre: e.target.value })}
        placeholder="El Tigre, mesa ventana, Doña Marta…" />
      <div className={`pn-reg ${cliente ? 'si' : ''}`}>
        {cliente ? `✓ Cliente registrado: ${cliente.Nombre}` : nombre.trim() ? 'Sin cliente: no podrá fiar' : ''}
      </div>
    </>
  );
}
