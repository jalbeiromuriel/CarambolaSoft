// Replay de la partida a pantalla completa: se reproduce en bucle y se puede grabar como video para compartir.
import { useEffect, useRef, useState } from 'react';
import { W, H, dibujar, plan, grabarReplay, puedeGrabar } from '../../marcador/replay.js';
import { compartirTarjeta } from '../../marcador/tarjeta.js';

const boton = (color) => ({ background: 'rgba(0,0,0,.45)', border: `1px solid ${color}`, color, borderRadius: 10, padding: '11px 16px', fontWeight: 700, letterSpacing: 1, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 });

export default function Replay({ d, onCerrar }) {
  const ref = useRef(null);
  const reinicio = useRef(performance.now());
  const [grabando, setGrabando] = useState(null);     // null | 0..1
  const [msg, setMsg] = useState('');
  const total = plan(d).total + 1.2;

  useEffect(() => {
    const c = ref.current.getContext('2d');
    let vivo = true, raf;
    const bucle = () => {
      if (!vivo) return;
      dibujar(c, d, ((performance.now() - reinicio.current) / 1000) % total);
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => { vivo = false; cancelAnimationFrame(raf); };
  }, [d, total]);

  async function compartirVideo() {
    setMsg(''); setGrabando(0);
    try {
      const { blob, ext } = await grabarReplay(d, setGrabando);
      const archivo = new File([blob], `mero-parche-mesa-${d.mesa}.${ext}`, { type: blob.type });
      if (navigator.canShare?.({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], title: 'Mero Parche', text: d.rompioReto ? '¡Rompimos el récord del Parche! 🏆' : 'Así se jugó la partida en Mero Parche 🎱' }); setMsg(''); return; }
        catch (e) { if (e?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = archivo.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
      setMsg('Video descargado ✔');
    } catch (e) { setMsg(`No se pudo grabar: ${e.message}`); }
    finally { setGrabando(null); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(2,5,12,.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 }}>
      <canvas ref={ref} width={W} height={H} style={{ height: 'min(82vh, 150vw)', aspectRatio: `${W}/${H}`, borderRadius: 18, boxShadow: '0 0 60px rgba(34,211,238,.25)', maxWidth: '96vw' }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button style={boton('var(--cian)')} onClick={() => { reinicio.current = performance.now(); }}>↺ REPETIR</button>
        {puedeGrabar() && <button style={boton('var(--magenta)')} disabled={grabando !== null} onClick={compartirVideo}>{grabando === null ? '🎬 COMPARTIR VIDEO' : `GRABANDO ${Math.round(grabando * 100)}%`}</button>}
        <button style={boton('var(--amarillo)')} onClick={() => compartirTarjeta(d)}>🖼 TARJETA</button>
        <button style={boton('var(--verde)')} onClick={onCerrar}>✕ CERRAR</button>
      </div>
      {msg && <div style={{ color: 'var(--verde)', fontSize: 13 }}>{msg}</div>}
    </div>
  );
}
