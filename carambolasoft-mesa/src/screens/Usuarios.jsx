// src/screens/Usuarios.jsx — Adm ⚙ → Usuarios (solo Admin): crear, restablecer PIN, activar/desactivar, código de rescate.
import { useState, useEffect, useCallback } from 'react';
import Encabezado from '../components/Encabezado.jsx';
import PinPad from '../components/PinPad.jsx';
import { CodigoRescate } from './Auth.jsx';
import { listarUsuarios, crearUsuario, restablecerPin, activar, nuevoCodigoRescate } from '../cuenta/authDb.js';
import { esAdmin, adminsActivos, pinValido, MIN_ADMINS } from '../cuenta/auth.js';
import { useSesion } from '../components/Sesion.jsx';
import './Panel.css';
import './Auth.css';
import './Usuarios.css';

export default function Usuarios() {
  const { usuario } = useSesion();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(null);       // { modo:'nuevo'|'reset', usuario?, nombre, rol, pin, error }
  const [codigo, setCodigo] = useState(null);   // { codigo, nombre }
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(async () => setLista(await listarUsuarios()), []);
  useEffect(() => { cargar(); }, [cargar]);
  const decir = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2600); };
  const admins = adminsActivos(lista);

  async function guardar() {
    if (!pinValido(form.pin)) { setForm({ ...form, error: 'El PIN debe tener de 4 a 6 dígitos.' }); return; }
    try {
      if (form.modo === 'nuevo') {
        const r = await crearUsuario({ nombre: form.nombre, rol: form.rol, pin: form.pin, temporal: true });
        if (r.codigo) setCodigo({ codigo: r.codigo, nombre: r.usuario.Nombre });
        decir(`${r.usuario.Nombre} creado ✓`);
      } else { await restablecerPin(form.usuario.Id, form.pin); decir(`PIN de ${form.usuario.Nombre} restablecido ✓ (deberá cambiarlo)`); }
      setForm(null); await cargar();
    } catch (e) { setForm({ ...form, error: e.message }); }
  }
  async function alternar(u) {
    if (u.Activo !== false && esAdmin(u.Rol) && admins.length <= 1) { decir('No puedes desactivar al único Admin.'); return; }
    if (u.Id === usuario.Id) { decir('No puedes desactivarte a ti mismo.'); return; }
    await activar(u.Id, u.Activo === false); await cargar();
  }

  return (
    <div className="pn us">
      <Encabezado activo="adm" />
      <div className="pn-wrap">
        <div className="pn-sec">Adm ⚙ · Usuarios<i /><button className="pn-chipbtn" onClick={() => setForm({ modo: 'nuevo', nombre: '', rol: 'EMPLEADO', pin: '', error: '' })}>＋ NUEVO USUARIO</button></div>
        {admins.length < MIN_ADMINS && (
          <div className="us-alerta">⚠ Solo hay {admins.length} Admin activo. Crea un <b>segundo Admin</b> (la Patrona): si uno olvida su PIN, el otro lo restablece.</div>
        )}
        <div className="us-lista">
          {lista.map((u) => (
            <div key={u.Id} className={`us-fila ${u.Activo === false ? 'off' : ''}`}>
              <span className="e">{esAdmin(u.Rol) ? '👑' : '🧑'}</span>
              <div className="n"><b>{u.Nombre}</b><small>{esAdmin(u.Rol) ? 'Admin' : 'Empleado'}{u.Activo === false ? ' · desactivado' : ''}{u.DebeCambiarPin ? ' · PIN temporal' : ''}{u.Id === usuario.Id ? ' · tú' : ''}</small></div>
              <button onClick={() => setForm({ modo: 'reset', usuario: u, pin: '', error: '' })}>Restablecer PIN</button>
              {u.Id === usuario.Id && esAdmin(u.Rol) && <button onClick={async () => setCodigo({ codigo: await nuevoCodigoRescate(u.Id), nombre: u.Nombre })}>Nuevo código de rescate</button>}
              {u.Id !== usuario.Id && <button className="r" onClick={() => alternar(u)}>{u.Activo === false ? 'Activar' : 'Desactivar'}</button>}
            </div>
          ))}
        </div>
      </div>

      {form && (
        <div className="pn-velo" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="pn-modal">
            <h3>{form.modo === 'nuevo' ? 'Nuevo usuario' : `Restablecer PIN · ${form.usuario.Nombre}`}</h3>
            {form.modo === 'nuevo' && (
              <>
                <label>Nombre</label>
                <input autoFocus value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                <label>Rol</label>
                <div className="pn-elegir">
                  <button className={form.rol === 'EMPLEADO' ? 'on' : ''} onClick={() => setForm({ ...form, rol: 'EMPLEADO' })}>🧑 Empleado</button>
                  <button className={form.rol === 'ADMIN' ? 'on' : ''} onClick={() => setForm({ ...form, rol: 'ADMIN' })}>👑 Admin</button>
                </div>
              </>
            )}
            <label>PIN temporal (4 a 6 dígitos) — la persona lo cambia al entrar</label>
            <PinPad valor={form.pin} onChange={(pin) => setForm((f) => ({ ...f, pin }))} onEnter={guardar} deshabilitado={false} />
            {form.error && <div className="pn-err">{form.error}</div>}
            <div className="pn-acc"><button className="no" onClick={() => setForm(null)}>CANCELAR</button><button className="si" onClick={guardar}>GUARDAR</button></div>
          </div>
        </div>
      )}
      {codigo && <div className="pn-velo alto"><div className="pn-modal"><CodigoRescate {...codigo} seguir={() => setCodigo(null)} /></div></div>}
      {aviso && <div className="ms-aviso">{aviso}</div>}
    </div>
  );
}
