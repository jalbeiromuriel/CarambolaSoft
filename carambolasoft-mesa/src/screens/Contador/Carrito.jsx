// Carrito de consumo: panel lateral de SOLO LECTURA. Precio por producto en verde; la línea "Tiempo de mesa" solo lleva la hora.
// El total aproximado va oculto por defecto: "Ver total" lo muestra y se oculta solo a los 10 s.
// [RIESGO] excepción a "no plata en pantallas públicas": con modoTV el carrito NO existe (devuelve null).
import { useEffect, useState } from 'react';
import { hms } from '../../marcador/logica.js';
import { AUTOOCULTAR_MS, pesos } from '../../marcador/carambolas.js';
import { IcoX, IcoOjo, IcoOjoTachado, IcoReloj } from './Piezas.jsx';

// Hora de la última vez que se agregó ese producto (hora de la tablet): «8:55 p. m.».
const horaCorta = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '—');

export default function Carrito({ abierto, onCerrar, mesa, modoTV = false }) {
  const [verTotal, setVerTotal] = useState(false);

  useEffect(() => {
    if (!verTotal) return undefined;
    const t = setTimeout(() => setVerTotal(false), AUTOOCULTAR_MS);
    return () => clearTimeout(t);
  }, [verTotal]);
  useEffect(() => { if (!abierto) setVerTotal(false); }, [abierto]);

  if (modoTV || !abierto) return null;
  return (
    <>
      <div className="ca-velo" onClick={onCerrar} />
      <aside className="ca-carrito" aria-label="Consumo de la mesa">
        <div className="ca-car-cab">
          <div>
            <div className="ca-car-titulo">CONSUMO DE LA MESA</div>
            <div className="ca-car-sub">BILLAR · {mesa.nombre.toUpperCase()}</div>
          </div>
          <button type="button" className="ca-car-x" aria-label="Cerrar consumo" onClick={onCerrar}><IcoX /></button>
        </div>

        <div className="ca-car-lista">
          {mesa.consumo.length === 0 && <div className="ca-car-fila vacio"><span>Aún sin pedidos</span></div>}
          {mesa.consumo.map((c) => (
            <div key={c.productoId} className="ca-car-fila">
              <span className="ca-car-hpedido">{horaCorta(c.hora)}</span><span className="ca-car-nom">{c.nombre}</span><span className="ca-car-cant">×{c.cantidad}</span><span className="ca-car-precio">{pesos(c.valor ?? 0)}</span>
            </div>
          ))}
          <div className="ca-car-fila tiempo"><span className="ca-car-nom">Tiempo de mesa</span><span className="ca-car-hora">{hms(mesa.segundos)}</span></div>
        </div>

        <div className="ca-car-flex" />

        {verTotal ? (
          <div className="ca-total visible">
            <div className="ca-total-et">TOTAL APROXIMADO</div>
            <div className="ca-total-v">{pesos(mesa.totalAprox ?? 0)}</div>
            <div className="ca-total-nota">Consumo más el tiempo de ahora y 2 minutos, redondeado a $100. No es la cuenta final.</div>
            <button type="button" className="ca-total-btn" onClick={() => setVerTotal(false)}><IcoOjoTachado />Ocultar total</button>
            <div className="ca-total-auto"><IcoReloj />Se oculta solo en 10 s</div>
          </div>
        ) : (
          <div className="ca-total">
            <div className="ca-total-et">¿EN CUÁNTO VAMOS?</div>
            <div className="ca-total-v oculto">$ ••••••</div>
            <button type="button" className="ca-total-btn oro" onClick={() => setVerTotal(true)}><IcoOjo />Ver total</button>
            <div className="ca-total-auto sin">Se oculta solo a los 10 segundos.</div>
          </div>
        )}
        <div className="ca-car-pie">El precio del tiempo se suma en el total aproximado. Esta vista es solo de lectura.</div>
      </aside>
    </>
  );
}
