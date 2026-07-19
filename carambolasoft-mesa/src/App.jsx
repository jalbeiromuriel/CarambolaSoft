// ============================================================
//  CarambolaSoft — El Parche de Jony
//  Pantalla 1 — Tablero de Mesas (src/App.jsx)
//  Fuente de verdad: IndexedDB vía db/repository.js (Offline-First)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { openDb } from './db/schema.js';
import { put, getAll, porIndice } from './db/repository.js';

// ------------------------------------------------------------
// Semilla local: el Parche arranca con SU realidad — 1 mesa.
// Va directo al store SIN pasar por put(): es dato de referencia,
// no un cambio local pendiente de subir (evita duplicados en sync).
// ------------------------------------------------------------
async function sembrarMesas() {
  const mesas = await getAll('MESAS_BILLAR');
  if (mesas.length > 0) return;

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('MESAS_BILLAR', 'readwrite');
    tx.objectStore('MESAS_BILLAR').put({
      Id: '00000000-0000-0000-0000-000000000001', // Id fijo: semilla idempotente,
      Numero: 1,
      Tipo: 'CARAMBOLA',
      Estado: 'DISPONIBLE',
      EsSincronizado: true, // referencia local, no viaja a la cola
      UltimaModificacion: new Date().toISOString(),
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ------------------------------------------------------------
// Cronómetro: HH:MM:SS desde la apertura
// ------------------------------------------------------------
function tiempoTranscurrido(desdeIso) {
  if (!desdeIso) return '00:00:00';
  const seg = Math.max(0, Math.floor((Date.now() - new Date(desdeIso)) / 1000));
  const h = String(Math.floor(seg / 3600)).padStart(2, '0');
  const m = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
  const s = String(seg % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [mesas, setMesas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [modal, setModal] = useState(null); // { tipo: 'BILLAR', mesa } | { tipo: 'LICORES' }
  const [nombre, setNombre] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [, setTick] = useState(0); // fuerza re-render del cronómetro

  const cargar = useCallback(async () => {
    setMesas((await getAll('MESAS_BILLAR')).sort((a, b) => a.Numero - b.Numero));
    setCuentas(await porIndice('CUENTAS', 'porEstado', 'ABIERTA'));
  }, []);

  useEffect(() => {
    sembrarMesas().then(cargar);
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [cargar]);

  const cuentaDeMesa = (mesaId) => cuentas.find((c) => c.MesaId === mesaId);
  const cuentasLicores = cuentas.filter((c) => !c.MesaId);

  // ----------------------------------------------------------
  // Abrir cuenta (BILLAR con mesa, o LICORES sin mesa)
  // ----------------------------------------------------------
  async function abrirCuenta() {
    if (!nombre.trim()) return;

    const esBillar = modal.tipo === 'BILLAR';
    await put('CUENTAS', {
      TipoCuenta: modal.tipo,
      MesaId: esBillar ? modal.mesa.Id : null,
      ClienteId: null,
      NombreLibre: nombre.trim(),
      HoraApertura: new Date().toISOString(),
      HoraCierre: null,
      TarifaPorHora: esBillar && tarifa ? Number(tarifa) : null,
      Estado: 'ABIERTA',
    });

    if (esBillar) {
      await put('MESAS_BILLAR', { ...modal.mesa, Estado: 'OCUPADA' });
    }

    setModal(null);
    setNombre('');
    setTarifa('');
    await cargar();
  }

  return (
    <div className="tablero">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;900&display=swap');

        :root {
          --fondo: #0b0f19;
          --cian: #22d3ee;      /* tiempos */
          --magenta: #e879f9;   /* licores */
          --verde: #4ade80;     /* finanzas */
          --amarillo: #facc15;  /* alertas */
          --gris: #475569;
        }
        * { box-sizing: border-box; margin: 0; }
        body { background: var(--fondo); }

        .tablero {
          min-height: 100vh;
          background:
            linear-gradient(rgba(34,211,238,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,.05) 1px, transparent 1px),
            var(--fondo);
          background-size: 44px 44px;
          font-family: 'Barlow Condensed', sans-serif;
          color: #e2e8f0;
          padding: 24px;
        }

        .cabecera {
          display: flex; align-items: baseline; gap: 14px;
          margin-bottom: 28px;
        }
        .marca {
          font-weight: 900; font-size: 34px; letter-spacing: 2px;
          color: #fff;
        }
        .marca span { color: var(--cian); text-shadow: 0 0 18px var(--cian); }
        .subtitulo { color: var(--gris); font-size: 18px; letter-spacing: 3px; }

        .rejilla {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
        }

        .tarjeta {
          border-radius: 14px;
          padding: 22px;
          background: rgba(11,15,25,.85);
          border: 2px solid var(--gris);
          cursor: pointer;
          transition: transform .05s ease; /* respuesta táctil <50ms */
          user-select: none;
        }
        .tarjeta:active { transform: scale(.97); }

        .tarjeta.disponible {
          border-color: var(--cian);
          box-shadow: 0 0 16px rgba(34,211,238,.35), inset 0 0 24px rgba(34,211,238,.06);
        }
        .tarjeta.ocupada {
          border-color: var(--magenta);
          box-shadow: 0 0 16px rgba(232,121,249,.4), inset 0 0 24px rgba(232,121,249,.07);
        }
        .tarjeta.licores {
          border-color: var(--magenta);
          border-style: dashed;
        }

        .mesa-num { font-weight: 900; font-size: 44px; line-height: 1; }
        .mesa-tipo { color: var(--gris); letter-spacing: 3px; font-size: 15px; }
        .estado { margin-top: 12px; font-weight: 600; letter-spacing: 2px; font-size: 17px; }
        .disponible .estado { color: var(--cian); }
        .ocupada .estado { color: var(--magenta); }

        .crono {
          margin-top: 6px; font-weight: 900; font-size: 34px;
          color: var(--cian); text-shadow: 0 0 12px rgba(34,211,238,.6);
          font-variant-numeric: tabular-nums;
        }
        .titular { margin-top: 6px; font-size: 19px; color: #cbd5e1; }

        .boton-licores {
          margin-top: 28px; width: 100%;
          padding: 22px; border-radius: 14px;
          background: transparent;
          border: 2px solid var(--magenta);
          box-shadow: 0 0 18px rgba(232,121,249,.35);
          color: var(--magenta);
          font-family: inherit; font-weight: 900; font-size: 26px; letter-spacing: 4px;
          cursor: pointer; transition: transform .05s ease;
        }
        .boton-licores:active { transform: scale(.98); }

        .seccion { margin-top: 30px; }
        .seccion h2 {
          color: var(--magenta); font-size: 20px; letter-spacing: 3px;
          font-weight: 600; margin-bottom: 14px;
        }

        /* Modal */
        .velo {
          position: fixed; inset: 0; background: rgba(0,0,0,.7);
          display: grid; place-items: center; padding: 20px;
        }
        .modal {
          width: min(440px, 100%);
          background: var(--fondo);
          border: 2px solid var(--cian);
          box-shadow: 0 0 30px rgba(34,211,238,.4);
          border-radius: 16px; padding: 28px;
        }
        .modal h3 { font-weight: 900; font-size: 26px; letter-spacing: 2px; margin-bottom: 18px; }
        .modal label { display: block; color: var(--gris); letter-spacing: 2px; font-size: 15px; margin: 14px 0 6px; }
        .modal input {
          width: 100%; padding: 14px; font-size: 20px;
          font-family: inherit; color: #fff;
          background: rgba(34,211,238,.06);
          border: 1px solid var(--cian); border-radius: 10px; outline: none;
        }
        .acciones { display: flex; gap: 12px; margin-top: 24px; }
        .acciones button {
          flex: 1; padding: 16px; border-radius: 10px; border: none;
          font-family: inherit; font-weight: 900; font-size: 19px; letter-spacing: 2px;
          cursor: pointer;
        }
        .abrir { background: var(--cian); color: var(--fondo); box-shadow: 0 0 14px rgba(34,211,238,.5); }
        .cancelar { background: transparent; color: var(--gris); border: 1px solid var(--gris); }
      `}</style>

      <header className="cabecera">
        <div className="marca">EL PARCHE <span>DE JONY</span></div>
        <div className="subtitulo">TABLERO DE MESAS</div>
      </header>

      <div className="rejilla">
        {mesas.map((mesa) => {
          const cuenta = cuentaDeMesa(mesa.Id);
          const ocupada = mesa.Estado === 'OCUPADA' && cuenta;
          return (
            <div
              key={mesa.Id}
              className={`tarjeta ${ocupada ? 'ocupada' : 'disponible'}`}
              onClick={() =>
                ocupada
                  ? alert('Pantalla 2 (detalle de cuenta) — en construcción')
                  : setModal({ tipo: 'BILLAR', mesa })
              }
            >
              <div className="mesa-num">MESA {mesa.Numero}</div>
              <div className="mesa-tipo">{mesa.Tipo}</div>
              {ocupada ? (
                <>
                  <div className="estado">OCUPADA</div>
                  <div className="crono">{tiempoTranscurrido(cuenta.HoraApertura)}</div>
                  <div className="titular">{cuenta.NombreLibre}</div>
                </>
              ) : (
                <div className="estado">DISPONIBLE — TOCÁ PARA ABRIR</div>
              )}
            </div>
          );
        })}
      </div>

      <button className="boton-licores" onClick={() => setModal({ tipo: 'LICORES' })}>
        🍺 ABRIR CUENTA DE LICORES
      </button>

      {cuentasLicores.length > 0 && (
        <section className="seccion">
          <h2>CUENTAS DE LICORES ABIERTAS</h2>
          <div className="rejilla">
            {cuentasLicores.map((c) => (
              <div
                key={c.Id}
                className="tarjeta licores"
                onClick={() => alert('Pantalla 2 (detalle de cuenta) — en construcción')}
              >
                <div className="titular" style={{ fontSize: 24, fontWeight: 600 }}>{c.NombreLibre}</div>
                <div className="crono" style={{ color: 'var(--magenta)', textShadow: '0 0 12px rgba(232,121,249,.6)' }}>
                  {tiempoTranscurrido(c.HoraApertura)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {modal && (
        <div className="velo" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>
              {modal.tipo === 'BILLAR'
                ? `ABRIR MESA ${modal.mesa.Numero}`
                : 'CUENTA DE LICORES'}
            </h3>

            <label>¿A NOMBRE DE QUIÉN?</label>
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Carlos gorra roja"
            />

            {modal.tipo === 'BILLAR' && (
              <>
                <label>TARIFA POR HORA (COP)</label>
                <input
                  type="number"
                  value={tarifa}
                  onChange={(e) => setTarifa(e.target.value)}
                  placeholder="12000"
                />
              </>
            )}

            <div className="acciones">
              <button className="cancelar" onClick={() => setModal(null)}>CANCELAR</button>
              <button className="abrir" onClick={abrirCuenta}>ABRIR CUENTA</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
