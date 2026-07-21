// ============================================================
//  CarambolaSoft — El Parche de Jony
//  src/App.jsx — navegación + semillas + estilos globales
// ============================================================
import { useState, useEffect } from 'react';
import { openDb } from './db/schema.js';
import { getAll } from './db/repository.js';
import TableroMesas from './screens/TableroMesas.jsx';
import DetalleCuenta from './screens/DetalleCuenta.jsx';

// ------------------------------------------------------------
// Semillas locales (Ids fijos = idempotentes ante StrictMode).
// Directo al store, SIN cola: son referencia local, no cambios
// pendientes de subir. El sync real las reemplazará por las de SQL.
// ------------------------------------------------------------
async function sembrar() {
  const db = await openDb();

  const mesas = await getAll('MESAS_BILLAR');
  if (mesas.length === 0) {
    await escribir(db, 'MESAS_BILLAR', [{
      Id: '00000000-0000-0000-0000-000000000001',
      Numero: 1, Tipo: 'CARAMBOLA', Estado: 'DISPONIBLE',
    }]);
  }

  const prods = await getAll('PRODUCTOS');
  if (prods.length === 0) {
    await escribir(db, 'PRODUCTOS', [
      { Id: '00000000-0000-0000-0000-000000000101', Nombre: 'Cerveza Águila',      PrecioVenta: 5000,  CostoCompra: 3000,  StockActual: 24, CategoriaConsumo: 'BEBIDAS_ALCOHOLICAS', Activo: true },
      { Id: '00000000-0000-0000-0000-000000000102', Nombre: 'Cerveza Poker',       PrecioVenta: 5000,  CostoCompra: 3000,  StockActual: 24, CategoriaConsumo: 'BEBIDAS_ALCOHOLICAS', Activo: true },
      { Id: '00000000-0000-0000-0000-000000000103', Nombre: 'Media de Aguardiente', PrecioVenta: 55000, CostoCompra: 42000, StockActual: 6,  CategoriaConsumo: 'BEBIDAS_ALCOHOLICAS', Activo: true },
      { Id: '00000000-0000-0000-0000-000000000104', Nombre: 'Gaseosa',             PrecioVenta: 4000,  CostoCompra: 2200,  StockActual: 18, CategoriaConsumo: 'BEBIDAS_NO_ALCOHOLICAS', Activo: true },
      { Id: '00000000-0000-0000-0000-000000000105', Nombre: 'Papas',               PrecioVenta: 3500,  CostoCompra: 2000,  StockActual: 15, CategoriaConsumo: 'SNACKS', Activo: true },
    ]);
  }
}

function escribir(db, tabla, registros) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readwrite');
    const store = tx.objectStore(tabla);
    for (const r of registros) {
      store.put({ ...r, EsSincronizado: true, UltimaModificacion: new Date().toISOString() });
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export default function App() {
  const [ruta, setRuta] = useState({ pantalla: 'tablero' });
  const [listo, setListo] = useState(false);

  useEffect(() => { sembrar().then(() => setListo(true)); }, []);

  if (!listo) return null;

  return (
    <div className="tablero">
      <style>{ESTILOS}</style>
      {ruta.pantalla === 'tablero' && (
        <TableroMesas irACuenta={(cuentaId) => setRuta({ pantalla: 'cuenta', cuentaId })} />
      )}
      {ruta.pantalla === 'cuenta' && (
        <DetalleCuenta cuentaId={ruta.cuentaId} volver={() => setRuta({ pantalla: 'tablero' })} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Estilos globales (mientras llega el refactor a CSS propio)
// ------------------------------------------------------------
const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;900&display=swap');

:root {
  --fondo: #0b0f19;
  --cian: #22d3ee;
  --magenta: #e879f9;
  --verde: #4ade80;
  --amarillo: #facc15;
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

.cabecera { display: flex; align-items: baseline; gap: 14px; margin-bottom: 28px; }
.cabecera.detalle { align-items: center; justify-content: space-between; flex-wrap: wrap; }
.marca { font-weight: 900; font-size: 34px; letter-spacing: 2px; color: #fff; }
.marca.chica { font-size: 28px; }
.marca span { color: var(--cian); text-shadow: 0 0 18px var(--cian); }
.subtitulo { color: var(--gris); font-size: 18px; letter-spacing: 3px; }
.volver {
  background: transparent; border: 1px solid var(--gris); color: #e2e8f0;
  font-family: inherit; font-weight: 600; font-size: 18px; letter-spacing: 2px;
  padding: 10px 18px; border-radius: 10px; cursor: pointer;
}
.total-vivo {
  font-weight: 900; font-size: 36px; color: var(--verde);
  text-shadow: 0 0 14px rgba(74,222,128,.6); font-variant-numeric: tabular-nums;
}
.linea-tiempo { color: var(--cian); letter-spacing: 1px; font-size: 18px; margin-bottom: 8px; }

.rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
.rejilla.productos { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }

.tarjeta {
  border-radius: 14px; padding: 22px; background: rgba(11,15,25,.85);
  border: 2px solid var(--gris); cursor: pointer;
  transition: transform .05s ease; user-select: none;
}
.tarjeta:active { transform: scale(.97); }
.tarjeta.disponible { border-color: var(--cian); box-shadow: 0 0 16px rgba(34,211,238,.35), inset 0 0 24px rgba(34,211,238,.06); }
.tarjeta.ocupada { border-color: var(--magenta); box-shadow: 0 0 16px rgba(232,121,249,.4), inset 0 0 24px rgba(232,121,249,.07); }
.tarjeta.licores { border-color: var(--magenta); border-style: dashed; }

.mesa-num { font-weight: 900; font-size: 44px; line-height: 1; }
.mesa-tipo { color: var(--gris); letter-spacing: 3px; font-size: 15px; }
.estado { margin-top: 12px; font-weight: 600; letter-spacing: 2px; font-size: 17px; }
.disponible .estado { color: var(--cian); }
.ocupada .estado { color: var(--magenta); }
.crono { display: block; margin-top: 6px; font-weight: 900; font-size: 34px; font-variant-numeric: tabular-nums; }
.titular { margin-top: 6px; font-size: 19px; color: #cbd5e1; }

.boton-licores {
  margin-top: 28px; width: 100%; padding: 22px; border-radius: 14px;
  background: transparent; border: 2px solid var(--magenta);
  box-shadow: 0 0 18px rgba(232,121,249,.35); color: var(--magenta);
  font-family: inherit; font-weight: 900; font-size: 26px; letter-spacing: 4px;
  cursor: pointer; transition: transform .05s ease;
}
.boton-licores:active { transform: scale(.98); }

.boton-cobrar {
  position: sticky; bottom: 16px; margin-top: 28px; width: 100%; padding: 22px;
  border-radius: 14px; border: none; background: var(--verde); color: var(--fondo);
  box-shadow: 0 0 24px rgba(74,222,128,.5);
  font-family: inherit; font-weight: 900; font-size: 26px; letter-spacing: 3px;
  cursor: pointer; transition: transform .05s ease;
}
.boton-cobrar:active { transform: scale(.98); }

.seccion { margin-top: 26px; }
.seccion h2 { color: var(--magenta); font-size: 20px; letter-spacing: 3px; font-weight: 600; margin-bottom: 14px; }
.vacio { color: var(--gris); font-size: 18px; }
.link-rojo { background: none; border: none; color: #f87171; font-family: inherit; font-size: 18px; cursor: pointer; text-decoration: underline; }

.prod {
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
  padding: 14px; border-radius: 12px; background: rgba(11,15,25,.85);
  border: 1px solid var(--gris); color: #e2e8f0;
  font-family: inherit; cursor: pointer; transition: transform .05s ease;
}
.prod:active { transform: scale(.96); }
.prod:disabled { opacity: .35; cursor: not-allowed; }
.prod-nombre { font-weight: 600; font-size: 19px; }
.prod-precio { color: var(--verde); font-weight: 900; font-size: 20px; }
.prod-stock { color: var(--gris); font-size: 14px; }

.fila-pedido {
  display: grid; grid-template-columns: 1fr auto auto auto; gap: 14px; align-items: center;
  padding: 12px 14px; border-bottom: 1px solid rgba(71,85,105,.4); font-size: 20px;
}
.fp-cant { color: var(--cian); font-weight: 600; }
.fp-sub { color: var(--verde); font-weight: 900; font-variant-numeric: tabular-nums; }
.fp-quitar {
  width: 42px; height: 42px; border-radius: 10px; border: 1px solid #f87171;
  background: transparent; color: #f87171; font-size: 24px; cursor: pointer;
}

.velo { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: grid; place-items: center; padding: 20px; z-index: 10; }
.modal {
  width: min(460px, 100%); background: var(--fondo);
  border: 2px solid var(--cian); box-shadow: 0 0 30px rgba(34,211,238,.4);
  border-radius: 16px; padding: 28px; max-height: 92vh; overflow-y: auto;
}
.modal h3 { font-weight: 900; font-size: 26px; letter-spacing: 2px; margin-bottom: 14px; }
.total-modal { text-align: center; font-weight: 900; font-size: 34px; color: var(--verde); margin-bottom: 10px; }
.total-modal small { display: block; font-size: 12px; color: var(--gris); letter-spacing: 3px; font-weight: 600; }
.modal label { display: block; color: var(--gris); letter-spacing: 2px; font-size: 15px; margin: 14px 0 6px; }
.modal input, .modal select {
  width: 100%; padding: 14px; font-size: 20px; font-family: inherit; color: #fff;
  background: rgba(34,211,238,.06); border: 1px solid var(--cian); border-radius: 10px; outline: none;
}
.devuelta { margin-top: 10px; font-size: 19px; letter-spacing: 1px; }
.check-mixto { display: flex !important; align-items: center; gap: 10px; cursor: pointer; }
.check-mixto input { width: auto !important; }
.mixto { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(34,211,238,.04); border-radius: 10px; padding: 12px; margin-top: 8px; }
.mixto label { margin-top: 0; }

.acciones { display: flex; gap: 12px; margin-top: 24px; }
.acciones button {
  flex: 1; padding: 16px; border-radius: 10px; border: none;
  font-family: inherit; font-weight: 900; font-size: 19px; letter-spacing: 2px; cursor: pointer;
}
.abrir { background: var(--cian); color: var(--fondo); box-shadow: 0 0 14px rgba(34,211,238,.5); }
.cancelar { background: transparent; color: var(--gris); border: 1px solid var(--gris); }
`;
