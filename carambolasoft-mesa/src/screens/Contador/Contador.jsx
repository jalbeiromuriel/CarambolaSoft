// ============================================================
//  CarambolaSoft — Mero Parche
//  screens/Contador/Contador.jsx — módulo del Contador del billar (Inicio, Clientes, Marcador).
//  Maqueta aprobada en referencias/contador/. Se abre con  #contador  desde el tablero de mesas.
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import './contador.css';
import Inicio from './Inicio.jsx';
import Clientes from './Clientes.jsx';
import Marcador from './Marcador.jsx';
import PinModal from './PinModal.jsx';

const BLOQUEO_ADMIN_MS = 2 * 60 * 1000;   // el desbloqueo de administrador caduca solo

export default function Contador({ salir }) {
  const [vista, setVista] = useState({ nombre: 'inicio' });          // inicio | clientes | marcador
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

  /** Pide el PIN. Devuelve true si el administrador lo confirmó. */
  const pedir = useCallback((motivo) => new Promise((resolver) => setPin({ motivo, resolver })), []);
  const admin = {
    activo,
    pedir,
    bloquear: () => setAdminHasta(0),
    modal: pin && (
      <PinModal
        motivo={pin.motivo}
        onOk={() => { setAdminHasta(Date.now() + BLOQUEO_ADMIN_MS); pin.resolver(true); setPin(null); }}
        onCancelar={() => { pin.resolver(false); setPin(null); }}
      />
    ),
  };

  if (vista.nombre === 'clientes') return <Clientes admin={admin} irInicio={() => setVista({ nombre: 'inicio' })} irMarcador={() => setVista({ nombre: 'inicio', jugar: true })} />;
  if (vista.nombre === 'marcador') return <Marcador mesaId={vista.mesaId} admin={admin} irInicio={() => setVista({ nombre: 'inicio' })} irClientes={() => setVista({ nombre: 'clientes' })} />;
  return (
    <Inicio
      salir={salir}
      abrirSelector={vista.jugar}
      irClientes={() => setVista({ nombre: 'clientes' })}
      jugar={(mesaId) => setVista({ nombre: 'marcador', mesaId })}
    />
  );
}
