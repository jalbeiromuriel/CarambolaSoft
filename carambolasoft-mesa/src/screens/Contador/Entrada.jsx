// Entrada — "¿EN QUÉ MESA VAS A JUGAR?". Solo RESPALDO para un PC compartido sin mesa asignada:
// cada mesa tendrá su tablet atada a su mesa y entrará directo a "¿Quién juega?".
import { useEffect, useState } from 'react';
import { mesasConCuenta, cuentasDeMesa, cargarChico, listarInformes, leerInforme } from '../../marcador/datos.js';
import { marcadorCorto } from '../../marcador/carambolas.js';
import { hms } from '../../marcador/logica.js';
import Informe from './Informe.jsx';
import Tablero from './Tablero.jsx';
import { Escenario, Barra } from './Piezas.jsx';
import { segundosDeMesa } from './useMesaViva.js';

export default function Entrada({ salir, admin, irClientes, jugar }) {
  const [filas, setFilas] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const [lista, setLista] = useState(null);      // informes guardados (solo con PIN)
  const [ver, setVer] = useState(null);
  const [tablero, setTablero] = useState(null);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    const leer = async () => {
      try {
        const ocupadas = (await mesasConCuenta()).filter((f) => f.cuenta);
        const det = await Promise.all(ocupadas.map(async ({ mesa, cuenta }) => {
          const [cuentas, chico] = await Promise.all([cuentasDeMesa(mesa.Id), cargarChico(cuenta, mesa)]);
          return { mesa, cuenta, cuentas, chico };
        }));
        if (vivo) setFilas(det);
      } catch (e) { console.error('[carambolas] entrada', e); if (vivo) setFilas([]); }
    };
    leer();
    const t = setInterval(leer, 5000), r = setInterval(() => setAhora(Date.now()), 1000);
    return () => { vivo = false; clearInterval(t); clearInterval(r); };
  }, []);

  async function abrirInformes() {
    if (!admin.activo && !(await admin.pedir('Los informes tienen valores de caja: solo administrador.'))) return;
    setLista(await listarInformes());
  }
  async function abrirTablero() {
    const ultimo = (await listarInformes())[0];
    const d = ultimo ? await leerInforme(ultimo.id) : null;
    if (!d?.analisis?.series) { setAviso('Aún no hay una partida guardada con tablero.'); setTimeout(() => setAviso(''), 3500); return; }
    setTablero(d);
  }

  return (
    <Escenario>
      <Barra onPanel={salir} />
      <main className="ca-main ca-entrada">
        <div>
          <div className="ca-sobre">MESAS CON CUENTA ABIERTA EN LA BARRA</div>
          <h1 className="ca-h1">¿EN QUÉ MESA VAS A JUGAR?</h1>
        </div>

        {filas && filas.length === 0 && (
          <div className="ca-centro">
            <div className="ca-vacio">
              <div className="ca-vacio-t">No hay mesas abiertas</div>
              <div className="ca-vacio-d">Pídele a la barra que abra la cuenta de la mesa en el Panel y vuelve aquí.</div>
              <button type="button" className="ca-btn-sec" onClick={salir}>← Ir al Panel</button>
            </div>
          </div>
        )}
        {filas === null && <div className="ca-centro"><div className="ca-vacio-d">Cargando mesas…</div></div>}
        {filas && filas.length > 0 && (
          <div className="ca-mesas">
            {filas.map(({ mesa, cuenta, cuentas, chico }) => {
              const enJuego = Boolean(chico);
              const nombre = cuenta.NombreLibre ?? '';
              return (
                <section key={mesa.Id} className={`ca-mesa ${enJuego ? 'juego' : ''}`} aria-label={`Billar de ${nombre}, ${enJuego ? 'partida en juego' : 'sin partida'}`}>
                  <div>
                    <div className="ca-mesa-et">CUENTA ABIERTA POR {nombre.toUpperCase()}</div>
                    <div className="ca-mesa-nom">BILLAR · {nombre.toUpperCase()}</div>
                  </div>
                  <div className="ca-mesa-tiempo">
                    <div className="ca-mesa-tiempo-et">TIEMPO DE MESA</div>
                    <div className="ca-mesa-tiempo-v">{hms(segundosDeMesa(cuentas, ahora))}</div>
                  </div>
                  <div className={`ca-mesa-estado ${enJuego ? 'juego' : ''}`}>
                    {enJuego ? `EN JUEGO · ${marcadorCorto(chico.modo, chico.participantes)}` : 'SIN PARTIDA TODAVÍA'}
                  </div>
                  <button type="button" className="ca-btn-oro" onClick={() => jugar(mesa.Id, enJuego)}>{enJuego ? 'CONTINUAR' : 'JUGAR'}</button>
                </section>
              );
            })}
          </div>
        )}

        <div className="ca-tambien">
          <span>TAMBIÉN</span>
          <button type="button" className="ca-btn-sec" onClick={irClientes}>Clientes</button>
          <button type="button" className="ca-btn-sec" onClick={abrirTablero}>Tablero</button>
          <button type="button" className="ca-btn-sec" onClick={abrirInformes}>Informes guardados</button>
        </div>
      </main>

      {aviso && <div className="ca-aviso">{aviso}</div>}
      {lista && !ver && (
        <div className="ca-modal" onClick={(e) => e.target === e.currentTarget && setLista(null)}>
          <div className="ca-card">
            <h4>INFORMES GUARDADOS <button type="button" aria-label="Cerrar" onClick={() => setLista(null)}>✕</button></h4>
            {lista.length === 0 && <p className="ca-nota">Aún no hay informes. Se guardan al finalizar cada partida.</p>}
            {lista.map((i) => (
              <button key={i.id} type="button" className="ca-fila-sel" onClick={async () => setVer(await leerInforme(i.id))}>
                <b>MESA {String(i.mesa).padStart(2, '0')}</b><span>{i.fecha} · {i.ganador}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {ver && <div className="ct-marcador ct-host"><Informe d={ver} onPdf={() => window.print()} onInicio={() => setVer(null)} textoInicio="◂ CERRAR" /></div>}
      {tablero && <div className="ct-marcador ct-host" style={{ pointerEvents: 'auto' }}><Tablero d={tablero} onCerrar={() => setTablero(null)} /></div>}
      {admin.modal}
    </Escenario>
  );
}
