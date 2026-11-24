// Reloj ÚNICO de la mesa + consumo, leídos de la cuenta que abrió la barra. Carambolas no tiene reloj propio.
// conPrecios=false (modo TV) NUNCA trae precios ni total: el dinero no existe en esa pantalla.
import { useEffect, useRef, useState } from 'react';
import { cuentasDeMesa, leerConsumoMesa } from '../../marcador/datos.js';
import { msJugados, tiemposMesa } from '../../cuenta/tiempo.js';
import { MARGEN_TOTAL_MS, totalAproximado } from '../../marcador/carambolas.js';

/** Segundos de la mesa: el taxímetro de la cuenta con tarifa; sin tarifa, desde que se abrió la cuenta. */
export function segundosDeMesa(cuentas, ahora = Date.now()) {
  const taxi = cuentas.find((c) => c.TarifaPorHora);
  if (taxi) return Math.floor(msJugados(taxi, ahora) / 1000);
  const c0 = cuentas[0];
  return c0 ? Math.max(0, Math.floor((ahora - Date.parse(c0.HoraApertura)) / 1000)) : 0;
}

export function useMesaViva(mesaId, { conPrecios = true, cada = 4000 } = {}) {
  const [cuentas, setCuentas] = useState([]);
  const [consumo, setConsumo] = useState([]);
  const [ahora, setAhora] = useState(Date.now());
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    const leer = async () => {
      try {
        const [c, k] = await Promise.all([cuentasDeMesa(mesaId), leerConsumoMesa(mesaId, { conPrecios })]);
        if (vivo.current) { setCuentas(c); setConsumo(k); }
      } catch (e) { console.error('[carambolas] mesa viva', e); }
    };
    leer();
    const t = setInterval(leer, cada);
    const r = setInterval(() => setAhora(Date.now()), 1000);
    return () => { vivo.current = false; clearInterval(t); clearInterval(r); };
  }, [mesaId, conPrecios, cada]);

  let totalAprox = null;
  if (conPrecios) {
    const valorConsumo = consumo.reduce((s, x) => s + (x.valor ?? 0), 0);
    const valorTiempo = tiemposMesa(cuentas, ahora + MARGEN_TOTAL_MS).reduce((s, x) => s + x, 0);
    totalAprox = totalAproximado(valorConsumo, valorTiempo);
  }
  return {
    cuentas, consumo, ahora, totalAprox,
    nombre: cuentas.find((c) => c.NombreLibre)?.NombreLibre ?? '',
    segundos: segundosDeMesa(cuentas, ahora),
  };
}
