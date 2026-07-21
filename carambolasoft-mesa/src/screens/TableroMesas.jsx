// src/screens/TableroMesas.jsx
// Pantalla 1 — Tablero de Mesas. Fuente de verdad: IndexedDB.
import { useState, useEffect, useCallback } from 'react';
import { put, getAll, porIndice } from '../db/repository.js';
import Cronometro from '../components/Cronometro.jsx';

export default function TableroMesas({ irACuenta }) {
  const [mesas, setMesas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [modal, setModal] = useState(null); // { tipo:'BILLAR', mesa } | { tipo:'LICORES' }
  const [nombre, setNombre] = useState('');
  const [tarifa, setTarifa] = useState('');

  const cargar = useCallback(async () => {
    setMesas((await getAll('MESAS_BILLAR')).sort((a, b) => a.Numero - b.Numero));
    setCuentas(await porIndice('CUENTAS', 'porEstado', 'ABIERTA'));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cuentaDeMesa = (mesaId) => cuentas.find((c) => c.MesaId === mesaId);
  const cuentasLicores = cuentas.filter((c) => !c.MesaId);

  async function abrirCuenta() {
    if (!nombre.trim()) return;
    const esBillar = modal.tipo === 'BILLAR';

    const cuenta = await put('CUENTAS', {
      TipoCuenta: modal.tipo,
      MesaId: esBillar ? modal.mesa.Id : null,
      ClienteId: null,
      NombreLibre: nombre.trim(),
      HoraApertura: new Date().toISOString(),
      HoraCierre: null,
      TarifaPorHora: esBillar && tarifa ? Number(tarifa) : null,
      Estado: 'ABIERTA',
    });

    if (esBillar) await put('MESAS_BILLAR', { ...modal.mesa, Estado: 'OCUPADA' });

    setModal(null); setNombre(''); setTarifa('');
    irACuenta(cuenta.Id); // directo al detalle, como en el POS
  }

  return (
    <>
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
              onClick={() => (ocupada ? irACuenta(cuenta.Id) : setModal({ tipo: 'BILLAR', mesa }))}
            >
              <div className="mesa-num">MESA {mesa.Numero}</div>
              <div className="mesa-tipo">{mesa.Tipo}</div>
              {ocupada ? (
                <>
                  <div className="estado">OCUPADA</div>
                  <Cronometro desdeIso={cuenta.HoraApertura} />
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
              <div key={c.Id} className="tarjeta licores" onClick={() => irACuenta(c.Id)}>
                <div className="titular" style={{ fontSize: 24, fontWeight: 600 }}>{c.NombreLibre}</div>
                <Cronometro desdeIso={c.HoraApertura} color="var(--magenta)" />
              </div>
            ))}
          </div>
        </section>
      )}

      {modal && (
        <div className="velo" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3>{modal.tipo === 'BILLAR' ? `ABRIR MESA ${modal.mesa.Numero}` : 'CUENTA DE LICORES'}</h3>
            <label>¿A NOMBRE DE QUIÉN?</label>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Carlos gorra roja" />
            {modal.tipo === 'BILLAR' && (
              <>
                <label>TARIFA POR HORA (COP)</label>
                <input type="number" value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="12000" />
              </>
            )}
            <div className="acciones">
              <button className="cancelar" onClick={() => setModal(null)}>CANCELAR</button>
              <button className="abrir" onClick={abrirCuenta}>ABRIR CUENTA</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
