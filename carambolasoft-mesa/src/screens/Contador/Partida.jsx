// ============================================================
//  Partida de Carambolas — 1 contra 1 (bolas dentro del panel) y 2 contra 2 (botones planos, oro y trofeo).
//  Solo REGISTRA carambolas. No cobra, no hace pedidos, no toca stock ni caja; el reloj es el de la mesa (Panel).
//  Cada serie se guarda al instante: la pantalla se actualiza primero (optimista) y una cola de escritura
//  las persiste EN ORDEN, para que el récord del jugador nunca quede con un valor viejo.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { nuevoGuid } from '../../db/repository.js';
import { componerSerie, planCorreccion, rompeRecord } from '../../marcador/logica.js';
import { ladosDe, statsLado, ladoGanando, ultimaMarca, etiquetaJugador } from '../../marcador/carambolas.js';
import {
  mesasConCuenta, cargarReto, cargarChico, registrarSerie, corregirUltima, finalizarChico,
  leerConsumoMesa, tiempoDeMesa, retoInicialDe,
} from '../../marcador/datos.js';
import Informe, { construirInforme } from './Informe.jsx';
import Carrito from './Carrito.jsx';
import { Escenario, Barra, Bola, BolaMas, IcoCopa, IcoDeshacer } from './Piezas.jsx';
import { useMesaViva } from './useMesaViva.js';

const COLORES = ['#22d3ee', '#2e9e5b'];     // lado 1 cian · lado 2 verde (los 4 individuales usan además naranja y rojo)
const DIGITOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export default function Partida({ mesaId, admin, salir, irEntrada, irInicio, irCuenta, modoTV = false }) {
  const viva = useMesaViva(mesaId, { conPrecios: !modoTV });
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);             // { texto, accion }
  const [mesa, setMesa] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [sesion, setSesion] = useState(null);
  const [modo, setModo] = useState('ind');
  const [jugadores, setJugadores] = useState([]);
  const [comp, setComp] = useState(null);               // serie de 2 cifras: { clave, dig }
  const [reto, setReto] = useState(null);
  const [retoInicial, setRetoInicial] = useState(0);
  const [rompiendo, setRompiendo] = useState(false);
  const [corr, setCorr] = useState(null);               // { scope: 'todos' | 1 | 2 }
  const [informe, setInforme] = useState(null);
  const [carrito, setCarrito] = useState(false);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cola = useRef(Promise.resolve());
  const jugCache = useRef(new Map());                   // JugadorId -> jugador persistido más reciente
  const retoRef = useRef(null);
  const jugRef = useRef([]);
  retoRef.current = reto;
  jugRef.current = jugadores;

  const avisar = useCallback((t) => { setAviso(t); setTimeout(() => setAviso(''), 3500); }, []);
  const encolar = useCallback((fn, alFallar) => {
    cola.current = cola.current.then(fn).catch((e) => { console.error('[carambolas]', e); alFallar?.(e); });
    return cola.current;
  }, []);

  // ---------- carga ----------
  const cargar = useCallback(async () => {
    try {
      const fila = (await mesasConCuenta()).find((f) => f.mesa.Id === mesaId);
      if (!fila?.cuenta) return setFallo({ texto: 'Esta mesa ya no tiene una cuenta abierta. La abre la barra.', accion: irEntrada });
      setMesa(fila.mesa); setCuenta(fila.cuenta);
      const [r, chico] = await Promise.all([cargarReto(), cargarChico(fila.cuenta, fila.mesa)]);
      setReto(r);
      if (!chico) return setFallo({ texto: 'Todavía no hay una partida empezada en esta mesa.', accion: irInicio, etiqueta: '¿QUIÉN JUEGA?' });
      if (chico.modo === 'ind' && chico.participantes.length !== 2) {
        return setFallo({ texto: `Esta partida tiene ${chico.participantes.length} jugadores individuales. La pantalla de 4 individuales (2×2) está pendiente.`, accion: irEntrada });
      }
      setSesion(chico.sesion); setModo(chico.modo); setJugadores(chico.participantes);
      setRetoInicial(await retoInicialDe(chico.sesion.Id));
      chico.participantes.forEach((p) => p.jugador && jugCache.current.set(p.jugador.Id, p.jugador));
    } catch (e) { setFallo({ texto: `No se pudo cargar la partida: ${e}`, accion: irEntrada }); }
    finally { setCargando(false); }
  }, [mesaId, irEntrada, irInicio]);
  useEffect(() => { cargar(); }, [cargar]);

  // ---------- series ----------
  function sumarSerie(id, k) {
    const p = jugRef.current.find((j) => j.Id === id);
    if (!p || !(k >= 1)) return;
    const marcaId = nuevoGuid();
    const marca = { Id: marcaId, ParticipanteId: p.Id, MarcaTiempo: new Date().toISOString(), CarambolasEnMarca: k, Anulada: false, CorrigeA: null };
    setJugadores((l) => l.map((j) => (j.Id === p.Id ? { ...j, marcas: [...j.marcas, marca] } : j)));
    navigator.vibrate?.(12);

    // ¿Rompe el Reto del Parche? Solo un jugador registrado y solo si es ESTRICTAMENTE mayor.
    if (modo !== 'par' && !p.esInvitado && rompeRecord(k, retoRef.current?.serie ?? 0)) {
      const nuevoReto = { jugadorId: p.jugador?.Id ?? p.JugadorId, nombre: p.apodo || p.nombre, serie: k };
      retoRef.current = nuevoReto; setReto(nuevoReto);
      setRompiendo(true); setTimeout(() => setRompiendo(false), 3500);
    }

    encolar(async () => {
      const jug = modo !== 'par' && p.jugador ? jugCache.current.get(p.jugador.Id) ?? p.jugador : null;   // en parejas no se sabe quién tacó: no toca el récord personal
      const r = await registrarSerie({ ...p, jugador: jug }, k, marcaId);
      if (r.jugador) jugCache.current.set(r.jugador.Id, r.jugador);
    }, () => {
      avisar('No se pudo guardar la última serie. Revisa y vuelve a contarla.');
      setJugadores((l) => l.map((j) => (j.Id === p.Id ? { ...j, marcas: j.marcas.filter((m) => m.Id !== marcaId) } : j)));
    });
  }

  /** Dígito del "+" (serie de 2 cifras: 1,0 → 10). "00" no existe: no se registra el cero. */
  function digito(clave, destinoId, d) {
    const dig = (comp?.clave === clave ? comp.dig : '') + String(d);
    if (dig.length < 2) return setComp({ clave, dig });
    setComp(null);
    const v = componerSerie(dig);
    if (v) sumarSerie(destinoId, v);
  }

  function corregir(scope, delta) {
    const pool = scope === 'todos' ? jugRef.current : jugRef.current.filter((j) => j.Equipo === scope);
    const u = ultimaMarca(pool);
    if (!u) return;
    const { jugador: p, marca: ultima } = u;
    const plan = planCorreccion(ultima, delta === 'anular' ? -ultima.CarambolasEnMarca : delta);
    if (!plan) return;
    const nuevaId = nuevoGuid();
    const nueva = plan.nueva
      ? { Id: nuevaId, ParticipanteId: p.Id, MarcaTiempo: new Date().toISOString(), CarambolasEnMarca: plan.nueva, Anulada: false, CorrigeA: ultima.Id }
      : null;
    setJugadores((l) => l.map((j) => (j.Id === p.Id
      ? { ...j, marcas: [...j.marcas.map((m) => (m.Id === ultima.Id ? { ...m, Anulada: true } : m)), ...(nueva ? [nueva] : [])] }
      : j)));
    encolar(async () => {
      const jug = modo !== 'par' && p.jugador ? jugCache.current.get(p.jugador.Id) ?? p.jugador : null;
      const r = await corregirUltima({ ...p, jugador: jug }, ultima, plan, nuevaId);
      if (r.jugador) jugCache.current.set(r.jugador.Id, r.jugador);
      setReto(await cargarReto());                     // el récord pudo bajar al corregir
    }, () => { avisar('No se pudo guardar la corrección; se recarga la partida.'); cargar(); });
  }

  // ---------- finalizar (solo administrador, con PIN) ----------
  async function finalizar() {
    if (ocupado || !sesion) return;
    const ok = admin.activo || (await admin.pedir('Cerrar la partida es una acción de administrador.'));
    if (!ok) return;
    setOcupado(true);
    try {
      await cola.current;                              // que todas las series estén guardadas antes de cerrar
      const lista = jugRef.current.map((j) => ({ ...j, puntaje: statsLado({ miembros: [j] }).puntaje }));
      const durSeg = Math.max(0, Math.floor((Date.now() - new Date(sesion.HoraInicio).getTime()) / 1000));
      const d = await finalizarChico(sesion, lista, modo, async (g) => {
        const [consumo, retoFinal, tiempoReal] = await Promise.all([leerConsumoMesa(mesa.Id, { conPrecios: true }), cargarReto(), tiempoDeMesa(mesa.Id)]);
        setReto(retoFinal);
        return construirInforme({ mesa, cuenta, modo, jugadores: lista, durSeg, ganador: g, reto: retoFinal, retoInicial, consumo, tiempoReal });
      });
      setCarrito(false); setComp(null); setCorr(null);
      setInforme(d);
    } catch (e) { avisar(`No se pudo cerrar la partida: ${e}`); }
    finally { setOcupado(false); }
  }

  // ---------- render ----------
  if (cargando) return <Escenario><div className="ca-centro"><div className="ca-vacio-d">Cargando partida…</div></div></Escenario>;
  if (fallo) {
    return (
      <Escenario>
        <Barra onPanel={salir} />
        <div className="ca-centro"><div className="ca-vacio">
          <div className="ca-vacio-d">{fallo.texto}</div>
          <button type="button" className="ca-btn-sec" onClick={fallo.accion}>{fallo.etiqueta ?? '◂ VOLVER'}</button>
        </div></div>
      </Escenario>
    );
  }

  const lados = ladosDe(modo, jugadores);
  const stats = lados.map(statsLado);
  const gana = ladoGanando(stats[0] ?? { puntaje: 0 }, stats[1] ?? { puntaje: 0 });
  const chip = { nombre: reto ? reto.nombre : 'sin récord', serie: reto ? reto.serie : 0, rompiendo };
  const activoDe = (lado) => lado.miembros[0]?.Id;   // parejas: se cuenta para la pareja; las series se guardan en el primer integrante

  // Cuadrícula de 10 casillas: bolas 1–9 + "+" (o el teclado 1–9,0 cuando se arma una serie de 2 cifras).
  const casillas = ({ clave, destinoId, etiquetaBase, plano }) => {
    if (comp?.clave === clave) {
      return (
        <>
          <div className="ca-teclas">
            {DIGITOS.map((d) => (plano
              ? <button key={d} type="button" className="ca-tecla" aria-label={`Dígito ${d}`} onClick={() => digito(clave, destinoId, d)}>{d}</button>
              : <Bola key={d} n={d} etiqueta={`Dígito ${d}`} onClick={() => digito(clave, destinoId, d)} />))}
          </div>
          <div className="ca-comp"><span>SERIE DE 2 CIFRAS: <b>{comp.dig}_</b></span><button type="button" onClick={() => setComp(null)}>CANCELAR</button></div>
        </>
      );
    }
    return (
      <div className={plano ? 'ca-teclas plano' : 'ca-teclas'}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (plano
          ? <button key={n} type="button" className="ca-tecla" aria-label={`${etiquetaBase}: anotar ${n}`} onClick={() => sumarSerie(destinoId, n)}>{n}</button>
          : <Bola key={n} n={n} etiqueta={`${etiquetaBase}: anotar ${n} carambola${n > 1 ? 's' : ''}`} onClick={() => sumarSerie(destinoId, n)} />))}
        {plano
          ? <button type="button" className="ca-tecla mas" aria-label={`${etiquetaBase}: más de nueve, armar 10, 20, 30`} onClick={() => setComp({ clave, dig: '' })}>+ <small>10+</small></button>
          : <BolaMas etiqueta={`${etiquetaBase}: más de nueve, armar 10, 20, 30`} onClick={() => setComp({ clave, dig: '' })} />}
      </div>
    );
  };

  const prom = (s) => s.promedio.toFixed(2);
  const contenido = modo === 'ind' ? (() => {
    const totalEntradas = stats.reduce((s, x) => s + x.entradas, 0);
    let mejor = 0, quienMejor = '—';
    lados.forEach((l, i) => { if (stats[i].mejor > mejor) { mejor = stats[i].mejor; quienMejor = etiquetaJugador(l.miembros[0]); } });
    const lider = gana === null ? (stats[0].puntaje > 0 ? 'Empate' : '—') : etiquetaJugador(lados[gana].miembros[0]);
    const u = ultimaMarca(jugadores);
    return (
      <main className="ca-main ca-ind">
        {[0, 1].map((i) => {
          const j = lados[i].miembros[0], s = stats[i], nom = etiquetaJugador(j).toUpperCase();
          const tienePanelCentro = i === 1;
          return (
            <FragmentoPanel key={j.Id} centro={tienePanelCentro ? (
              <section className="ca-centro-col" aria-label="Datos de la mesa">
                <div className="ca-datos">
                  <div className="ca-dato"><div className="ca-dato-et">ENTRADAS</div><div className="ca-dato-v">{totalEntradas}</div></div>
                  <div className="ca-dato"><div className="ca-dato-et">TACADA MÁS ALTA</div><div className="ca-dato-v oro">{mejor || '—'}</div><div className="ca-dato-s">{mejor ? quienMejor : ''}</div></div>
                  <div className="ca-dato lider"><div className="ca-dato-et">LÍDER</div><div className="ca-dato-l">{lider}</div></div>
                </div>
                <button type="button" className="ca-btn-corregir grande" disabled={!u} aria-label={u ? `Corregir la última serie: ${etiquetaJugador(u.jugador)}, más ${u.marca.CarambolasEnMarca}` : 'Corregir la última serie'} onClick={() => setCorr({ scope: 'todos' })}>
                  <IcoDeshacer t={44} /><span className="ca-corr-t">CORREGIR ÚLTIMA</span><span className="ca-corr-s">{u ? `${etiquetaJugador(u.jugador)} · +${u.marca.CarambolasEnMarca}` : '—'}</span>
                </button>
              </section>
            ) : null}>
              <section className={`ca-panel ${gana === i ? 'gana' : ''}`} style={{ '--c': COLORES[i] }} aria-label={`Jugador ${i + 1}, ${nom}`}>
                <div className="ca-panel-cab"><span className="ca-num">{i + 1}</span><h2 className="ca-panel-nom">{nom}</h2>{gana === i && <IcoCopa t={34} />}</div>
                <div className={`ca-score ${gana === i ? 'oro' : ''}`}>{s.puntaje}</div>
                {casillas({ clave: j.Id, destinoId: j.Id, etiquetaBase: nom, plano: false })}
                <div className="ca-stats">
                  <div className="ca-stat"><div className="ca-stat-et">PROMEDIO</div><div className="ca-stat-v">{prom(s)}</div></div>
                  <div className="ca-stat"><div className="ca-stat-et">MEJOR</div><div className="ca-stat-v oro">{s.mejor}</div></div>
                </div>
              </section>
            </FragmentoPanel>
          );
        })}
      </main>
    );
  })() : (
    <main className="ca-main ca-par">
      {lados.map((lado, i) => {
        const s = stats[i], eq = lado.equipo, activa = activoDe(lado), va = gana === i;
        const u = ultimaMarca(lado.miembros);
        return (
          <section key={eq} className={`ca-panel par ${va ? 'gana' : ''}`} style={{ '--c': COLORES[i] }} aria-label={`Parchados ${eq}`}>
            <div className="ca-panel-cab"><span className="ca-num">{eq}</span><h2 className="ca-panel-nom par">PARCHADOS {eq}</h2>{va && <IcoCopa t={64} relleno brillo sw={1.6} />}</div>
            <div className={`ca-score ${va ? 'oro' : ''}`}>{s.puntaje}</div>
            <div className="ca-miembros">
              {lado.miembros.map((j) => <div key={j.Id} className="ca-miembro">{etiquetaJugador(j)}</div>)}
            </div>
            {casillas({ clave: `eq${eq}`, destinoId: activa, etiquetaBase: `Parchados ${eq}`, plano: true })}
            <div className="ca-stats">
              <div className="ca-stat"><div className="ca-stat-et">PROMEDIO</div><div className="ca-stat-v">{prom(s)}</div></div>
              <div className="ca-stat"><div className="ca-stat-et">MEJOR</div><div className="ca-stat-v">{s.mejor}</div></div>
            </div>
            <button type="button" className="ca-btn-corregir" disabled={!u} aria-label={u ? `Corregir la última de Parchados ${eq}: ${etiquetaJugador(u.jugador)} · +${u.marca.CarambolasEnMarca}` : `Corregir la última de Parchados ${eq}`} onClick={() => setCorr({ scope: eq })}>
              <IcoDeshacer />CORREGIR ÚLTIMA<span>{u ? `${etiquetaJugador(u.jugador)} · +${u.marca.CarambolasEnMarca}` : '—'}</span>
            </button>
          </section>
        );
      })}
    </main>
  );

  // Ventana de "Corregir última": −1, +1 o anular la serie (nunca se edita ni se borra: se anula y se registra otra).
  const uc = corr ? ultimaMarca(corr.scope === 'todos' ? jugadores : jugadores.filter((j) => j.Equipo === corr.scope)) : null;

  return (
    <Escenario>
      <Barra
        onPanel={salir}
        mesa={viva}
        chip={chip}
        carrito={modoTV ? null : { count: viva.consumo.length, onClick: () => setCarrito(true) }}
        onFinalizar={ocupado ? null : finalizar}
      />
      {contenido}
      <Carrito abierto={carrito} onCerrar={() => setCarrito(false)} mesa={viva} modoTV={modoTV} />
      {aviso && <div className="ca-aviso">{aviso}</div>}

      {corr && (
        <div className="ca-modal" onClick={(e) => e.target === e.currentTarget && setCorr(null)}>
          <div className="ca-card corregir">
            <h4>CORREGIR ÚLTIMA <button type="button" aria-label="Cerrar" onClick={() => setCorr(null)}>✕</button></h4>
            {uc ? (
              <>
                <div className="ca-corr-quien">{etiquetaJugador(uc.jugador)}</div>
                <div className="ca-corr-valor">+{uc.marca.CarambolasEnMarca}</div>
                <div className="ca-corr-btns">
                  <button type="button" onClick={() => corregir(corr.scope, -1)}>−1</button>
                  <button type="button" onClick={() => corregir(corr.scope, 1)}>+1</button>
                </div>
                <button type="button" className="ca-btn-sec peligro" onClick={() => corregir(corr.scope, 'anular')}>ANULAR ESTA SERIE</button>
              </>
            ) : <p className="ca-nota">No hay series para corregir.</p>}
            <button type="button" className="ca-btn-oro" onClick={() => setCorr(null)}>LISTO</button>
          </div>
        </div>
      )}

      {informe && (
        <div className="ct-marcador ct-host">
          <Informe d={informe} onPdf={() => window.print()} onInicio={irEntrada} onCobrar={() => irCuenta(cuenta.Id)} />
        </div>
      )}
      {admin.modal}
    </Escenario>
  );
}

/** Pone el panel y, si hay, la columna central justo detrás (1v1: jugador · datos · jugador). */
function FragmentoPanel({ children, centro }) {
  return <>{centro}{children}</>;
}
