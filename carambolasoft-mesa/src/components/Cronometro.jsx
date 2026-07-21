// src/components/Cronometro.jsx
// Cronómetro HH:MM:SS autónomo — cada instancia hace su propio tick.
import { useState, useEffect } from 'react';

export default function Cronometro({ desdeIso, color = 'var(--cian)' }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!desdeIso) return <span className="crono" style={{ color }}>00:00:00</span>;

  const seg = Math.max(0, Math.floor((Date.now() - new Date(desdeIso)) / 1000));
  const h = String(Math.floor(seg / 3600)).padStart(2, '0');
  const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
  const s = String(seg % 60).padStart(2, '0');

  return (
    <span className="crono" style={{ color, textShadow: `0 0 12px ${color}` }}>
      {h}:{m}:{s}
    </span>
  );
}
