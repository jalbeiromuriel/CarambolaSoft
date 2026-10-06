// Clientes — catálogo de clientes del Parche. Réplica de MeroParche_Clientes.html.
// El teléfono es SOLO de administrador: sin PIN no se muestra ni se edita (y no se toca al guardar).
import { useState, useEffect, useMemo, useRef } from 'react';
import { listarClientes, guardarCliente } from '../../marcador/datos.js';

export default function Clientes({ admin, irInicio, irMarcador }) {
  const [clientes, setClientes] = useState([]);
  const [q, setQ] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [form, setForm] = useState(null);          // null = cerrado; {Id?, Nombre, Apodo, Telefono}
  const [error, setError] = useState('');
  const [fallo, setFallo] = useState('');
  const nombreRef = useRef(null);

  const recargar = () => listarClientes().then(setClientes).catch((e) => setFallo(String(e)));
  useEffect(() => { recargar(); }, []);
  useEffect(() => { if (form) setTimeout(() => nombreRef.current?.focus(), 50); }, [form === null]); // eslint-disable-line

  const activos = clientes.filter((c) => c.Activo !== false).length;
  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return clientes.filter((c) => {
      if (!verInactivos && c.Activo === false) return false;
      return !t || `${c.Nombre ?? ''} ${c.Apodo ?? ''}`.toLowerCase().includes(t);
    });
  }, [clientes, q, verInactivos]);

  const abrir = (c) => { setError(''); setForm(c ? { Id: c.Id, Nombre: c.Nombre ?? '', Apodo: c.Apodo ?? '', Telefono: c.Telefono ?? '' } : { Nombre: '', Apodo: '', Telefono: '' }); };

  async function guardar() {
    const Nombre = form.Nombre.trim();
    if (!Nombre) return setError('El nombre es obligatorio.');
    const previo = form.Id ? clientes.find((c) => c.Id === form.Id) : null;
    try {
      await guardarCliente({
        Id: form.Id, Nombre, Apodo: form.Apodo,
        Telefono: admin.activo ? form.Telefono : undefined,   // sin PIN: se conserva el que había
        Activo: previo ? previo.Activo !== false : true,
      });
      setForm(null);
      recargar();
    } catch (e) { setError(`No se pudo guardar: ${e}`); }
  }

  async function alternar(c) {
    await guardarCliente({ Id: c.Id, Nombre: c.Nombre, Apodo: c.Apodo, Telefono: undefined, Activo: c.Activo === false });
    recargar();
  }

  async function verTelefonos() { if (!admin.activo) await admin.pedir('Los teléfonos de los clientes son solo para el administrador.'); }

  return (
    <div className="ct-clientes">
      <header>
        <span className="ct-balls"><b></b><b></b><b></b></span>
        <h1>MERO PARCHE<small>CLIENTES</small></h1>
        <span className="ct-count">ACTIVOS: <b>{activos}</b> / <span>{clientes.length}</span></span>
        <div className="ct-nav"><a onClick={irInicio} style={{ cursor: 'pointer' }}>◂ Inicio</a><a className="mk" onClick={irMarcador} style={{ cursor: 'pointer' }}>Marcador ▸</a></div>
      </header>

      {fallo && <div className="ct-warn" style={{ display: 'block' }}>⚠ {fallo}</div>}

      <div className="ct-toolbar">
        <input className="ct-search" placeholder="Buscar por nombre o apodo…" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="ct-togg"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver inactivos</label>
        {admin.activo
          ? <button className="ct-togg" style={{ background: 'transparent', border: '1px solid var(--verde)', color: 'var(--verde)', borderRadius: 9, padding: '8px 12px', cursor: 'pointer' }} onClick={admin.bloquear}>🔓 ADMIN · bloquear</button>
          : <button className="ct-togg" style={{ background: 'transparent', border: '1px solid var(--amarillo)', color: 'var(--amarillo)', borderRadius: 9, padding: '8px 12px', cursor: 'pointer' }} onClick={verTelefonos}>🔒 Ver teléfonos (ADM)</button>}
        <button className="ct-nuevo" onClick={() => abrir(null)}>＋ NUEVO CLIENTE</button>
      </div>

      <div className="ct-wrap">
        {clientes.length === 0 && <div className="ct-empty">Aún no hay clientes.<br />Toca <b>＋ NUEVO CLIENTE</b> para registrar al primero.</div>}
        {clientes.length > 0 && filas.length === 0 && <div className="ct-empty">Sin resultados para la búsqueda.</div>}
        {filas.length > 0 && (
          <table>
            <thead><tr><th>Nombre</th><th>Apodo</th>{admin.activo && <th>Teléfono</th>}<th>Estado</th><th style={{ textAlign: 'right' }}>Acciones</th></tr></thead>
            <tbody>
              {filas.map((c) => {
                const off = c.Activo === false;
                return (
                  <tr key={c.Id} className={off ? 'inact' : ''}>
                    <td className="ct-nm">{c.Nombre}</td>
                    <td className="ct-ap">{c.Apodo || '—'}</td>
                    {admin.activo && <td>{c.Telefono || '—'}</td>}
                    <td><span className={`ct-estado ${off ? 'off' : ''}`}>{off ? 'INACTIVO' : 'ACTIVO'}</span></td>
                    <td><div className="ct-acts"><button className="ct-ed" onClick={() => abrir(c)}>Editar</button><button className="ct-tg" onClick={() => alternar(c)}>{off ? 'Activar' : 'Desactivar'}</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <footer>Los clientes se guardan en esta tablet y se sincronizan con la nube · CarambolaSoft · Mero Parche</footer>

      <div className={`ct-modal ${form ? 'on' : ''}`} onClick={(e) => e.target === e.currentTarget && setForm(null)}>
        {form && (
          <div className="ct-mcard">
            <h4>{form.Id ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'} <span className="ct-mx" onClick={() => setForm(null)}>✕</span></h4>
            <div className="ct-field"><label>Nombre *</label><input ref={nombreRef} autoComplete="off" value={form.Nombre} onChange={(e) => setForm({ ...form, Nombre: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && guardar()} /></div>
            <div className="ct-field"><label>Apodo (opcional)</label><input autoComplete="off" placeholder="Ej: El Zurdo" value={form.Apodo} onChange={(e) => setForm({ ...form, Apodo: e.target.value })} /></div>
            {admin.activo && <div className="ct-field"><label>Teléfono (opcional · solo administrador)</label><input autoComplete="off" inputMode="tel" value={form.Telefono} onChange={(e) => setForm({ ...form, Telefono: e.target.value })} /></div>}
            <div className="ct-ferr">{error}</div>
            <div className="ct-mbtns"><button className="ct-save" onClick={guardar}>GUARDAR</button><button className="ct-cancel" onClick={() => setForm(null)}>CANCELAR</button></div>
          </div>
        )}
      </div>
      {admin.modal}
    </div>
  );
}
