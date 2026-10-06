// ============================================================
//  A4 · Paso 7 — IndicadorSync (discreto: silencio = todo bien)
//  Vive en components/. Solo LEE la META 'sync-estado' que
//  llena el orquestador. Único disparo propio: reintento manual.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { leerMeta } from '../db/repository.js';        // ⚠ mismo contrato que el orquestador
import { sincronizarAhora } from '../db/sync.js';

const CLAVE_META       = 'sync-estado';   // NO la clave del cursor de bajar()
const INTERVALO_LECTURA = 3000;           // ms — sondeo ligero de META

export default function IndicadorSync() {
  // 'ok' | 'offline' | 'error' | 'recuperado'
  const [estado, setEstado] = useState('ok');
  const teniaProblema   = useRef(false);   // veníamos mal → para detectar recuperación
  const timerRecuperado = useRef(null);

  useEffect(() => {
    let vivo = true;

    async function evaluar() {
      const online = navigator.onLine;
      let fallos = 0;
      try {
        const meta = await leerMeta(CLAVE_META);
        fallos = meta?.fallosConsecutivos ?? 0;
      } catch { fallos = 0; }
      if (!vivo) return;

      // offline manda sobre error: "estás sin internet" explica el resto.
      const nuevo = !online ? 'offline' : (fallos > 0 ? 'error' : 'ok');

      // Recuperación: veníamos con problema y ahora todo bien → verde 2s.
      if (nuevo === 'ok' && teniaProblema.current) {
        teniaProblema.current = false;
        setEstado('recuperado');
        clearTimeout(timerRecuperado.current);
        timerRecuperado.current = setTimeout(() => { if (vivo) setEstado('ok'); }, 2000);
        return;
      }

      if (nuevo !== 'ok') teniaProblema.current = true;
      // No pisar el chip verde mientras corre su ventana de 2s.
      setEstado((prev) => (prev === 'recuperado' && nuevo === 'ok') ? prev : nuevo);
    }

    evaluar();
    const id = setInterval(evaluar, INTERVALO_LECTURA);
    window.addEventListener('online', evaluar);
    window.addEventListener('offline', evaluar);

    return () => {
      vivo = false;
      clearInterval(id);
      clearTimeout(timerRecuperado.current);
      window.removeEventListener('online', evaluar);
      window.removeEventListener('offline', evaluar);
    };
  }, []);

  if (estado === 'ok') return null;   // silencio = todo bien

  const base = {
    position: 'fixed', bottom: 16, right: 16, zIndex: 50,
    display: 'inline-flex', alignItems: 'center', gap: 8,
    borderRadius: 999, padding: '7px 13px',
    fontSize: 12, fontWeight: 500, border: '0.5px solid',
    animation: 'sync-in 220ms ease-out',
  };

  if (estado === 'offline') {
    return (
      <div style={{ ...base, background: 'rgba(239,159,39,0.12)', borderColor: '#EF9F27', color: '#FAC775' }}>
        <span style={{ fontSize: 15, color: '#EF9F27' }} aria-hidden="true">⚠</span>
        Sin conexión · guardando aquí
      </div>
    );
  }

  if (estado === 'recuperado') {
    return (
      <div style={{ ...base, background: 'rgba(74,217,138,0.12)', borderColor: '#4AD98A', color: '#8FE3B4' }}>
        <span style={{ fontSize: 15, color: '#4AD98A' }} aria-hidden="true">✓</span>
        Sincronizado
      </div>
    );
  }

  // 'error' → tocable, dispara reintento manual
  return (
    <button
      onClick={() => sincronizarAhora('reintento-manual')}
      style={{ ...base, background: 'rgba(226,75,74,0.12)', borderColor: '#E24B4A', color: '#F09595', cursor: 'pointer' }}
    >
      <span style={{ fontSize: 15, color: '#E24B4A' }} aria-hidden="true">⚠</span>
      Sync con problemas · toca para reintentar
    </button>
  );
}
