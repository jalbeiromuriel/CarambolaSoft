// src/screens/Usuarios.jsx — Adm ⚙ → Usuarios (solo Admin). CRUD: crear, ver con filtros, editar, restablecer PIN, desactivar y eliminar (solo sin movimientos).
import { useState, useEffect, useCallback, useMemo } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import Avatar from '../components/Avatar.jsx';
import PinPad from '../components/PinPad.jsx';
import { CodigoRescate, PinAdmin } from './Auth.jsx';
import { listarUsuarios, crearUsuario, editarUsuario, restablecerPin, activar, nuevoCodigoRescate, eliminarUsuario, tieneMovimientos } from '../cuenta/authDb.js';
import { esAdmin, adminsActivos, pinValido, MIN_ADMINS } from '../cuenta/auth.js';
import { norm } from '../cuenta/catalogo.js';
import { useSesion } from '../components/Sesion.jsx';
import './Panel.css';
import './Auth.css';
import './Usuarios.css';

const cuando = (iso) => {
  if (!iso) return 'nunca';
  const d = new Date(iso); const hoy = new Date(); const ayer = new Date(Date.now() - 86400000);
  const h = d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === hoy.toDateString() ? `hoy · ${h}` : d.toDateString() === ayer.toDateString() ? `ayer · ${h}` : `${d.toLocaleDateString('es-CO')} · ${h}`;
};

export default function Usuarios() {
  const { usuario } = useSesion();
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);       // { modo:'nuevo'|'editar'|'pin', usuario?, nombre, rol, nota, pin, error }
  const [codigo, setCodigo] = useState(null);   // { codigo, nombre }
  const [borrar, setBorrar] = useState(null);   // usuario a eliminar (espera PIN de Admin)
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(async () => setLista(await listarUsuarios()), []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2800); };
  const admins = adminsActivos(lista);
  const [sinMov, setSinMov] = useState({});     // id → no tiene facturas (se puede eliminar)
  useEffect(() => { (async () => {
    const m = {}; for (const u of lista) m[u.Id] = !(await tieneMovimientos(u.Id)); setSinMov(m);
  })(); }, [lista]);

  const cuentas = { todos: lista.length, admin: lista.filter((u) => esAdmin(u.Rol)).length, empleado: lista.filter((u) => !esAdmin(u.Rol)).length, off: lista.filter((u) => u.Activo === false).length };
  const visibles = useMemo(() => lista.filter((u) => {
    if (q && !norm(u.Nombre).includes(norm(q))) return false;
    return filtro === 'todos' || (filtro === 'admin' && esAdmin(u.Rol)) || (filtro === 'empleado' && !esAdmin(u.Rol)) || (filtro === 'off' && u.Activo === false);
  }), [lista, q, filtro]);

  async function guardar() {
    try {
      if (form.modo === 'editar') {
        const r = await editarUsuario(form.usuario.Id, form);
        if (r.codigo) setCodigo({ codigo: r.codigo, nombre: r.usuario.Nombre });
        decir(`${r.usuario.Nombre} actualizado ✓`);
      } else {
        if (!pinValido(form.pin)) { setForm({ ...form, error: 'El PIN debe tener de 4 a 6 dígitos.' }); return; }
        if (form.modo === 'nuevo') {
          const r = await crearUsuario({ nombre: form.nombre, rol: form.rol, pin: form.pin, temporal: true });
          if (r.codigo) setCodigo({ codigo: r.codigo, nombre: r.usuario.Nombre });
          decir(`${r.usuario.Nombre} creado ✓`);
        } else { await restablecerPin(form.usuario.Id, form.pin); decir(`PIN de ${form.usuario.Nombre} restablecido ✓ (deberá cambiarlo)`); }
      }
      setForm(null); await cargar();
    } catch (e) { setForm((f) => ({ ...f, error: e.message })); }
  }
  async function alternar(u) {
    if (u.Activo !== false && esAdmin(u.Rol) && admins.length <= 1) { decir('No puedes desactivar al único Admin.'); return; }
    await activar(u.Id, u.Activo === false); await cargar();
  }
  async function eliminar() {
    try { await eliminarUsuario(borrar.Id); decir(`${borrar.Nombre} eliminado`); } catch (e) { decir(e.message); }
    setBorrar(null); await cargar();
  }
  const nuevo = () => setForm({ modo: 'nuevo', nombre: '', rol: 'EMPLEADO', nota: '', pin: '', error: '' });

  return (
    <div className="pn us">
      <Encabezado activo="adm" />
      <div className="pn-wrap">
        <div className="us-tit"><h2>Usuarios</h2><i /><button className="us-nuevo" onClick={nuevo}>＋ NUEVO USUARIO</button></div>
        {admins.length < MIN_ADMINS && (
          <div className="us-alerta">⚠ Solo hay {admins.length} Admin activo. Crea un <b>segundo Admin</b> (la Patrona): si uno olvida su PIN, el otro lo restablece.</div>
        )}
        <div className="us-bar">
          <input className="us-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar por nombre…" />
          {[['todos', 'Todos'], ['admin', 'Admin'], ['empleado', 'Empleado'], ['off', 'Desactivados']].map(([k, t]) => (
            <button key={k} className={`us-f ${filtro === k ? 'on' : ''}`} onClick={() => setFiltro(k)}>{t} · {cuentas[k]}</button>
          ))}
        </div>
        <div className="us-scroll">
          <table className="us-tabla">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th className="der">Acciones</th></tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={5} className="us-vacio">Sin resultados.</td></tr>}
              {visibles.map((u) => {
                const yo = u.Id === usuario.Id;
                return (
                  <tr key={u.Id} className={u.Activo === false ? 'off' : ''}>
                    <td><div className="us-u"><Avatar nombre={u.Nombre} rol={u.Rol} grande /><div><b>{u.Nombre}</b><small>{[yo && 'tú', u.Nota].filter(Boolean).join(' · ')}</small></div></div></td>
                    <td><span className={`us-pill ${esAdmin(u.Rol) ? 'a' : 'e'}`}>{esAdmin(u.Rol) ? 'ADMIN' : 'EMPLEADO'}</span></td>
                    <td><span className={`us-dot ${u.Activo === false ? 'o' : u.DebeCambiarPin ? 't' : ''}`} />{u.Activo === false ? 'Desactivado' : u.DebeCambiarPin ? 'PIN temporal' : 'Activo'}</td>
                    <td className="mut">{cuando(u.UltimoIngreso)}</td>
                    <td><div className="us-acc">
                      <button onClick={() => setForm({ modo: 'editar', usuario: u, nombre: u.Nombre, rol: u.Rol, nota: u.Nota ?? '', error: '' })}>✏️ Editar</button>
                      <button onClick={() => setForm({ modo: 'pin', usuario: u, pin: '', error: '' })}>🔑 PIN</button>
                      {yo && esAdmin(u.Rol) && <button onClick={async () => setCodigo({ codigo: await nuevoCodigoRescate(u.Id), nombre: u.Nombre })}>🧾 Código de rescate</button>}
                      {!yo && <button className="r" onClick={() => alternar(u)}>{u.Activo === false ? '▶ Activar' : '⏻ Desactivar'}</button>}
                      {!yo && sinMov[u.Id] && <button className="r" onClick={() => setBorrar(u)}>🗑 Eliminar</button>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="pn-modal">
            <h3>{form.modo === 'nuevo' ? 'Nuevo usuario' : form.modo === 'editar' ? `Editar · ${form.usuario.Nombre}` : `Restablecer PIN · ${form.usuario.Nombre}`}</h3>
            {form.modo !== 'pin' && (
              <>
                <label>Nombre</label>
                <input autoFocus value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                <label>Rol</label>
                <div className="pn-elegir">
                  <button className={form.rol === 'EMPLEADO' ? 'on' : ''} onClick={() => setForm({ ...form, rol: 'EMPLEADO' })}>Empleado</button>
                  <button className={form.rol === 'ADMIN' ? 'on' : ''} onClick={() => setForm({ ...form, rol: 'ADMIN' })}>Admin</button>
                </div>
                <label>Nota (opcional)</label>
                <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Ej: Barra · noches" />
              </>
            )}
            {form.modo !== 'editar' && (
              <>
                <label>PIN temporal (4 a 6 dígitos) — la persona lo cambia al entrar</label>
                <PinPad valor={form.pin} onChange={(pin) => setForm((f) => ({ ...f, pin }))} onEnter={guardar} />
              </>
            )}
            {form.error && <div className="pn-err">{form.error}</div>}
            <div className="pn-acc"><button className="no" onClick={() => setForm(null)}>CANCELAR</button><button className="si" onClick={guardar}>GUARDAR</button></div>
          </div>
        </div>
      )}
      {codigo && <div className="pn-velo alto"><div className="pn-modal"><CodigoRescate {...codigo} seguir={() => setCodigo(null)} /></div></div>}
      {borrar && <PinAdmin motivo={`Vas a eliminar a ${borrar.Nombre} (nunca cobró nada). Un Admin digita su PIN para confirmar.`} cancelar={() => setBorrar(null)} ok={eliminar} />}
      {aviso && <div className="ms-aviso">{aviso}</div>}
    </div>
  );
}
