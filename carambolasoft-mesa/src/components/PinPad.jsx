// src/components/PinPad.jsx — Teclado numérico táctil (y teclado físico) para digitar el PIN.
import { useEffect } from 'react';

export default function PinPad({ valor, onChange, onEnter, max = 6, deshabilitado = false }) {
  useEffect(() => {
    if (deshabilitado) return undefined;
    const f = (e) => {
      if (/^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) return; // escribiendo en un campo de texto: no es el PIN
      if (/^\d$/.test(e.key)) onChange((valor + e.key).slice(0, max));
      else if (e.key === 'Backspace') onChange(valor.slice(0, -1));
      else if (e.key === 'Enter') onEnter?.();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });
  const tecla = (d) => <button key={d} type="button" disabled={deshabilitado} onClick={() => onChange((valor + d).slice(0, max))}>{d}</button>;
  return (
    <div className="au-pad">
      <div className="au-dots" aria-label="PIN">{Array.from({ length: Math.max(4, valor.length) }, (_, i) => <i key={i} className={i < valor.length ? 'on' : ''} />)}</div>
      <div className="au-keys">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(tecla)}
        <button type="button" disabled={deshabilitado} onClick={() => onChange(valor.slice(0, -1))}>⌫</button>
        {tecla(0)}
        <button type="button" className="ok" disabled={deshabilitado || valor.length < 4} onClick={onEnter}>✓</button>
      </div>
    </div>
  );
}
