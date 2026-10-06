// ============================================================
//  REPLAY de la partida — película vertical (9:16) dibujada en canvas, función pura del tiempo:
//  dibujar(ctx, d, t). La misma función sirve para verla en pantalla y para grabarla como video.
//  Escenas: intro → carrera de barras con comentarista → podio con confeti y premios → Reto del Parche.
// ============================================================
export const W = 720, H = 1280, FPS = 30;
const FUENTE = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
const POOL = ['#e0b400', '#1e40af', '#c62828', '#6d28d9', '#e35b14', '#1f7a3f', '#7f1d1d', '#111318', '#e0b400'];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const salida = (k) => 1 - (1 - clamp(k)) ** 3;
const rebote = (k) => { k = clamp(k); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
const semilla = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Duración de cada escena según la cantidad de jugadas (la carrera se acomoda a ~7 s). */
export function plan(d) {
  const n = Math.max(1, d.analisis?.jugadas ?? 1);
  const paso = clamp(7 / n, 0.45, 1.1);
  const intro = 1.8, carrera = n * paso, podio = 4.6, reto = 3.4;
  return { n, paso, intro, carrera, podio, reto, total: intro + carrera + podio + reto };
}

function txt(c, t, x, y, { s = 40, col = '#eaf1fb', w = 800, al = 'center', glow = null, max = null, a = 1 } = {}) {
  c.save(); c.globalAlpha *= a; c.font = `${w} ${s}px ${FUENTE}`; c.textAlign = al; c.textBaseline = 'alphabetic'; c.fillStyle = col;
  if (glow) { c.shadowColor = glow; c.shadowBlur = 26; }
  c.fillText(t, x, y, max ?? undefined); c.restore();
}
function caja(c, x, y, w, h, r, fill, stroke, lw = 3) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }

function bola(c, x, y, r, n, giro = 0) {
  const col = POOL[(n - 1) % 9];
  c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffffcc'); g.addColorStop(0.18, col); g.addColorStop(1, '#00000099');
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.shadowColor = 'transparent';
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.fillStyle = '#f6f7fb'; c.beginPath(); c.arc(x, y, r * 0.5, 0, 7); c.fill();
  c.fillStyle = '#10151f'; c.font = `900 ${r * 0.62}px ${FUENTE}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x, y + r * 0.04);
  c.restore();
}

function fondo(c, t, pulso = 0) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07151c'); g.addColorStop(1, '#040a10'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const f = c.createRadialGradient(W / 2, 560, 40, W / 2, 560, 760); f.addColorStop(0, `rgba(16,120,110,${0.34 + pulso * 0.1})`); f.addColorStop(1, 'rgba(16,120,110,0)'); c.fillStyle = f; c.fillRect(0, 0, W, H);
  // paño: rejilla en perspectiva suave
  c.save(); c.globalAlpha = 0.07; c.strokeStyle = '#7ff'; c.lineWidth = 1;
  for (let i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(W / 2 + i * 40, 0); c.lineTo(W / 2 + i * 150, H); c.stroke(); }
  for (let j = 0; j < 14; j++) { const y = ((j * 100 + t * 30) % 1400); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.restore();
  // bolas que flotan de fondo
  const r = semilla(7);
  for (let i = 0; i < 7; i++) { const x = r() * W, y0 = r() * H, v = 10 + r() * 22, rad = 26 + r() * 40; const y = (y0 - t * v + H * 3) % (H + 200) - 100; c.save(); c.globalAlpha = 0.07; bola(c, x, y, rad, 1 + Math.floor(r() * 9)); c.restore(); }
  const vg = c.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 900); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
}

function confeti(c, t, x0, y0, n, seed) {
  const r = semilla(seed), cols = ['#fbbf24', '#22d3ee', '#e879f9', '#4ade80', '#ff5670', '#fff'];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (r() - 0.5) * 2.4, v = 380 + r() * 520, g = 700, dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
    const x = x0 + dx * t, y = y0 + dy * t + 0.5 * g * t * t, rot = r() * 7 + t * (r() * 12), w = 10 + r() * 12, col = cols[Math.floor(r() * cols.length)];
    c.save(); c.globalAlpha = clamp(1.7 - t * 0.6); c.translate(x, y); c.rotate(rot); c.fillStyle = col; c.fillRect(-w / 2, -w / 4, w, w / 2); c.restore();
  }
}

// ---------------------------------------------------------------- escenas
function escenaIntro(c, d, t) {
  const k = salida(t / 0.7), k2 = salida((t - 0.15) / 0.7);
  txt(c, `MESA ${String(d.mesa).padStart(2, '0')} · ${d.modo === 'ind' ? 'INDIVIDUAL' : 'PAREJAS'}`, W / 2, 470, { s: 34, col: '#8aa0bd', a: salida((t - 0.5) / 0.4) });
  c.font = `900 150px ${FUENTE}`;
  const ajuste = Math.min(1, (W - 70) / (c.measureText('MERO').width + c.measureText('PARCHE').width + 24)), fs = Math.floor(150 * ajuste);
  c.font = `900 ${fs}px ${FUENTE}`;
  const wm = c.measureText('MERO').width, wp = c.measureText('PARCHE').width, x0 = (W - (wm + wp + 24)) / 2;
  c.save(); c.translate(-(1 - k) * 500, 0); txt(c, 'MERO', x0, 600, { s: fs, col: '#fbbf24', al: 'left', glow: 'rgba(251,191,36,.8)', w: 900 }); c.restore();
  c.save(); c.translate((1 - k2) * 500, 0); txt(c, 'PARCHE', x0 + wm + 24, 600, { s: fs, col: '#22d3ee', al: 'left', glow: 'rgba(34,211,238,.8)', w: 900 }); c.restore();
  txt(c, 'LA PARTIDA, JUGADA A JUGADA', W / 2, 676, { s: 38, col: '#c9d4e6', a: salida((t - 0.7) / 0.5) });
  for (let i = 0; i < 3; i++) { const kk = rebote((t - 0.3 - i * 0.18) / 0.6); if (kk > 0) bola(c, W / 2 - 120 + i * 120, 800 - (1 - clamp(kk)) * 300, 52, [3, 9, 1][i]); }
}

function estadoCarrera(d, p, tl) {
  const a = d.analisis, pos = tl / p.paso, i = clamp(Math.floor(pos), 0, p.n - 1), fr = clamp(pos - i);
  const k = salida(fr / 0.55);
  const sc = a.lineas.map((l) => lerp(l.puntos[i], l.puntos[Math.min(p.n, i + 1)], k));
  // jugada que está ocurriendo (i+1): ¿qué línea subió, cuánto, y si hubo cambio de líder
  const sig = i + 1;
  let quien = -1, val = 0;
  a.lineas.forEach((l, n) => { const dv = l.puntos[Math.min(p.n, sig)] - l.puntos[i]; if (dv > 0) { quien = n; val = dv; } });
  const cambio = a.cambios.find((x) => x.jugada === sig);
  return { sc, i, fr, quien, val, cambio, sig: Math.min(p.n, sig) };
}

function escenaCarrera(c, d, p, tl) {
  const a = d.analisis, e = estadoCarrera(d, p, tl), n = a.lineas.length;
  const maxF = Math.max(1, ...a.lineas.map((l) => l.puntos.at(-1)));
  txt(c, 'LA CARRERA', 60, 150, { s: 46, col: '#22d3ee', al: 'left', glow: 'rgba(34,211,238,.6)' });
  txt(c, `JUGADA ${e.sig}/${p.n}`, W - 60, 150, { s: 34, col: '#8aa0bd', al: 'right' });
  caja(c, 60, 176, W - 120, 8, 4, 'rgba(255,255,255,.1)'); caja(c, 60, 176, (W - 120) * clamp(tl / p.carrera), 8, 4, '#22d3ee');

  const rowH = n <= 2 ? 190 : n === 3 ? 165 : 148, top = 215 + Math.max(0, (700 - n * rowH) / 2);
  const mayor = Math.max(...e.sc);
  a.lineas.forEach((l, idx) => {
    let rango = 0; e.sc.forEach((s, m) => { if (m !== idx) rango += clamp((s - e.sc[idx]) / 2 + 0.5); });
    const y = top + rango * rowH, esLider = e.sc[idx] === mayor && mayor > 0;
    const golpe = idx === e.quien ? Math.sin(clamp(e.fr / 0.6) * Math.PI) : 0;   // la barra "salta" cuando anota
    const bx = 190, bw = W - bx - 60, len = Math.max(14, (e.sc[idx] / maxF) * (bw - 120));
    c.save(); c.translate(0, -golpe * 8);
    caja(c, bx, y + 34, bw, 70, 35, 'rgba(255,255,255,.06)');
    c.save(); c.shadowColor = l.neon; c.shadowBlur = esLider ? 30 : 12; caja(c, bx, y + 34, len, 70, 35, l.neon); c.restore();
    bola(c, 112, y + 69, 44, (a.lineas.indexOf(l) % 9) + 1);
    txt(c, l.nombre.toUpperCase(), bx + 6, y + 24, { s: 36, col: '#fff', al: 'left', max: bw - 20 });
    txt(c, String(Math.round(e.sc[idx])), Math.min(bx + len + 14, W - 60), y + 92, { s: 62, col: len > bw - 140 ? '#06141a' : '#fff', al: len > bw - 140 ? 'right' : 'left', w: 900 });
    if (esLider) txt(c, '👑', 112, y + 18, { s: 40 });
    c.restore();
  });

  // comentarista
  const dentro = clamp(e.fr / 0.25) * clamp((1 - e.fr) / 0.15 + 0.2);
  let frase = '', col = '#eaf1fb';
  const nom = (n) => a.lineas[n]?.nombre ?? '';
  if (e.cambio) { frase = `¡${nom(e.cambio.a).toUpperCase()} SE PONE AL FRENTE!`; col = '#fbbf24'; }
  else if (e.quien >= 0 && e.val === d.hr && d.hr >= 5) { frase = `💥 TACADA DE ORO: ${e.val}`; col = '#e879f9'; }
  else if (e.quien >= 0 && e.val >= 10) { frase = `¡TACADÓN DE ${e.val}!`; col = '#4ade80'; }
  else if (e.quien >= 0) frase = `${nom(e.quien)} suma ${e.val}`;
  const y0 = 940;
  caja(c, 50, y0, W - 100, 150, 28, 'rgba(255,255,255,.05)', 'rgba(255,255,255,.12)', 2);
  txt(c, '🎙 EL COMENTARISTA', 80, y0 + 40, { s: 24, col: '#8aa0bd', al: 'left' });
  c.save(); const pop = 1 + (e.cambio ? 0.08 : 0.03) * Math.sin(clamp(e.fr / 0.5) * Math.PI);
  c.translate(W / 2, y0 + 108); c.scale(pop, pop);
  txt(c, frase, 0, 0, { s: e.cambio || e.val >= 10 ? 54 : 46, col, glow: e.cambio ? 'rgba(251,191,36,.7)' : null, a: dentro, max: W - 140 }); c.restore();
  txt(c, `TACADA MÁS ALTA: ${d.hr}${d.hrN !== '—' ? ' · ' + d.hrN : ''}`, W / 2, 1160, { s: 32, col: '#c9d4e6' });
}

function escenaPodio(c, d, tp) {
  const a = d.analisis, k = rebote(tp / 0.7);
  txt(c, d.empate ? 'TERMINARON EMPATADOS' : '🏆 LA GANÓ', W / 2, 200, { s: 54, col: '#fbbf24', glow: 'rgba(251,191,36,.7)', a: salida(tp / 0.4) });
  c.save(); c.translate(W / 2, 330); c.scale(clamp(k, 0, 1.4), clamp(k, 0, 1.4));
  txt(c, d.empate ? '¡REVANCHA YA!' : d.textoGanador.toUpperCase(), 0, 0, { s: 150, col: '#fff', glow: 'rgba(251,191,36,.6)', w: 900, max: W - 80 }); c.restore();
  txt(c, `${d.totalC} carambolas · ${d.totalE} entradas · mejor tacada ${d.hr}`, W / 2, 410, { s: 30, col: '#c9d4e6', a: salida((tp - 0.5) / 0.4), max: W - 60 });
  // marcador final como bolas
  d.filas.slice(0, 4).forEach((j, i) => {
    const kk = salida((tp - 0.8 - i * 0.18) / 0.5); if (kk <= 0) return;
    const y = 480 + i * 82;
    c.save(); c.globalAlpha = kk; c.translate((1 - kk) * 120, 0);
    bola(c, 120, y + 30, 30, i + 1);
    txt(c, j.nombre.toUpperCase(), 170, y + 44, { s: 44, col: i === 0 && !d.empate ? '#fbbf24' : '#eaf1fb', al: 'left', max: 380 });
    txt(c, String(j.puntaje), W - 90, y + 48, { s: 54, col: '#fff', al: 'right', w: 900 });
    c.restore();
  });
  // premios
  const prem = a.premios.slice(0, 4);
  txt(c, 'LOS PREMIOS DE LA NOCHE', W / 2, 850, { s: 36, col: '#e879f9', a: salida((tp - 1.6) / 0.4) });
  prem.forEach((p, i) => {
    const kk = rebote((tp - 1.9 - i * 0.35) / 0.55); if (kk <= 0) return;
    const col = i % 2, fila = Math.floor(i / 2), x = 50 + col * 315, y = 880 + fila * 150;
    c.save(); c.translate(x + 150, y + 62); c.scale(clamp(kk, 0, 1.15), clamp(kk, 0, 1.15)); c.translate(-150, -62);
    caja(c, 0, 0, 300, 124, 24, 'rgba(232,121,249,.12)', 'rgba(232,121,249,.6)', 2);
    txt(c, p.emoji, 16, 80, { s: 60, al: 'left' });
    txt(c, p.titulo, 92, 46, { s: 24, col: '#e879f9', al: 'left', max: 200 });
    txt(c, p.nombre, 92, 92, { s: 40, col: '#fff', al: 'left', max: 200 });
    c.restore();
  });
  if (!d.empate && d.textoGanador !== '—') confeti(c, tp, W / 2, 330, 70, 11);
}

function escenaReto(c, d, tr) {
  const roto = d.rompioReto, k = rebote(tr / 0.6);
  if (roto) {
    for (let i = 0; i < 3; i++) { const q = clamp((tr - i * 0.25) / 1.4); if (q > 0 && q < 1) { c.save(); c.globalAlpha = (1 - q) * 0.6; c.strokeStyle = '#fbbf24'; c.lineWidth = 8; c.beginPath(); c.arc(W / 2, 560, q * 520, 0, 7); c.stroke(); c.restore(); } }
    txt(c, '¡RÉCORD DEL PARCHE ROTO!', W / 2, 300, { s: 70, col: '#fbbf24', glow: 'rgba(251,191,36,.8)', a: salida(tr / 0.3), max: W - 60 });
    c.save(); c.translate(W / 2, 600); c.scale(clamp(k, 0, 1.3), clamp(k, 0, 1.3));
    txt(c, String(Math.round(lerp(0, d.reto.serie, salida(tr / 1.2)))), 0, 0, { s: 360, col: '#fff', glow: 'rgba(251,191,36,.7)', w: 900 }); c.restore();
    txt(c, 'CARAMBOLAS EN UNA TACADA', W / 2, 690, { s: 40, col: '#c9d4e6', a: salida((tr - 0.6) / 0.4) });
    txt(c, d.reto.nombre.toUpperCase(), W / 2, 790, { s: 90, col: '#22d3ee', glow: 'rgba(34,211,238,.7)', a: salida((tr - 0.9) / 0.4), max: W - 80 });
    confeti(c, tr, W / 2, 600, 90, 23);
  } else {
    txt(c, d.reto ? 'EL RÉCORD A TUMBAR' : 'EL RÉCORD ESTÁ LIBRE', W / 2, 330, { s: 64, col: '#22d3ee', glow: 'rgba(34,211,238,.6)', a: salida(tr / 0.4) });
    c.save(); c.translate(W / 2, 600); c.scale(clamp(k, 0, 1.3), clamp(k, 0, 1.3));
    txt(c, d.reto ? String(d.reto.serie) : '0', 0, 0, { s: 360, col: '#fff', w: 900 }); c.restore();
    txt(c, d.reto ? `de ${d.reto.nombre.toUpperCase()}` : 'EL PRIMERO LO ESTRENA', W / 2, 720, { s: 60, col: '#fbbf24', a: salida((tr - 0.7) / 0.4), max: W - 80 });
  }
  const f = salida((tr - 1.6) / 0.5);
  txt(c, '¿TE ANIMAS A TUMBARLO?', W / 2, 1010, { s: 66, col: '#e879f9', glow: 'rgba(232,121,249,.6)', a: f });
  txt(c, 'MERO PARCHE · SANTA CRUZ', W / 2, 1100, { s: 44, col: '#fbbf24', a: f });
  txt(c, d.fecha, W / 2, 1160, { s: 28, col: '#5a6b85', a: f });
}

/** Dibuja el cuadro del instante t (segundos). */
export function dibujar(c, d, t) {
  const p = plan(d), tc = p.intro, tp = tc + p.carrera, tr = tp + p.podio;
  c.save(); c.clearRect(0, 0, W, H);
  fondo(c, t, t > tr ? 1 : 0);
  if (!d.analisis || d.analisis.jugadas === 0) { txt(c, 'MERO PARCHE', W / 2, 600, { s: 150, col: '#fbbf24', w: 900 }); txt(c, 'Esta partida no tiene series para el replay', W / 2, 700, { s: 36, col: '#8aa0bd' }); c.restore(); return; }
  const fade = (ini, fin) => clamp((t - ini) / 0.35) * clamp((fin - t) / 0.35);
  if (t < tc + 0.35) { c.save(); c.globalAlpha = clamp((tc + 0.35 - t) / 0.35 + (t < tc ? 1 : 0)); escenaIntro(c, d, t); c.restore(); }
  if (t > tc - 0.01 && t < tp + 0.35) { c.save(); c.globalAlpha = fade(tc - 0.01, tp + 0.35) || 0; escenaCarrera(c, d, p, clamp(t - tc, 0, p.carrera)); c.restore(); }
  if (t > tp - 0.01 && t < tr + 0.35) { c.save(); c.globalAlpha = fade(tp - 0.01, tr + 0.35); escenaPodio(c, d, t - tp); c.restore(); }
  if (t > tr - 0.01) { c.save(); c.globalAlpha = clamp((t - tr) / 0.35); escenaReto(c, d, t - tr); c.restore(); }
  c.restore();
}

// ---------------------------------------------------------------- video
function tipoVideo() {
  const prefs = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return prefs.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? null;
}
export const puedeGrabar = () => Boolean(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && tipoVideo());

/** Graba el replay en tiempo real (≈17 s). onProgreso(0..1). Devuelve { blob, ext }. */
export function grabarReplay(d, onProgreso) {
  return new Promise((resolve, reject) => {
    const mime = tipoVideo();
    if (!mime) return reject(new Error('Este navegador no puede grabar video'));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), total = plan(d).total + 0.6;
    const rec = new MediaRecorder(cv.captureStream(FPS), { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const trozos = [];
    rec.ondataavailable = (e) => e.data.size && trozos.push(e.data);
    rec.onerror = (e) => reject(e.error ?? new Error('Falló la grabación'));
    rec.onstop = () => resolve({ blob: new Blob(trozos, { type: mime.split(';')[0] }), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' });
    rec.start(250);
    const ini = performance.now();
    const paso = () => {
      const t = (performance.now() - ini) / 1000;
      dibujar(c, d, Math.min(t, total)); onProgreso?.(clamp(t / total));
      if (t < total) requestAnimationFrame(paso); else setTimeout(() => rec.stop(), 200);
    };
    requestAnimationFrame(paso);
  });
}
