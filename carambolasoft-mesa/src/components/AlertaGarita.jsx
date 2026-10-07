// src/components/AlertaGarita.jsx — Aviso global: 5 min antes de cumplir la hora de la garita suena y sale un banner.
import { useState, useEffect, useRef } from 'react';
import { getAll } from '../db/repository.js';
import { estadoReloj } from '../cuenta/garita.js';

function pitar() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + d); g.gain.setValueAtTime(0, ctx.currentTime + d + 0.15);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
    });
  } catch { /* sin audio: queda el banner */ }
}

export default function AlertaGarita({ visible, irACuenta }) {
  const [pend, setPend] = useState(null); // { relojId, cuentaId }
  const sonados = useRef(new Set());

  useEffect(() => {
    let vivo = true;
    const mirar = async () => {
      const ahora = Date.now();
      const relojes = (await getAll('GARITAS_RELOJ')).filter((r) => r.Activa && estadoReloj(r, ahora).enAviso);
      if (!vivo) return;
      if (!relojes.length) { setPend(null); return; }
      const r = relojes[0];
      const clave = `${r.Id}:${r.Cobros}`;
      if (!sonados.current.has(clave)) { sonados.current.add(clave); pitar(); }
      const c = (await getAll('CUENTAS')).find((x) => x.GaritaRelojId === r.Id && x.Estado === 'ABIERTA');
      if (vivo) setPend(c ? { relojId: r.Id, cuentaId: c.Id } : null);
    };
    mirar();
    const t = setInterval(mirar, 2000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  if (!pend || !visible) return null;
  return (
    <button className="al-garita" onClick={() => irACuenta(pend.cuentaId)}>
      ⏰ GARITA: cumple la hora — toca para cobrar
    </button>
  );
}
