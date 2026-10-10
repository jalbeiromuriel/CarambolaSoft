// src/screens/Auth.jsx — Primer uso (crear Admin), ingreso con PIN, cambio obligatorio y autorización de Admin.
import { useState, useEffect } from 'react';
import LogoBola9 from '../components/LogoBola9.jsx';
import Avatar from '../components/Avatar.jsx';
import PinPad from '../components/PinPad.jsx';
import { crearUsuario, verificarLogin, cambiarPin, rescatar, autorizaAdmin } from '../cuenta/authDb.js';
import { pinValido, esAdmin, estaBloqueado, msBloqueo } from '../cuenta/auth.js';
import { mmss } from '../cuenta/garita.js';
import './Panel.css';
import './Auth.css';

const Marco = ({ children }) => (
  <div className="pn au"><div className="au-wrap"><LogoBola9 size={64} /><div className="pn-t1">Mero Parche</div>{children}</div></div>
);

/** Código de rescate: se muestra una sola vez y hay que guardarlo. */
export function CodigoRescate({ codigo, nombre, seguir }) {
  return (
    <div className="au-card">
      <h3>🔑 Código de rescate de {nombre}</h3>
      <div className="au-cod">{codigo}</div>
      <p className="au-nota">Si algún día olvidas tu PIN, este código te deja crear uno nuevo. <b>Imprímelo o anótalo y guárdalo en un sobre</b> (caja fuerte). Se muestra <b>una sola vez</b> y sirve una sola vez.</p>
      <div className="pn-acc"><button className="no" onClick={() => window.print()}>🖨 IMPRIMIR</button><button className="si" onClick={seguir}>YA LO GUARDÉ</button></div>
    </div>
  );
}

/** Primera vez: no hay usuarios → se crea el primer ADMIN. */
export function PrimerUso({ listo }) {
  const [nombre, setNombre] = useState(''); const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('');
  const [paso, setPaso] = useState(1); const [error, setError] = useState(''); const [creado, setCreado] = useState(null);

  async function crear() {
    if (pin !== pin2) { setError('Los PIN no coinciden.'); return; }
    try { setCreado(await crearUsuario({ nombre, rol: 'ADMIN', pin })); } catch (e) { setError(e.message); }
  }
  if (creado) return <Marco><CodigoRescate codigo={creado.codigo} nombre={creado.usuario.Nombre} seguir={() => listo(creado.usuario)} /></Marco>;
  return (
    <Marco>
      <div className="au-card">
        <h3>Bienvenido · crea el primer Admin</h3>
        {paso === 1 ? (
          <>
            <label>Nombre</label>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Albeiro" />
            <div className="pn-acc"><button className="si" onClick={() => (nombre.trim() ? (setError(''), setPaso(2)) : setError('Escribe el nombre.'))}>SIGUIENTE</button></div>
          </>
        ) : paso === 2 ? (
          <>
            <label>PIN de 4 a 6 dígitos</label>
            <PinPad valor={pin} onChange={setPin} onEnter={() => (pinValido(pin) ? (setError(''), setPaso(3)) : setError('4 a 6 dígitos.'))} />
          </>
        ) : (
          <>
            <label>Repite el PIN</label>
            <PinPad valor={pin2} onChange={setPin2} onEnter={crear} />
          </>
        )}
        {error && <div className="pn-err">{error}</div>}
        <p className="au-nota">Recomendado: crea después un <b>segundo Admin</b> (la Patrona) en Adm ⚙ → Usuarios.</p>
      </div>
    </Marco>
  );
}

/** Quién eres + PIN. */
export function Login({ usuarios, entrar }) {
  const activos = usuarios.filter((u) => u.Activo !== false);
  const [sel, setSel] = useState(null); const [pin, setPin] = useState(''); const [error, setError] = useState('');
  const [olvide, setOlvide] = useState(false); const [ahora, setAhora] = useState(Date.now());
  const [bloq, setBloq] = useState(null);       // usuario bloqueado (con BloqueadoHasta)
  const [rescate, setRescate] = useState({ codigo: '', pin: '' }); const [nuevoCod, setNuevoCod] = useState(null);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const bloqueado = bloq && estaBloqueado(bloq, ahora);

  async function ingresar() {
    if (!sel || pin.length < 4) return;
    const r = await verificarLogin(sel.Id, pin);
    setPin('');
    if (r.usuario) { entrar(r.usuario); return; }
    if (r.bloqueado) { setBloq(r.bloqueado); setError(''); return; }
    setError(r.restantes ? `PIN incorrecto · te quedan ${r.restantes} ${r.restantes === 1 ? 'intento' : 'intentos'}` : r.error);
  }
  async function usarRescate() {
    const r = await rescatar(sel.Id, rescate.codigo, rescate.pin);
    if (r.error) { setError(r.error); return; }
    setNuevoCod(r.codigo);
  }

  if (nuevoCod) return <Marco><CodigoRescate codigo={nuevoCod} nombre={sel.Nombre} seguir={() => { setNuevoCod(null); setOlvide(false); setError(''); setBloq(null); }} /></Marco>;
  return (
    <Marco>
      <div className="au-card">
        <h3>¿Quién eres?</h3>
        <div className="au-quien">
          {activos.map((u) => (
            <button key={u.Id} className={sel?.Id === u.Id ? 'on' : ''} onClick={() => { setSel(u); setPin(''); setError(''); setOlvide(false); setBloq(estaBloqueado(u) ? u : null); }}>
              <Avatar nombre={u.Nombre} rol={u.Rol} grande />{u.Nombre}<small>{esAdmin(u.Rol) ? 'Admin' : 'Empleado'}</small>
            </button>
          ))}
        </div>
        {sel && !olvide && (
          <>
            {bloqueado
              ? <div className="pn-err">🔒 Bloqueado por intentos fallidos. Inténtalo en {mmss(msBloqueo(bloq, ahora))}.</div>
              : <PinPad valor={pin} onChange={setPin} onEnter={ingresar} />}
            {error && !bloqueado && <div className="pn-err">{error}</div>}
            <button className="au-link" onClick={() => { setOlvide(true); setError(''); }}>¿Olvidaste tu PIN?</button>
          </>
        )}
        {sel && olvide && (
          esAdmin(sel.Rol) ? (
            <>
              <label>Código de rescate</label>
              <input value={rescate.codigo} onChange={(e) => setRescate({ ...rescate, codigo: e.target.value })} placeholder="XXXX-XXXX-XXXX" />
              <label>PIN nuevo (4 a 6 dígitos)</label>
              <input inputMode="numeric" type="password" value={rescate.pin} onChange={(e) => setRescate({ ...rescate, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
              {error && <div className="pn-err">{error}</div>}
              <div className="pn-acc"><button className="no" onClick={() => setOlvide(false)}>VOLVER</button><button className="si" onClick={usarRescate}>CAMBIAR PIN</button></div>
              <p className="au-nota">¿Sin código? Otro Admin te restablece el PIN desde Adm ⚙ → Usuarios.</p>
            </>
          ) : (
            <>
              <p className="au-nota">Pídele a <b>Albeiro o Dahiana</b> que te restablezca el PIN (Adm ⚙ → Usuarios). Te darán uno temporal y el sistema te pedirá cambiarlo.</p>
              <div className="pn-acc"><button className="no" onClick={() => setOlvide(false)}>VOLVER</button></div>
            </>
          )
        )}
      </div>
    </Marco>
  );
}

/** Tras un restablecimiento: obliga a elegir un PIN propio. */
export function CambioObligatorio({ usuario, listo, salir }) {
  const [pin, setPin] = useState(''); const [pin2, setPin2] = useState(''); const [paso, setPaso] = useState(1); const [error, setError] = useState('');
  async function guardar() {
    if (pin !== pin2) { setError('No coinciden. Intenta de nuevo.'); setPin(''); setPin2(''); setPaso(1); return; }
    listo(await cambiarPin(usuario.Id, pin));
  }
  return (
    <Marco>
      <div className="au-card">
        <h3>{usuario.Nombre}, elige tu PIN</h3>
        <p className="au-nota">Tu PIN era temporal. Escoge uno que solo tú sepas (4 a 6 dígitos).</p>
        {paso === 1
          ? <PinPad valor={pin} onChange={setPin} onEnter={() => (pinValido(pin) ? (setError(''), setPaso(2)) : setError('4 a 6 dígitos.'))} />
          : <><label>Repítelo</label><PinPad valor={pin2} onChange={setPin2} onEnter={guardar} /></>}
        {error && <div className="pn-err">{error}</div>}
        {salir && <button className="au-volver" onClick={salir}>← No soy {usuario.Nombre}: cambiar de usuario</button>}
      </div>
    </Marco>
  );
}

/** Ventana para que un Admin autorice con su PIN una acción restringida (ej: fiar a un Empleado). */
export function PinAdmin({ motivo, ok, cancelar }) {
  const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [fallos, setFallos] = useState(0);
  async function validar() {
    const a = await autorizaAdmin(pin);
    if (a) { ok(a); return; }
    setPin(''); const n = fallos + 1; setFallos(n);
    if (n >= 3) { cancelar(); return; }
    setError('PIN de Admin incorrecto.');
  }
  return (
    <div className="pn-velo alto" onClick={(e) => e.target === e.currentTarget && cancelar()}>
      <div className="pn-modal au-modal">
        <h3>🔒 Autoriza un Admin</h3>
        <p className="au-nota">{motivo}</p>
        <PinPad valor={pin} onChange={setPin} onEnter={validar} />
        {error && <div className="pn-err">{error}</div>}
        <div className="pn-acc"><button className="no" onClick={cancelar}>CANCELAR</button></div>
      </div>
    </div>
  );
}
