// Tarjeta vertical para compartir por WhatsApp (1080×1350), dibujada en canvas. Sin dependencias.
const W = 1080, H = 1350;
const FUENTE = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";

function recta(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function texto(c, t, x, y, { size = 40, color = '#eaf1fb', peso = 700, align = 'left', glow = null, max = null } = {}) {
  c.font = `${peso} ${size}px ${FUENTE}`; c.textAlign = align; c.fillStyle = color;
  if (glow) { c.shadowColor = glow; c.shadowBlur = 24; }
  c.fillText(t, x, y, max ?? undefined); c.shadowBlur = 0;
}

export function dibujarTarjeta(d) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const fondo = c.createLinearGradient(0, 0, 0, H); fondo.addColorStop(0, '#101a2a'); fondo.addColorStop(1, '#070b13');
  c.fillStyle = fondo; c.fillRect(0, 0, W, H);
  const brillo = c.createRadialGradient(W / 2, 140, 20, W / 2, 140, 620); brillo.addColorStop(0, 'rgba(34,211,238,.22)'); brillo.addColorStop(1, 'rgba(34,211,238,0)');
  c.fillStyle = brillo; c.fillRect(0, 0, W, 760);

  c.font = `900 110px ${FUENTE}`;
  const wm = c.measureText('MERO').width, wp = c.measureText('PARCHE').width, x0 = (W - (wm + wp + 28)) / 2;
  texto(c, 'MERO', x0, 130, { size: 110, color: '#fbbf24', glow: 'rgba(251,191,36,.7)', peso: 900 });
  texto(c, 'PARCHE', x0 + wm + 28, 130, { size: 110, color: '#22d3ee', glow: 'rgba(34,211,238,.7)', peso: 900 });
  texto(c, 'LICORES & BILLAR · SANTA CRUZ', W / 2, 176, { size: 28, color: '#8493ad', align: 'center' });

  // Ganador
  c.fillStyle = 'rgba(251,191,36,.10)'; recta(c, 60, 215, W - 120, 210, 28); c.fill();
  c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.stroke();
  texto(c, d.empate ? 'TERMINARON EMPATADOS' : '🏆 GANÓ', W / 2, 272, { size: 34, color: '#fbbf24', align: 'center' });
  texto(c, d.empate ? '¡Revancha ya!' : d.textoGanador.toUpperCase(), W / 2, 372, { size: 108, color: '#ffffff', align: 'center', glow: 'rgba(251,191,36,.5)', peso: 900, max: W - 160 });
  texto(c, `${d.totalC} carambolas · ${d.totalE} entradas · mejor tacada ${d.hr}`, W / 2, 410, { size: 28, color: '#c9d4e6', align: 'center' });

  // Carrera
  const a = d.analisis;
  if (a && a.lineas.length && a.jugadas > 0) {
    texto(c, 'LA CARRERA', 70, 490, { size: 34, color: '#22d3ee' });
    const gx = 70, gy = 510, gw = W - 140, gh = 300;
    c.fillStyle = 'rgba(255,255,255,.04)'; recta(c, gx, gy, gw, gh, 18); c.fill();
    const maxY = Math.max(1, ...a.lineas.map((l) => Math.max(...l.puntos)));
    const X = (i) => gx + 24 + (i / Math.max(1, a.jugadas)) * (gw - 48);
    const Y = (v) => gy + gh - 24 - (v / maxY) * (gh - 48);
    a.lineas.forEach((l) => {
      c.strokeStyle = l.neon; c.lineWidth = 6; c.lineJoin = 'round'; c.shadowColor = l.neon; c.shadowBlur = 14; c.beginPath();
      l.puntos.forEach((v, i) => { if (i === 0) c.moveTo(X(0), Y(v)); else { c.lineTo(X(i), Y(l.puntos[i - 1])); c.lineTo(X(i), Y(v)); } });
      c.stroke(); c.shadowBlur = 0;
    });
    a.cambios.forEach((k) => {
      const l = a.lineas[k.a]; c.fillStyle = '#fff'; c.beginPath(); c.arc(X(k.jugada), Y(l.puntos[k.jugada]), 9, 0, 7); c.fill();
      c.strokeStyle = l.neon; c.lineWidth = 4; c.stroke();
    });
    let lx = gx + 10;
    a.lineas.forEach((l) => { c.fillStyle = l.neon; c.fillRect(lx, gy + gh + 22, 26, 8); texto(c, `${l.nombre} ${l.puntos.at(-1)}`, lx + 36, gy + gh + 34, { size: 28, color: '#eaf1fb' }); lx += 44 + c.measureText(`${l.nombre} ${l.puntos.at(-1)}`).width + 24; });
    if (a.cambios.length) texto(c, `${a.cambios.length} cambio${a.cambios.length === 1 ? '' : 's'} de líder`, W - 70, 490, { size: 28, color: '#8493ad', align: 'right' });
  }

  // Premios
  const prem = (a?.premios ?? []).slice(0, 4);
  texto(c, 'LOS PREMIOS DE LA NOCHE', 70, 905, { size: 34, color: '#e879f9' });
  prem.forEach((p, i) => {
    const col = i % 2, fila = Math.floor(i / 2), x = 70 + col * 480, y = 930 + fila * 130;
    c.fillStyle = 'rgba(232,121,249,.08)'; recta(c, x, y, 460, 112, 20); c.fill();
    c.strokeStyle = 'rgba(232,121,249,.5)'; c.lineWidth = 2; c.stroke();
    texto(c, p.emoji, x + 22, y + 72, { size: 58 });
    texto(c, p.titulo, x + 100, y + 44, { size: 28, color: '#e879f9' });
    texto(c, p.nombre, x + 100, y + 86, { size: 40, color: '#fff', max: 340 });
  });
  if (!prem.length) texto(c, 'Partida sin series suficientes para premios', 70, 975, { size: 30, color: '#8493ad' });

  // Reto
  c.fillStyle = 'rgba(34,211,238,.10)'; recta(c, 60, 1205, W - 120, 90, 22); c.fill();
  c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.stroke();
  texto(c, d.rompioReto ? `🏆 ¡RÉCORD DEL PARCHE ROTO! ${d.reto.serie}` : d.reto ? `RÉCORD A TUMBAR: ${d.reto.nombre} · ${d.reto.serie}` : 'EL RÉCORD ESTÁ LIBRE: ESTRÉNALO', W / 2, 1262, { size: 38, color: '#22d3ee', align: 'center', max: W - 160 });
  texto(c, d.fecha, W / 2, 1328, { size: 24, color: '#5a6b85', align: 'center' });
  return cv;
}

/** Comparte la tarjeta (WhatsApp, etc.) si el dispositivo lo permite; si no, la descarga como PNG. */
export async function compartirTarjeta(d) {
  const cv = dibujarTarjeta(d);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const archivo = new File([blob], `mero-parche-mesa-${d.mesa}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: 'Mero Parche', text: d.rompioReto ? '¡Rompimos el récord del Parche! 🏆' : 'Así quedó la partida en Mero Parche 🎱' }); return 'compartida'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelada'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = archivo.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'descargada';
}
