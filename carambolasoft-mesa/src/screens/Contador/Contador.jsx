// ============================================================
//  CarambolaSoft — Mero Parche
//  screens/Contador/Contador.jsx — módulo Carambolas (antes "Contador").
//  Flujo: Entrada (respaldo, varias mesas) → ¿Quién juega? → Partida. Clientes se conserva.
//  Se abre con  #contador  desde el tablero de mesas. "← Panel" NO termina la partida.
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import './contador.css';
import './carambolas.css';
import Entrada from './Entrada.jsx';
import QuienJuega from './QuienJuega.jsx';
import Partida from './Partida.jsx';
import Clientes from './Clientes.jsx';
import PinModal from './PinModal.jsx';

const BLOQUEO_ADMIN_MS = 2 * 60 * 1000;   // el desbloqueo de administrador caduca solo

export default function Contador({ salir, irACuenta }) {
  const [vista, setVista] = useState({ nombre: 'entrada' });          // entrada | inicio | partida | clientes
  const [adminHasta, setAdminHasta] = useState(0);
  const [pin, setPin] = useState(null);                              // { motivo, resolver }
  const [, tick] = useState(0);
  const timer = useRef(null);

  const activo = Date.now() < adminHasta;
  useEffect(() => {
    clearTimeout(timer.current);
    if (adminHasta > Date.now()) timer.current = setTimeout(() => tick((n) => n + 1), adminHasta - Date.now() + 50);
    return () => clearTimeout(timer.current);
  }, [adminHasta]);

  // Atrás del navegador: no sacar al usuario del módulo por accidente; vuelve a la Entrada.
  useEffect(() => {
    window.history.pushState({ carambolas: true }, '');
    const atras = () => { setVista((v) => (v.nombre === 'entrada' ? v : { nombre: 'entrada' })); window.history.pushState({ carambolas: true }, ''); };
    window.addEventListener('popstate', atras);
    return () => window.removeEventListener('popstate', atras);
  }, []);

  /** Pide el PIN. Devuelve true si el administrador lo confirmó. */
  const pedir = useCallback((motivo) => new Promise((resolver) => setPin({ motivo, resolver })), []);
  const admin = {
    activo,
    pedir,
    bloquear: () => setAdminHasta(0),
    modal: pin && (
      <div className="ct-marcador ct-host">
        <PinModal
          motivo={pin.motivo}
          onOk={() => { setAdminHasta(Date.now() + BLOQUEO_ADMIN_MS); pin.resolver(true); setPin(null); }}
          onCancelar={() => { pin.resolver(false); setPin(null); }}
        />
      </div>
    ),
  };

  const irEntrada = () => setVista({ nombre: 'entrada' });
  if (vista.nombre === 'clientes') return <Clientes admin={admin} irInicio={irEntrada} irMarcador={irEntrada} />;
  if (vista.nombre === 'inicio') return <QuienJuega mesaId={vista.mesaId} salir={salir} onIniciada={() => setVista({ nombre: 'partida', mesaId: vista.mesaId })} />;
  if (vista.nombre === 'partida') {
    return (
      <Partida
        mesaId={vista.mesaId}
        admin={admin}
        salir={salir}
        irEntrada={irEntrada}
        irInicio={() => setVista({ nombre: 'inicio', mesaId: vista.mesaId })}
        irCuenta={irACuenta}
      />
    );
  }
  return (
    <Entrada
      salir={salir}
      admin={admin}
      irClientes={() => setVista({ nombre: 'clientes' })}
      jugar={(mesaId, enJuego) => setVista({ nombre: enJuego ? 'partida' : 'inicio', mesaId })}
    />
  );
}
