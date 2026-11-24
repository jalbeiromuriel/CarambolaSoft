// ¿QUIÉN JUEGA? — dos paneles: PARCHADOS 1 (línea cian) y PARCHADOS 2 (línea verde).
// Solo 1 contra 1 o 2 contra 2: no se pregunta "individual o parejas", se deduce de cuántos hay por lado.
// Al empezar ya no se agregan jugadores. EMPEZAR PARTIDA crea el chico (iniciarChico) y pasa a la partida.
import { useEffect, useState } from 'react';
import { nuevoGuid } from '../../db/repository.js';
import { mesasConCuenta, listarClientes, guardarCliente, iniciarChico } from '../../marcador/datos.js';
import { evaluarInicio, MAX_POR_LADO } from '../../marcador/carambolas.js';
import { Escenario, Barra, IcoX, IcoMas, IcoPlay } from './Piezas.jsx';
import Carrito from './Carrito.jsx';
import { useMesaViva } from './useMesaViva.js';
import { duplicadoDe } from '../../cuenta/nombres.js';

const LADOS = [{ n: 1, color: '#22d3ee' }, { n: 2, color: '#2e9e5b' }];
const nombreDe = (j) => (j.apodo || j.nombre).toUpperCase();

export default function QuienJuega({ mesaId, salir, onIniciada, modoTV = false }) {
  const mesa = useMesaViva(mesaId, { conPrecios: !modoTV });
  const [fila, setFila] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [jugadores, setJugadores] = useState([]);       // { id, nombre, apodo, esInvitado, lado, def }
  const [modal, setModal] = useState(null);             // { lado }
  const [busqueda, setBusqueda] = useState('');
  const [invitado, setInvitado] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoApodo, setNuevoApodo] = useState('');
  const [carrito, setCarrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    mesasConCuenta().then((f) => setFila(f.find((x) => x.mesa.Id === mesaId) ?? null));
    listarClientes().then((c) => setClientes(c.filter((x) => x.Activo !== false)));
  }, [mesaId]);

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(''), 3500); };
  const delLado = (n) => jugadores.filter((j) => j.lado === n);
  const ev = evaluarInicio(delLado(1).length, delLado(2).length);

  function agregar(def) {
    const lado = modal.lado;
    if (delLado(lado).length >= MAX_POR_LADO) return avisar(`Parchados ${lado} ya tiene ${MAX_POR_LADO} jugadores.`);
    const nombre = def.cliente ? def.cliente.Nombre : def.invitado.trim();
    setJugadores((l) => [...l, { id: nuevoGuid(), nombre, apodo: def.cliente?.Apodo ?? null, esInvitado: !def.cliente, lado, def }]);
    setModal(null); setBusqueda(''); setInvitado(''); setNuevoNombre(''); setNuevoApodo('');
  }
  /** Jugador nuevo creado en el momento (queda registrado como cliente, sin teléfono): así no hay que pasar por Clientes. */
  async function crearYAgregar() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return avisar('Escribe el nombre del jugador nuevo.');
    const repetido = duplicadoDe(clientes, { Nombre: nombre, Apodo: nuevoApodo });
    if (repetido) return avisar(repetido);
    try {
      const cliente = await guardarCliente({ Nombre: nombre, Apodo: nuevoApodo });
      setClientes((l) => [...l, cliente]);
      agregar({ cliente });
    } catch (e) { avisar(`No se pudo crear el jugador: ${e}`); }
  }
  const quitar = (id) => setJugadores((l) => l.filter((j) => j.id !== id));

  async function empezar() {
    if (!ev.puedeEmpezar || ocupado || !fila?.cuenta) return;
    setOcupado(true);
    try {
      const orden = [...delLado(1), ...delLado(2)];
      await iniciarChico(fila.cuenta, fila.mesa, orden.map((j) => ({ def: j.def, equipo: ev.modo === 'par' ? j.lado : undefined })));
      onIniciada();
    } catch (e) { avisar(`No se pudo empezar la partida: ${e}`); setOcupado(false); }
  }

  const yaAgregados = new Set(jugadores.map((j) => j.def.cliente?.Id).filter(Boolean));
  const t = busqueda.trim().toLowerCase();
  const lista = clientes.filter((c) => !yaAgregados.has(c.Id) && (!t || `${c.Nombre} ${c.Apodo ?? ''}`.toLowerCase().includes(t)));

  return (
    <Escenario>
      <Barra onPanel={salir} mesa={mesa} carrito={modoTV ? null : { count: mesa.consumo.length, onClick: () => setCarrito(true) }} />
      <main className="ca-main ca-quien">
        <div>
          <div className="ca-sobre">BILLAR · {mesa.nombre.toUpperCase()} · ANTES DE EMPEZAR</div>
          <h1 className="ca-h1">¿QUIÉN JUEGA?</h1>
        </div>

        <div className="ca-lados">
          {LADOS.map(({ n, color }) => {
            const js = delLado(n);
            return (
              <section key={n} className="ca-lado" style={{ '--c': color }} aria-label={`Parchados ${n}`}>
                <div className="ca-lado-cab"><span className="ca-num">{n}</span><span className="ca-lado-et">PARCHADOS {n}</span></div>
                {js.length === 0 && <div className="ca-lado-fantasma">PARCHADOS {n}</div>}
                {js.map((j) => (
                  <div key={j.id} className="ca-jug">
                    <div className="ca-jug-nom">{nombreDe(j)}</div>
                    <button type="button" className="ca-jug-x" aria-label={`Quitar a ${nombreDe(j)}`} onClick={() => quitar(j.id)}><IcoX t={26} /></button>
                  </div>
                ))}
                <div className="ca-flex" />
                {js.length === 0 && (
                  <button type="button" className="ca-add grande" aria-label={`Agregar jugador a Parchados ${n}`} onClick={() => setModal({ lado: n })}><IcoMas />Jugador</button>
                )}
                {js.length === 1 && (
                  <button type="button" className="ca-add" aria-label={`Agregar compañero a Parchados ${n}`} onClick={() => setModal({ lado: n })}><IcoMas />Jugador</button>
                )}
              </section>
            );
          })}
        </div>

        <div className="ca-pie-inicio">
          <div className={`ca-pie-msg ${ev.tono === 'alerta' ? 'alerta' : ''}`}>{ev.mensaje}</div>
          <button type="button" className="ca-btn-empezar" aria-disabled={!ev.puedeEmpezar || ocupado} onClick={empezar}><IcoPlay />EMPEZAR PARTIDA</button>
        </div>
      </main>

      <Carrito abierto={carrito} onCerrar={() => setCarrito(false)} mesa={mesa} modoTV={modoTV} />
      {aviso && <div className="ca-aviso">{aviso}</div>}

      {modal && (
        <div className="ca-modal" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="ca-card" style={{ '--c': LADOS[modal.lado - 1].color }}>
            <h4>AGREGAR A PARCHADOS {modal.lado} <button type="button" aria-label="Cerrar" onClick={() => setModal(null)}>✕</button></h4>
            <input className="ca-input" placeholder="Buscar cliente…" autoComplete="off" autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <div className="ca-clientes">
              {clientes.length === 0 && <p className="ca-nota">No hay clientes registrados. Crea uno nuevo abajo.</p>}
              {clientes.length > 0 && lista.length === 0 && <p className="ca-nota">Sin coincidencias. Crea el jugador nuevo abajo.</p>}
              {lista.map((c) => (
                <button key={c.Id} type="button" className="ca-fila-sel" onClick={() => agregar({ cliente: c })}>
                  <b>{c.Nombre}{c.Apodo ? ` (${c.Apodo})` : ''}</b><span>● CLIENTE</span>
                </button>
              ))}
            </div>
            <div className="ca-nota centro">— JUGADOR NUEVO —</div>
            <div className="ca-inv">
              <input className="ca-input" placeholder="Nombre" autoComplete="off" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crearYAgregar()} />
              <input className="ca-input corto" placeholder="Apodo (opcional)" autoComplete="off" value={nuevoApodo} onChange={(e) => setNuevoApodo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crearYAgregar()} />
              <button type="button" className="ca-btn-sec" onClick={crearYAgregar}>Crear</button>
            </div>
            <p className="ca-nota">Queda guardado como cliente: la próxima vez sale en la lista y cuenta para el récord.</p>
            <div className="ca-nota centro">— O INVITADO (SOLO POR HOY) —</div>
            <div className="ca-inv">
              <input className="ca-input" placeholder="Nombre del invitado" autoComplete="off" value={invitado} onChange={(e) => setInvitado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invitado.trim() && agregar({ invitado })} />
              <button type="button" className="ca-btn-sec" onClick={() => invitado.trim() && agregar({ invitado })}>Agregar</button>
            </div>
            <p className="ca-nota">Los invitados juegan y suman, pero no cuentan para el récord ni las rivalidades.</p>
          </div>
        </div>
      )}
    </Escenario>
  );
}
