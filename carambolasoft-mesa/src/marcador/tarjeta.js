// Tarjeta vertical para compartir por WhatsApp (1080 de ancho, alto según contenido), dibujada en canvas. Sin dependencias.
import { resumenTactico } from './tactico.js';
const W = 1080;

const MONO = "'JetBrains Mono','Fira Code',ui-monospace,Consolas,'DejaVu Sans Mono','Courier New',monospace";
function mono(c, t, x, y, { size = 26, color = '#d7e4f5', peso = 700, align = 'left', max = null, glow = null } = {}) {
  c.font = `${peso} ${size}px ${MONO}`; c.textAlign = align; c.fillStyle = color;
  if (glow) { c.shadowColor = glow; c.shadowBlur = 20; }
  c.fillText(t, x, y, max ?? undefined); c.shadowBlur = 0;
}
function doble(c, x, y, w, h, color) {   // marco "doble línea", como los bordes de la terminal
  c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.roundRect(x, y, w, h, 6); c.stroke();
  c.lineWidth = 2; c.beginPath(); c.roundRect(x + 6, y + 6, w - 12, h - 12, 3); c.stroke();
}

export function dibujarTarjeta(d) {
  const r = resumenTactico(d), a = d.analisis;
  // El alto se calcula según el contenido (más premios o insights = tarjeta más alta), sin que nada se pise.
  const nM = Math.min(4, r.matriz.length), nP = Math.min(4, a?.premios?.length ?? 0), nI = Math.min(5, r.ins.length);
  const H2 = 524 + (a?.jugadas > 0 ? 322 : 0) + (78 + nM * 54 + 20) + (nP ? 66 + Math.ceil(nP / 2) * 112 + 20 : 0) + (62 + nI * 36 + 16) + 90;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H2;
  const c = cv.getContext('2d');
  c.fillStyle = '#060a12'; c.fillRect(0, 0, W, H2);
  const brillo = c.createRadialGradient(W / 2, 0, 20, W / 2, 0, 800); brillo.addColorStop(0, 'rgba(34,211,238,.20)'); brillo.addColorStop(1, 'rgba(34,211,238,0)');
  c.fillStyle = brillo; c.fillRect(0, 0, W, 900);
  const OR = '#fbbf24', CI = '#2dd4ee', MG = '#e879f9', VE = '#4ade80', BD = '#1e3a4a', MU = '#6b8199';

  // encabezado
  doble(c, 40, 36, W - 80, 92, CI);
  mono(c, '⚡', 66, 96, { size: 38 });
  mono(c, 'MERO', 118, 96, { size: 40, color: OR, peso: 900, glow: 'rgba(251,191,36,.6)' });
  mono(c, 'PARCHE', 118 + 4 * 24 + 14, 96, { size: 40, color: CI, peso: 900, glow: 'rgba(34,211,238,.6)' });
  mono(c, `[ MESA ${String(d.mesa).padStart(2, '0')} · INFORME TÁCTICO ]`, W - 66, 92, { size: 22, color: CI, align: 'right' });

  // KPIs
  const kw = (W - 80 - 3 * 14) / 4;
  r.kpis.forEach((k, i) => {
    const x = 40 + i * (kw + 14);
    doble(c, x, 150, kw, 132, BD);
    mono(c, k.et, x + kw / 2, 184, { size: 15, color: MU, align: 'center', max: kw - 20 });
    mono(c, k.v, x + kw / 2, 236, { size: 38, color: [CI, MG, OR, VE][i], align: 'center', peso: 900, max: kw - 24 });
    mono(c, k.sub, x + kw / 2, 266, { size: 15, color: MU, align: 'center', max: kw - 16 });
  });

  // MVP
  c.fillStyle = 'rgba(251,191,36,.08)'; c.fillRect(40, 304, W - 80, 196); doble(c, 40, 304, W - 80, 196, OR);
  mono(c, r.mvp.empate ? '▌EMPATE EN LA CIMA' : '▌EL MVP DE LA PARTIDA', 66, 346, { size: 20, color: OR, peso: 800 });
  mono(c, r.mvp.empate ? '¡REVANCHA YA!' : `👑 ${r.mvp.nombre.toUpperCase()}`, 66, 420, { size: 72, color: '#fff', peso: 900, glow: 'rgba(251,191,36,.5)', max: W - 130 });
  mono(c, `Puntaje: ${r.mvp.puntaje} pts${r.mvp.promedio !== null ? `  |  Promedio: ${r.mvp.promedio.toFixed(2)} / entrada` : ''}`, 66, 456, { size: 22, color: '#d7e4f5', max: W - 130 });
  if (!r.mvp.empate) mono(c, `🔥 Sello: ${r.mvp.sello}${r.mvp.letalidad !== null ? `  (letalidad ${r.mvp.letalidad}%)` : ''}`, 66, 486, { size: 22, color: MG, max: W - 130 });

  // carrera
  let y = 524;
  if (a && a.lineas.length && a.jugadas > 0) {
    doble(c, 40, y, W - 80, 300, BD);
    mono(c, '▌LA CARRERA · CAMBIOS DE LÍDER ○', 66, y + 40, { size: 20, color: CI, peso: 800 });
    mono(c, `${a.cambios.length} cambios en ${a.jugadas} jugadas`, W - 66, y + 40, { size: 18, color: MU, align: 'right' });
    const gx = 70, gy = y + 60, gw = W - 150, gh = 190;
    const maxY = Math.max(1, ...a.lineas.map((l) => Math.max(...l.puntos)));
    const X = (i) => gx + 10 + (i / Math.max(1, a.jugadas)) * (gw - 50), Y = (v) => gy + gh - 10 - (v / maxY) * (gh - 24);
    c.strokeStyle = BD; c.lineWidth = 1; c.setLineDash([4, 8]); [0, 0.5, 1].forEach((f) => { c.beginPath(); c.moveTo(gx, Y(maxY * f)); c.lineTo(gx + gw, Y(maxY * f)); c.stroke(); }); c.setLineDash([]);
    a.lineas.forEach((l) => {
      c.strokeStyle = l.neon; c.lineWidth = 5; c.lineJoin = 'round'; c.shadowColor = l.neon; c.shadowBlur = 12; c.beginPath();
      l.puntos.forEach((v, i) => { if (i === 0) c.moveTo(X(0), Y(v)); else { c.lineTo(X(i), Y(l.puntos[i - 1])); c.lineTo(X(i), Y(v)); } });
      c.stroke(); c.shadowBlur = 0;
      mono(c, String(l.puntos.at(-1)), X(a.jugadas) + 10, Y(l.puntos.at(-1)) + 7, { size: 22, color: l.neon, peso: 900 });
    });
    a.cambios.forEach((k) => { const l = a.lineas[k.a]; c.fillStyle = '#fff'; c.beginPath(); c.arc(X(k.jugada), Y(l.puntos[k.jugada]), 8, 0, 7); c.fill(); c.strokeStyle = l.neon; c.lineWidth = 3; c.stroke(); });
    let lx = 70; a.lineas.forEach((l) => { c.fillStyle = l.neon; c.fillRect(lx, y + 270, 24, 6); mono(c, l.nombre, lx + 32, y + 278, { size: 20, color: '#d7e4f5', max: 240 }); lx += 70 + Math.min(240, c.measureText(l.nombre).width); });
    y += 322;
  }

  // matriz
  const filasM = r.matriz.slice(0, nM), hM = 78 + filasM.length * 54;
  doble(c, 40, y, W - 80, hM, BD);
  mono(c, '▌MATRIZ DE RENDIMIENTO · COMPARATIVA', 66, y + 40, { size: 20, color: VE, peso: 800 });
  [['#', 70, 'left'], ['JUGADOR', 110, 'left'], ['CARAMB.', 520, 'right'], ['PROM.', 640, 'right'], ['IMPACTO', 700, 'left']].forEach(([t, x, al]) => mono(c, t, x, y + 70, { size: 15, color: MU, align: al }));
  filasM.forEach((m, i) => {
    const yy = y + 108 + i * 54, col = a?.lineas?.[i]?.neon ?? VE;
    mono(c, String(m.pos), 70, yy, { size: 24 });
    mono(c, m.nombre + (m.invitado ? ' (inv.)' : ''), 110, yy, { size: 26, peso: 800, color: '#fff', max: 330 });
    mono(c, String(m.caramb), 520, yy, { size: 28, align: 'right', color: '#fff', peso: 900 });
    mono(c, m.prom.toFixed(2), 640, yy, { size: 24, align: 'right', color: CI });
    mono(c, `${m.bloques} ${m.pct}%`, 700, yy, { size: 20, color: col, max: W - 740 });
  });
  y += hM + 20;

  // premios
  const prem = (a?.premios ?? []).slice(0, nP);
  if (prem.length) {
    doble(c, 40, y, W - 80, 66 + Math.ceil(prem.length / 2) * 112, MG);
    mono(c, '▌LOS PREMIOS DE LA NOCHE', 66, y + 40, { size: 20, color: MG, peso: 800 });
    prem.forEach((p, i) => {
      const x = 66 + (i % 2) * 480, yy = y + 62 + Math.floor(i / 2) * 112;
      c.fillStyle = 'rgba(232,121,249,.10)'; c.beginPath(); c.roundRect(x, yy, 456, 98, 14); c.fill();
      mono(c, p.emoji, x + 14, yy + 62, { size: 44 });
      mono(c, p.titulo.replace(/^EL /, ''), x + 80, yy + 34, { size: 17, color: MG, peso: 800 });
      mono(c, p.nombre, x + 80, yy + 64, { size: 28, color: '#fff', peso: 800, max: 360 });
      mono(c, p.detalle, x + 80, yy + 88, { size: 15, color: MU, max: 366 });
    });
    y += 66 + Math.ceil(prem.length / 2) * 112 + 20;
  }

  // insights
  const ins = r.ins.slice(0, nI), hI = 62 + ins.length * 36;
  doble(c, 40, y, W - 80, hI, BD);
  mono(c, '▌INSIGHTS AUTOMÁTICOS DEL PARCHE', 66, y + 40, { size: 20, color: OR, peso: 800 });
  ins.forEach((t, i) => mono(c, '• ' + t.replaceAll('**', ''), 66, y + 78 + i * 36, { size: 19, color: '#d7e4f5', max: W - 130 }));
  y += hI + 16;

  mono(c, d.rompioReto ? `🏆 ¡RÉCORD DEL PARCHE ROTO! ${d.reto.serie} · ${d.reto.nombre}` : d.reto ? `RÉCORD A TUMBAR: ${d.reto.nombre} · ${d.reto.serie}` : 'EL RÉCORD ESTÁ LIBRE: ESTRÉNALO', W / 2, H2 - 52, { size: 24, color: CI, align: 'center', peso: 800, max: W - 80 });
  mono(c, `${d.fecha} · Mero Parche, Santa Cruz`, W / 2, H2 - 18, { size: 16, color: MU, align: 'center' });
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
