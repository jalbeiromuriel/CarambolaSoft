// PIN de administrador. Si aún no hay PIN en esta tablet, pide crearlo (4 números, dos veces).
import { useState, useEffect, useRef } from 'react';
import { pinConfigurado, configurarPin, verificarPin, pinValido } from '../../marcador/pin.js';

const campo = { textAlign: 'center', letterSpacing: 14, fontSize: 26, padding: 14, margin: '6px 0', width: '100%' };
const boton = (color) => ({ width: '100%', marginTop: 8, background: 'transparent', border: `1px solid ${color}`, color, borderRadius: 9, padding: 12, fontWeight: 700, letterSpacing: 2, cursor: 'pointer', fontFamily: 'inherit' });

export default function PinModal({ motivo, onOk, onCancelar }) {
  const [crear, setCrear] = useState(null);       // null = cargando
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef(null);

  useEffect(() => { pinConfigurado().then((ok) => setCrear(!ok)); }, []);
  useEffect(() => { if (crear !== null) ref.current?.focus(); }, [crear]);

  async function confirmar() {
    if (ocupado) return;
    setError('');
    setOcupado(true);
    try {
      if (crear) {
        if (!pinValido(pin)) return setError('El PIN son 4 números.');
        if (pin !== pin2) return setError('Los dos PIN no coinciden.');
        await configurarPin(pin);
        onOk();
      } else {
        const r = await verificarPin(pin);
        if (r.ok) onOk();
        else if (r.bloqueadoSeg) setError(`Demasiados intentos. Espera ${r.bloqueadoSeg} s.`);
        else setError(`PIN incorrecto${r.restantes ? ` · quedan ${r.restantes}` : ''}`);
        setPin('');
      }
    } finally { setOcupado(false); }
  }

  return (
    <div className="ct-modal on" onClick={(e) => e.target === e.currentTarget && onCancelar()} style={{ zIndex: 60, background: 'rgba(2,5,12,.7)' }}>
      <div className="ct-mcard ct-pin">
        <h4>{crear ? 'CREAR PIN DE ADMINISTRADOR' : 'PIN DE ADMINISTRADOR'} <span className="ct-mx" onClick={onCancelar}>✕</span></h4>
        <div className="ct-mnote" style={{ margin: '0 0 6px' }}>{motivo}</div>
        {crear && <div className="ct-mnote" style={{ margin: '0 0 6px', color: 'var(--amarillo)' }}>Esta tablet aún no tiene PIN. Créalo ahora y no lo compartas.</div>}
        <input ref={ref} style={campo} type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && !crear && confirmar()} />
        {crear && (
          <input style={campo} type="password" inputMode="numeric" maxLength={4} placeholder="repite el PIN" value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && confirmar()} />
        )}
        <div style={{ color: 'var(--rojo)', fontSize: 12, minHeight: 15, textAlign: 'center' }}>{error}</div>
        <button style={boton('var(--verde)')} onClick={confirmar} disabled={ocupado || crear === null}>{crear ? 'GUARDAR PIN' : 'CONFIRMAR'}</button>
      </div>
    </div>
  );
}
