// Piezas compartidas de Carambolas: escenario 1920×1080 escalado, iconos, logo, bolas de billar y barra superior.
import { useEffect, useState } from 'react';
import { hms } from '../../marcador/logica.js';

/** Escenario fijo de 1920×1080 (el de las maquetas) que se escala para caber en cualquier pantalla. */
export function Escenario({ children }) {
  const [k, setK] = useState(() => Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
  useEffect(() => {
    const f = () => setK(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return (
    <div className="ca">
      <div className="ca-stage" style={{ transform: `scale(${k})` }}>{children}</div>
    </div>
  );
}

const svg = (p, tam, hijos) => (
  <svg viewBox="0 0 24 24" width={tam} height={tam} fill="none" stroke="currentColor" strokeWidth={p.sw ?? 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={p.style}>{hijos}</svg>
);
export const IcoFlecha = ({ t = 24 }) => svg({}, t, <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>);
export const IcoCarrito = ({ t = 24 }) => svg({}, t, <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>);
export const IcoX = ({ t = 24 }) => svg({}, t, <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IcoMas = ({ t = 36 }) => svg({ sw: 2.4 }, t, <><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IcoCandado = ({ t = 24 }) => svg({}, t, <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IcoDeshacer = ({ t = 26 }) => svg({}, t, <><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></>);
export const IcoOjo = ({ t = 26 }) => svg({ sw: 2.2 }, t, <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const IcoOjoTachado = ({ t = 26 }) => svg({ sw: 2.2 }, t, <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></>);
export const IcoReloj = ({ t = 18 }) => svg({}, t, <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const IcoPlay = ({ t = 34 }) => (
  <svg viewBox="0 0 24 24" width={t} height={t} fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
);
export function IcoCopa({ t = 30, relleno = false, brillo = false, sw = 2 }) {
  return (
    <svg viewBox="0 0 24 24" width={t} height={t} fill={relleno ? 'rgba(238,182,63,0.15)' : 'none'} stroke="#eeb63f" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={brillo ? { filter: 'drop-shadow(0 0 14px rgba(238,182,63,0.45))' } : undefined}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="ca-logo">
      <svg viewBox="0 0 64 56" width="64" height="56" aria-hidden="true">
        <circle cx="22" cy="20" r="16" fill="#e8b520" /><circle cx="42" cy="20" r="16" fill="#d63a3a" /><circle cx="32" cy="38" r="16" fill="#2f5fd0" />
        <circle cx="17" cy="14" r="4" fill="#fff" fillOpacity="0.45" /><circle cx="37" cy="14" r="4" fill="#fff" fillOpacity="0.45" /><circle cx="27" cy="32" r="4" fill="#fff" fillOpacity="0.45" />
      </svg>
      <div><div className="ca-logo-t">Mero Parche</div><div className="ca-logo-s">SCOREMASTER · CARAMBOLA</div></div>
    </div>
  );
}

// ---------- Bolas de billar (solo en INDIVIDUAL) ----------
const BOLAS = [['#f5c518', '#b8860b'], ['#2f6bff', '#1a3a99'], ['#e53935', '#8e1f1f'], ['#7e57c2', '#4527a0'], ['#f57c1f', '#b34e0a'], ['#2e9e5b', '#166b3a'], ['#a52a3f', '#5e1020'], ['#26262c', '#0a0a0d']];
const BRILLO = 'radial-gradient(circle at 34% 28%,rgba(255,255,255,0.5),rgba(255,255,255,0) 30%)';
function fondoBola(n) {
  if (n === 0) return `${BRILLO},radial-gradient(circle at 50% 55%,#f4f4f4,#c9cdd6)`;
  if (n === 9) return `${BRILLO},linear-gradient(180deg,#f5c518 0,#f5c518 26%,#f4f4f4 26%,#f4f4f4 74%,#f5c518 74%,#f5c518 100%)`;
  const [a, b] = BOLAS[n - 1];
  return `${BRILLO},radial-gradient(circle at 50% 55%,${a},${b})`;
}
export function Bola({ n, etiqueta, onClick }) {
  return (
    <button type="button" className="ca-bola" aria-label={etiqueta} onClick={onClick} style={{ background: fondoBola(n) }}>
      <span className="ca-bola-n">{n}</span>
    </button>
  );
}
export function BolaMas({ etiqueta, onClick, activa }) {
  return (
    <button type="button" className={`ca-bola-mas ${activa ? 'on' : ''}`} aria-label={etiqueta} aria-pressed={Boolean(activa)} onClick={onClick}>
      <IcoMas t={30} /><span>10+</span>
    </button>
  );
}

// ---------- Barra superior (104 px) ----------
/**
 * Izquierda: ← Panel + logo. Centro: reloj único de la mesa (si hay mesa). Derecha: chip del reto, carrito y Finalizar.
 * El reloj va SIEMPRE centrado (columnas 1fr · auto · 1fr), haya o no chip y Finalizar.
 */
export function Barra({ onPanel, mesa, chip, carrito, onFinalizar }) {
  return (
    <header className="ca-barra">
      <div className="ca-barra-izq">
        <button type="button" className="ca-btn-panel" aria-label="Volver al Panel sin terminar la partida" onClick={onPanel}><IcoFlecha />Panel</button>
        <Logo />
      </div>
      <div className="ca-reloj">
        {mesa && <>
          <div className="ca-reloj-et">BILLAR · {mesa.nombre.toUpperCase()} · TIEMPO DE MESA</div>
          <div className="ca-reloj-v">{hms(mesa.segundos)}</div>
        </>}
      </div>
      <div className="ca-barra-der">
        {chip && (
          <div className={`ca-chip-reto ${chip.rompiendo ? 'rompe' : ''}`}>
            <IcoCopa t={30} />
            <div><div className="ca-chip-et">A VENCER · TACADA</div><div className="ca-chip-v">{chip.nombre} · <span>{chip.serie}</span></div></div>
          </div>
        )}
        {carrito && (
          <button type="button" className="ca-btn-carrito" aria-label={`Ver consumo de la mesa, ${carrito.count} productos`} onClick={carrito.onClick}>
            <IcoCarrito /><span className="ca-insignia">{carrito.count}</span>
          </button>
        )}
        {onFinalizar && <button type="button" className="ca-btn-finalizar" onClick={onFinalizar}><IcoCandado />Finalizar · ADM</button>}
      </div>
    </header>
  );
}
