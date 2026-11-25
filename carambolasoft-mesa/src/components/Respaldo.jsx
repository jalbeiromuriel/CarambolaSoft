// src/components/Respaldo.jsx — Tarjeta de Configuración: descargar respaldo y restaurar desde archivo (solo Admin).
// [RIESGO] Restaurar REEMPLAZA todo lo de este PC. Pide confirmación escrita y recarga la app al terminar.
import { useEffect, useRef, useState } from 'react';
import { leerMeta, escribirMeta } from '../db/repository.js';
import { exportarTodo, descargar, revisar, restaurarTodo, pedirPersistencia } from '../db/respaldo.js';
import { resumenRespaldo, nombreArchivo } from '../db/respaldoLogica.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const cuando = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Respaldo() {
  const [ultimo, setUltimo] = useState(null);
  const [protegido, setProtegido] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [archivo, setArchivo] = useState(null);       // { r, resumen }
  const [frase, setFrase] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    leerMeta('respaldo.ultimo').then((u) => setUltimo(u ?? null));
    pedirPersistencia().then(setProtegido);
  }, []);

  async function bajar() {
    setError(''); setOk(''); setOcupado(true);
    try {
      const r = await exportarTodo();
      descargar(r, nombreArchivo());
      await escribirMeta('respaldo.ultimo', r.fecha);
      setUltimo(r.fecha); setOk('✓ Respaldo descargado. Guárdalo en Drive o en una USB.');
    } catch (e) { setError(`No se pudo hacer el respaldo: ${e.message ?? e}`); }
    finally { setOcupado(false); }
  }

  async function elegir(e) {
    setError(''); setOk(''); setArchivo(null); setFrase('');
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const r = JSON.parse(await f.text());
      const motivo = revisar(r);
      if (motivo) return setError(motivo);
      setArchivo({ r, resumen: resumenRespaldo(r), nombre: f.name });
    } catch { setError('El archivo no se pudo leer: no es un respaldo de CarambolaSoft.'); }
  }

  async function restaurar() {
    if (frase.trim().toUpperCase() !== 'RESTAURAR' || ocupado) return;
    setOcupado(true); setError('');
    try {
      await restaurarTodo(archivo.r);
      window.location.reload();
    } catch (e) { setError(`No se restauró nada: ${e.message ?? e}`); setOcupado(false); }
  }

  const viejo = !ultimo || Date.now() - Date.parse(ultimo) > DIA_MS;
  return (
    <section className="cf-c cf-resp">
      <h3>💾 Respaldo de datos</h3>
      <p>Cuentas, caja, fiados, clientes y usuarios viven en este PC. Descarga un respaldo cada noche después del cierre y guárdalo fuera del PC.</p>
      <div className={`cf-nota ${viejo ? '' : 'bien'}`}>{ultimo ? `Último respaldo: ${cuando(ultimo)}` : 'Todavía no se ha hecho ningún respaldo en este PC.'}{viejo ? ' · Haz uno hoy.' : ''}</div>
      {protegido === false && <div className="cf-nota">El navegador no confirmó que protege estos datos. No borres los datos de navegación de Chrome.</div>}
      {error && <div className="cf-err" style={{ marginTop: 12 }}>{error}</div>}
      {ok && <div className="cf-hecho bloque">{ok}</div>}
      <div className="cf-f" style={{ marginTop: 14 }}>
        <button className="cf-ok" disabled={ocupado} onClick={bajar}>Descargar respaldo</button>
        <button className="cf-sec" disabled={ocupado} onClick={() => input.current?.click()}>Restaurar desde archivo…</button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={elegir} />
      </div>

      {archivo && (
        <div className="cf-restaurar">
          <b>Restaurar «{archivo.nombre}»</b>
          <span>Respaldo del {cuando(archivo.resumen.fecha)} · {archivo.resumen.total} registros ({archivo.resumen.cuentas} cuentas, {archivo.resumen.facturas} facturas, {archivo.resumen.clientes} clientes, {archivo.resumen.productos} productos).</span>
          <span className="peligro">Esto BORRA todo lo que hay hoy en este PC y lo cambia por el respaldo. No se puede deshacer: si tienes dudas, descarga primero un respaldo de lo actual.</span>
          <label htmlFor="cf-frase">Escribe RESTAURAR para confirmar</label>
          <div className="cf-f">
            <input id="cf-frase" className="cf-frase" autoComplete="off" value={frase} onChange={(e) => setFrase(e.target.value)} />
            <button className="cf-peligro" disabled={frase.trim().toUpperCase() !== 'RESTAURAR' || ocupado} onClick={restaurar}>Reemplazar todo</button>
            <button className="cf-sec" disabled={ocupado} onClick={() => { setArchivo(null); setFrase(''); }}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
