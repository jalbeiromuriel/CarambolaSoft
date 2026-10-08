// src/components/Inactividad.jsx — Cierra la sesión tras INACTIVIDAD_MS sin tocar nada; avisa 30 s antes.
import { useEffect, useRef, useState } from 'react';
import { INACTIVIDAD_MS, AVISO_INACTIVIDAD_MS, estadoInactividad } from '../cuenta/auth.js';
import { mmss } from '../cuenta/garita.js';

export default function Inactividad({ cerrar }) {
  const ultimo = useRef(Date.now());
  const [estado, setEstado] = useState('activa');
  const [resta, setResta] = useState(0);

  useEffect(() => {
    const mover = () => { ultimo.current = Date.now(); setEstado((e) => (e === 'activa' ? e : 'activa')); };
    const eventos = ['pointerdown', 'keydown', 'touchstart'];
    eventos.forEach((e) => window.addEventListener(e, mover, true));
    const t = setInterval(() => {
      const est = estadoInactividad(ultimo.current);
      if (est === 'cerrar') { clearInterval(t); cerrar(); return; }
      setEstado(est); setResta(INACTIVIDAD_MS - (Date.now() - ultimo.current));
    }, 1000);
    return () => { eventos.forEach((e) => window.removeEventListener(e, mover, true)); clearInterval(t); };
  }, [cerrar]);

  if (estado !== 'aviso') return null;
  return <div className="al-inact">🔒 Por inactividad la sesión se cierra en {mmss(Math.min(resta, AVISO_INACTIVIDAD_MS))} — toca la pantalla para seguir</div>;
}
