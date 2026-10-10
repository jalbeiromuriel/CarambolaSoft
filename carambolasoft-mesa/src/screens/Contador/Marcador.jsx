// ============================================================
//  Marcador (ScoreMaster · Carambola) — réplica de MeroParche_Marcador.html conectada a IndexedDB.
//  Solo AGREGA jugadores y REGISTRA carambolas. No cobra, no hace pedidos, no toca stock ni caja.
//  Cada serie se guarda al instante: la pantalla se actualiza primero (optimista) y la cola de
//  escritura las persiste EN ORDEN, para que el récord del jugador nunca quede con un valor viejo.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { nuevoGuid } from '../../db/repository.js';
import {
  MAX_JUGADORES, estadisticas, vigentes, puedeAgregar, componerSerie, planCorreccion, rompeRecord, hms,
} from '../../marcador/logica.js';
import {
  mesasConCuenta, listarClientes, cargarReto, cargarChico, crearParticipante, iniciarChico,
  registrarSerie, corregirUltima, finalizarChico, leerConsumoMesa, tiempoDeMesa, retoInicialDe,
} from '../../marcador/datos.js';
import Informe, { construirInforme } from './Informe.jsx';

const ACENTOS = ['var(--cian)', 'var(--magenta)', 'var(--verde)', 'var(--amarillo)'];
const POOL = ['#e0b400', '#1e40af', '#c62828', '#6d28d9', '#e35b14', '#1f7a3f', '#7f1d1d', '#111318', '#e0b400'];
const letra = (eq) => (eq === 1 ? 'A' : 'B');

export default function Marcador({ mesaId, admin, irInicio, irCuenta }) {
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState('');
  const [mesa, setMesa] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [sesion, setSesion] = useState(null);            // null = el chico aún no empieza
  const [modo, setModo] = useState('ind');
  const [jugadores, setJugadores] = useState([]);
  const [activo, setActivo] = useState(null);
  const [reto, setReto] = useState(null);
  const [retoInicial, setRetoInicial] = useState(0);
  const [clientes, setClientes] = useState([]);
  const [ahora, setAhora] = useState(Date.now());
  const [dosDigitos, setDosDigitos] = useState(false);
  const [compuesto, setCompuesto] = useState('');
  const [modalAdd, setModalAdd] = useState(null);        // null | { equipo: 1|2|null }
  const [busqueda, setBusqueda] = useState('');
  const [invitado, setInvitado] = useState('');
  const [cajon, setCajon] = useState(false);
  const [consumo, setConsumo] = useState([]);
  const [informe, setInforme] = useState(null);
  const [rompiendo, setRompiendo] = useState(false);
  const [pop, setPop] = useState({ id: null, n: 0 });
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Cola de escritura (orden estricto) y cachés para no depender de estado de React al persistir.
  const cola = useRef(Promise.resolve());
  const jugCache = useRef(new Map());                    // JugadorId -> jugador persistido más reciente
  const retoRef = useRef(null);
  const jugRef = useRef([]);
  retoRef.current = reto;
  jugRef.current = jugadores;

  const avisar = useCallback((t) => { setAviso(t); setTimeout(() => setAviso(''), 3500); }, []);
  const encolar = useCallback((fn, alFallar) => {
    cola.current = cola.current.then(fn).catch((e) => { console.error('[marcador]', e); alFallar?.(e); });
    return cola.current;
  }, []);

  // ---------- carga ----------
  const cargar = useCallback(async () => {
    try {
      const filas = await mesasConCuenta();
      const fila = filas.find((f) => f.mesa.Id === mesaId);
      if (!fila?.cuenta) { setFallo('Esta mesa ya no tiene una cuenta abierta. La abre la barra.'); return; }
      setMesa(fila.mesa); setCuenta(fila.cuenta);
      const [r, chico, cli] = await Promise.all([cargarReto(), cargarChico(fila.cuenta, fila.mesa), listarClientes()]);
      setReto(r); setClientes(cli.filter((c) => c.Activo !== false));
      if (chico) {
        setSesion(chico.sesion); setModo(chico.modo); setJugadores(chico.participantes);
        setActivo(chico.participantes[0]?.Id ?? null);
        setRetoInicial(await retoInicialDe(chico.sesion.Id));
        chico.participantes.forEach((p) => p.jugador && jugCache.current.set(p.jugador.Id, p.jugador));
      } else setRetoInicial(r?.serie ?? 0);
    } catch (e) { setFallo(`No se pudo cargar el marcador: ${e}`); }
    finally { setCargando(false); }
  }, [mesaId]);
  useEffect(() => { cargar(); }, [cargar]);

  // Cronómetro: corre desde HoraInicio del chico (sobrevive a recargas).
  useEffect(() => {
    if (!sesion || informe) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sesion, informe]);

  // Consumo (solo lectura, SIN precios) mientras el cajón está abierto.
  useEffect(() => {
    if (!cajon || !cuenta) return undefined;
    let vivo = true;
    const leer = () => leerConsumoMesa(mesa.Id).then((c) => vivo && setConsumo(c));
    leer();
    const t = setInterval(() => { setAhora(Date.now()); leer(); }, 5000);
    return () => { vivo = false; clearInterval(t); };
  }, [cajon, cuenta]);

  const iniciado = Boolean(sesion);
  const segs = sesion ? Math.max(0, Math.floor((ahora - new Date(sesion.HoraInicio).getTime()) / 1000)) : 0;
  const act = jugadores.find((j) => j.Id === activo) ?? null;
  const stats = (j) => estadisticas(j.marcas);
  const colorDe = (j) => (modo === 'par' ? (j.Equipo === 1 ? 'var(--cian)' : 'var(--magenta)') : ACENTOS[jugadores.indexOf(j) % 4]);

  // ---------- jugadores ----------
  async function agregar(def) {
    const equipo = modalAdd?.equipo ?? null;
    if (!puedeAgregar(jugadores)) return avisar(`Máximo ${MAX_JUGADORES} jugadores por mesa.`);
    if (equipo && jugadores.filter((j) => j.Equipo === equipo).length >= 2) return avisar('Cada pareja lleva máximo 2 jugadores.');
    setModalAdd(null);
    try {
      let nuevo;
      if (sesion) {
        nuevo = await crearParticipante(sesion, def, equipo ?? undefined);       // chico en curso: se guarda ya
      } else {
        nuevo = {
          Id: nuevoGuid(), nombre: def.cliente ? def.cliente.Nombre : def.invitado.trim(), apodo: def.cliente?.Apodo ?? null,
          esInvitado: !def.cliente, Equipo: equipo, marcas: [], jugador: null, def,
        };
      }
      setJugadores((l) => [...l, nuevo]);
      if (!activo) setActivo(nuevo.Id);
    } catch (e) { avisar(`No se pudo agregar: ${e}`); }
  }

  function quitar(id) {
    if (iniciado) return;                                // ✕ solo antes de empezar: ya hay registros que no se borran
    setJugadores((l) => l.filter((j) => j.Id !== id));
    if (activo === id) setActivo(jugadores.find((j) => j.Id !== id)?.Id ?? null);
  }

  function cambiarModo(m) {
    if (iniciado || m === modo) return;
    setModo(m); setJugadores([]); setActivo(null); setDosDigitos(false); setCompuesto('');
  }

  async function iniciar() {
    if (ocupado || jugadores.length < 1) return;
    if (modo === 'par' && (!jugadores.some((j) => j.Equipo === 1) || !jugadores.some((j) => j.Equipo === 2))) {
      return avisar('En parejas hace falta al menos un jugador en cada pareja.');
    }
    setOcupado(true);
    try {
      const r = await iniciarChico(cuenta, mesa, jugadores.map((j) => ({ def: j.def, equipo: modo === 'par' ? j.Equipo : undefined })));
      r.participantes.forEach((p) => p.jugador && jugCache.current.set(p.jugador.Id, p.jugador));
      setSesion(r.sesion); setJugadores(r.participantes); setActivo(r.participantes[0]?.Id ?? null);
      setRetoInicial(reto?.serie ?? 0); setAhora(Date.now());
    } catch (e) { avisar(`No se pudo iniciar el chico: ${e}`); }
    finally { setOcupado(false); }
  }

  // ---------- series ----------
  function sumarSerie(k) {
    const p = jugRef.current.find((j) => j.Id === activo);
    if (!iniciado || !p || !(k >= 1)) return;
    const marcaId = nuevoGuid();
    const marca = { Id: marcaId, ParticipanteId: p.Id, MarcaTiempo: new Date().toISOString(), CarambolasEnMarca: k, Anulada: false, CorrigeA: null };
    setJugadores((l) => l.map((j) => (j.Id === p.Id ? { ...j, marcas: [...j.marcas, marca] } : j)));
    setPop((x) => ({ id: p.Id, n: x.n + 1 }));
    navigator.vibrate?.(12);

    // ¿Rompe el Reto del Parche? Solo cuenta un jugador registrado y solo si es ESTRICTAMENTE mayor.
    if (!p.esInvitado && rompeRecord(k, retoRef.current?.serie ?? 0)) {
      const nuevoReto = { jugadorId: p.jugador?.Id ?? p.JugadorId, nombre: p.apodo || p.nombre, serie: k };
      retoRef.current = nuevoReto; setReto(nuevoReto);
      setRompiendo(true); setTimeout(() => setRompiendo(false), 3500);
    }

    encolar(async () => {
      const jug = p.jugador ? jugCache.current.get(p.jugador.Id) ?? p.jugador : null;
      const r = await registrarSerie({ ...p, jugador: jug }, k, marcaId);
      if (r.jugador) jugCache.current.set(r.jugador.Id, r.jugador);
    }, () => {
      avisar('No se pudo guardar la última serie. Revisa y vuelve a contarla.');
      setJugadores((l) => l.map((j) => (j.Id === p.Id ? { ...j, marcas: j.marcas.filter((m) => m.Id !== marcaId) } : j)));
    });
  }

  function digito(k) {
    if (!iniciado) return;
    if (!dosDigitos) return sumarSerie(k);
    const c = compuesto + String(k);
    if (c.length < 2) return setCompuesto(c);
    setDosDigitos(false); setCompuesto('');
    const v = componerSerie(c);
    if (v) sumarSerie(v);                                // "00" no existe: no se registra el cero
  }
  const alternarDos = () => { if (!iniciado) return; setDosDigitos((x) => !x); setCompuesto(''); };

  function corregir(delta) {
    const p = jugRef.current.find((j) => j.Id === activo);
    if (!p) return;
    const v = vigentes(p.marcas);
    const ultima = v[v.length - 1];
    const plan = planCorreccion(ultima, delta);
    if (!plan) return;
    const nuevaId = nuevoGuid();
    const nueva = plan.nueva
      ? { Id: nuevaId, ParticipanteId: p.Id, MarcaTiempo: new Date().toISOString(), CarambolasEnMarca: plan.nueva, Anulada: false, CorrigeA: ultima.Id }
      : null;
    setJugadores((l) => l.map((j) => (j.Id === p.Id
      ? { ...j, marcas: [...j.marcas.map((m) => (m.Id === ultima.Id ? { ...m, Anulada: true } : m)), ...(nueva ? [nueva] : [])] }
      : j)));
    encolar(async () => {
      const jug = p.jugador ? jugCache.current.get(p.jugador.Id) ?? p.jugador : null;
      const r = await corregirUltima({ ...p, jugador: jug }, ultima, plan, nuevaId);
      if (r.jugador) jugCache.current.set(r.jugador.Id, r.jugador);
      setReto(await cargarReto());                      // el récord pudo bajar al corregir
    }, () => { avisar('No se pudo guardar la corrección; se recarga el marcador.'); cargar(); });
  }

  // ---------- finalizar ----------
  async function finalizar() {
    if (!iniciado || ocupado) return;
    const ok = admin.activo || (await admin.pedir('Cerrar el chico es una acción de administrador.'));
    if (!ok) return;
    setOcupado(true);
    try {
      await cola.current;                               // que todas las series estén guardadas antes de cerrar
      const lista = jugRef.current.map((j) => ({ ...j, puntaje: stats(j).puntaje }));
      const d = await finalizarChico(sesion, lista, modo, async (g) => {
        const [consumoConPrecios, retoFinal, tiempoReal] = await Promise.all([leerConsumoMesa(mesa.Id, { conPrecios: true }), cargarReto(), tiempoDeMesa(mesa.Id)]);
        setReto(retoFinal);
        return construirInforme({ mesa, cuenta, modo, jugadores: lista, durSeg: segs, ganador: g, reto: retoFinal, retoInicial, consumo: consumoConPrecios, tiempoReal });
      });
      setCajon(false); setDosDigitos(false); setCompuesto('');
      setInforme(d);
    } catch (e) { avisar(`No se pudo cerrar el chico: ${e}`); }
    finally { setOcupado(false); }
  }

  // ---------- render ----------
  if (cargando) return <div className="ct-marcador"><div className="ct-empty" style={{ margin: 40 }}>Cargando marcador…</div></div>;
  if (fallo) {
    return (
      <div className="ct-marcador">
        <div className="ct-empty" style={{ margin: 40 }}>{fallo}<br /><br /><button className="ct-chip" onClick={irInicio}>◂ VOLVER AL INICIO</button></div>
      </div>
    );
  }

  const [hh, mm, ss] = hms(segs).split(':');
  const ultimaDelActivo = act ? vigentes(act.marcas).slice(-1)[0] : null;
  const totalEntradas = jugadores.reduce((s, j) => s + stats(j).entradas, 0);
  let hr = 0, hrN = '—';
  jugadores.forEach((j) => { const m = stats(j).mejor; if (m > hr) { hr = m; hrN = j.nombre; } });
  const punt = (eq) => jugadores.filter((j) => j.Equipo === eq).reduce((s, j) => s + stats(j).puntaje, 0);
  let lider = '—';
  if (modo === 'ind') {
    const ld = Math.max(0, ...jugadores.map((j) => stats(j).puntaje));
    const tops = jugadores.filter((j) => stats(j).puntaje === ld && ld > 0);
    lider = ld === 0 ? '—' : tops.length > 1 ? 'Empate' : tops[0].nombre;
  } else {
    const a = punt(1), b = punt(2);
    lider = a === 0 && b === 0 ? '—' : a === b ? 'Empate' : a > b ? 'Pareja A' : 'Pareja B';
  }
  const faltaPareja = modo === 'par' && (!jugadores.some((j) => j.Equipo === 1) || !jugadores.some((j) => j.Equipo === 2));
  const yaAgregados = new Set(jugadores.map((j) => j.def?.cliente?.Id ?? j.jugador?.ClienteId).filter(Boolean));
  const t = busqueda.trim().toLowerCase();
  const listaClientes = clientes.filter((c) => !yaAgregados.has(c.Id) && (!t || `${c.Nombre} ${c.Apodo ?? ''}`.toLowerCase().includes(t)));

  const tarjeta = (j, idx) => {
    const s = stats(j);
    const clases = ['ct-pcard', j.Id === activo ? 'active' : 'dim'];
    if (!j.esInvitado && s.mejor > 0 && reto && s.mejor >= reto.serie) clases.push('holder');
    if (pop.id === j.Id) clases.push('pop');
    return (
      <div key={j.Id} className={clases.join(' ')} style={{ '--c': colorDe(j) }} onClick={() => setActivo(j.Id)}>
        <span className="ct-accent" /><span className="ct-champ">🏆</span>
        <div className="ct-head">
          <span className="ct-badge">{idx}</span><span className="ct-pname">{j.nombre}</span>
          {!iniciado && <button className="ct-rm" onClick={(e) => { e.stopPropagation(); quitar(j.Id); }}>✕</button>}
        </div>
        <div className="ct-active-lbl">● EN TURNO</div>
        <div className="ct-score" key={pop.id === j.Id ? pop.n : 0}>{s.puntaje}</div>
        <div className="ct-stats">
          <div className="ct-st"><div className="ct-lb">Prom.</div><div className="ct-vl">{s.promedio.toFixed(2)}</div></div>
          <div className="ct-st"><div className="ct-lb">Última</div><div className="ct-vl">{s.ultima}</div></div>
          <div className="ct-st mejor"><div className="ct-lb">Mejor</div><div className="ct-vl">{s.mejor}</div></div>
          <div className="ct-st"><div className="ct-lb">Ent.</div><div className="ct-vl">{s.entradas}</div></div>
        </div>
      </div>
    );
  };

  const hint = iniciado
    ? 'TOCA LA BOLA = SERIE DEL JUGADOR EN TURNO · + PARA 10 O MÁS · TOCA OTRA CARD PARA CAMBIAR DE JUGADOR'
    : jugadores.length ? (faltaPareja ? 'EN PAREJAS HACE FALTA AL MENOS UN JUGADOR EN CADA PAREJA' : 'ARMA LOS JUGADORES Y TOCA INICIAR') : 'AGREGA JUGADORES CON "+ JUGADOR" PARA EMPEZAR';
  const lleno = !puedeAgregar(jugadores);

  return (
    <div className="ct-marcador">
      <header>
        <div className="ct-brand"><span className="ct-balls"><b></b><b></b><b></b></span><h1>MERO PARCHE<small>SCOREMASTER · CARAMBOLA</small></h1></div>
        <div className="ct-clockwrap">
          <span className="ct-date">MESA {String(mesa.Numero).padStart(2, '0')} · {cuenta.NombreLibre}</span>
          <span className={`ct-clock ${iniciado ? '' : 'paused'}`}>{hh}<span className="ct-sep">:</span>{mm}<span className="ct-sep">:</span>{ss}</span>
        </div>
        <div className={`ct-reto ${rompiendo ? 'beaten' : ''}`}>
          <span className="ct-cup">🏆</span>
          <div><div className="ct-rlab">A VENCER · TACADA</div><div><span className="ct-rname">{reto ? reto.nombre : 'sin récord'}</span> · <span className="ct-rnum">{reto ? reto.serie : 0}</span></div></div>
        </div>
      </header>

      <div className="ct-controls">
        <div className="ct-seg">
          <button className={modo === 'ind' ? 'on' : ''} disabled={iniciado && modo !== 'ind'} onClick={() => cambiarModo('ind')}>INDIVIDUAL</button>
          <button className={modo === 'par' ? 'on' : ''} disabled={iniciado && modo !== 'par'} onClick={() => cambiarModo('par')}>PAREJAS</button>
        </div>
        <div className="ct-addbtns">
          {modo === 'ind'
            ? <button className="ct-add" disabled={lleno} onClick={() => { setBusqueda(''); setInvitado(''); setModalAdd({ equipo: null }); }}>+ Jugador</button>
            : (<>
              <button className="ct-add a" disabled={lleno} onClick={() => { setBusqueda(''); setInvitado(''); setModalAdd({ equipo: 1 }); }}>+ Pareja A</button>
              <button className="ct-add b" disabled={lleno} onClick={() => { setBusqueda(''); setInvitado(''); setModalAdd({ equipo: 2 }); }}>+ Pareja B</button>
            </>)}
        </div>
        <div className="ct-spacer" />
        {iniciado
          ? <button className="ct-mainbtn finalizar" disabled={ocupado} onClick={finalizar}>FINALIZAR <span className="ct-adm">🔒 ADM</span></button>
          : <button className="ct-mainbtn iniciar" disabled={ocupado || jugadores.length < 1 || faltaPareja} onClick={iniciar}>▶ INICIAR CHICO</button>}
        <button className="ct-chip" onClick={() => setCajon(true)}>👁 CONSUMO</button>
        <button className="ct-chip" onClick={irInicio}>◂ SALIR</button>
      </div>

      <div className={`ct-board ${modo === 'ind' ? 'ind' : 'par'}`}>
        {jugadores.length === 0 && <div className="ct-empty">Agrega jugadores con “+ Jugador” para armar el chico.</div>}
        {jugadores.length > 0 && modo === 'ind' && jugadores.map((j, i) => tarjeta(j, i + 1))}
        {jugadores.length > 0 && modo === 'par' && [1, 2].map((eq) => {
          const mem = jugadores.filter((j) => j.Equipo === eq);
          const tot = punt(eq), otro = punt(eq === 1 ? 2 : 1);
          return (
            <div key={eq} className={`ct-team ${tot > 0 && tot >= otro ? 'leader' : ''}`} style={{ '--c': eq === 1 ? 'var(--cian)' : 'var(--magenta)' }}>
              <div className="ct-thead"><span className="ct-tname">PAREJA {letra(eq)}</span><span className="ct-ttot">{tot}</span></div>
              <div className="ct-members">{mem.map((j, i) => tarjeta(j, i + 1))}</div>
            </div>
          );
        })}
      </div>

      <div className="ct-summary">
        <span><span className="ct-k">ENTRADAS:</span> <span className="ct-v">{totalEntradas}</span></span>
        <span><span className="ct-k">TACADA MÁS ALTA:</span> <span className="ct-v hl">{hr > 0 ? `${hrN} (${hr})` : '—'}</span></span>
        <span><span className="ct-k">LÍDER:</span> <span className="ct-v">{lider}</span></span>
      </div>

      <div className="ct-counter">
        <div className="ct-who"><span className="ct-l">EN TURNO</span><span className="ct-p"><span className="ct-dotc" style={act ? { background: colorDe(act), color: colorDe(act) } : { background: 'var(--muted)', color: 'var(--muted)' }} /><span>{act ? act.nombre : '—'}</span></span></div>
        <div className={`ct-series ${iniciado ? '' : 'locked'}`}>
          {POOL.map((c, i) => (
            <button key={i} className="ct-nball" style={{ background: `radial-gradient(circle at 50% 50%,${c},color-mix(in srgb,${c} 55%,#000))` }} onClick={() => digito(i + 1)}><span className="ct-d">{i + 1}</span></button>
          ))}
          <button className={`ct-plusball ${dosDigitos ? 'on' : ''}`} onClick={alternarDos}>{dosDigitos ? `${compuesto}_` : '+'}</button>
          {dosDigitos && <button className="ct-nball zero" style={{ background: 'radial-gradient(circle at 34% 30%,#fff,#c9cdd6)', display: 'block' }} onClick={() => digito(0)}><span className="ct-d">0</span></button>}
        </div>
        <div className={`ct-lastfix ${iniciado && ultimaDelActivo ? 'on' : ''}`}>
          <span className="ct-l">CORREGIR ÚLTIMA</span>
          <button className="ct-mn" onClick={() => corregir(-1)}>−</button>
          <span className="ct-n">{ultimaDelActivo ? ultimaDelActivo.CarambolasEnMarca : 0}</span>
          <button onClick={() => corregir(1)}>+</button>
        </div>
        <div className="ct-hint">{hint}</div>
      </div>

      <footer><span>© 2026 MERO PARCHE</span><div className="ct-live"><i></i> {navigator.onLine ? 'GUARDANDO EN ESTA TABLET · SYNC AUTOMÁTICO' : 'SIN INTERNET · SE GUARDA EN LA TABLET'}</div></footer>

      {aviso && <div className="ct-toast">{aviso}</div>}
      <div className={`ct-backdrop ${cajon || modalAdd ? 'on' : ''}`} onClick={() => { setCajon(false); setModalAdd(null); }} />

      <div className={`ct-drawer ${cajon ? 'open' : ''}`}>
        <h3>CONSUMO DE LA MESA <span className="ct-x" onClick={() => setCajon(false)}>✕</span></h3>
        <div className="ct-items">
          {consumo.length === 0 && <div className="ct-item"><span className="ct-name" style={{ color: 'var(--muted)' }}>Aún sin pedidos</span></div>}
          {consumo.map((c) => <div key={c.productoId} className="ct-item"><span className="ct-name">{c.nombre}</span><span className="ct-q">x{c.cantidad}</span></div>)}
          <div className="ct-item time"><span className="ct-name">Tiempo de mesa</span><span className="ct-q">{hms((ahora - new Date(cuenta.HoraApertura).getTime()) / 1000)}</span></div>
        </div>
        <div className="ct-mnote" style={{ padding: '12px 18px' }}>Desde aquí solo se mira. Los valores los ve el administrador en el informe al finalizar.</div>
      </div>

      <div className={`ct-modal ${modalAdd ? 'on' : ''}`} onClick={(e) => e.target === e.currentTarget && setModalAdd(null)}>
        {modalAdd && (
          <div className="ct-mcard">
            <h4>AGREGAR JUGADOR {modalAdd.equipo && <span className="ct-mteam" style={{ display: 'inline-block', color: modalAdd.equipo === 1 ? 'var(--cian)' : 'var(--magenta)', borderColor: 'currentColor' }}>PAREJA {letra(modalAdd.equipo)}</span>}<span className="ct-mx" onClick={() => setModalAdd(null)}>✕</span></h4>
            <input placeholder="Buscar cliente…" autoComplete="off" autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <div className="ct-clist">
              {clientes.length === 0 && <div className="ct-mnote">No hay clientes registrados. Créalos en <b>CLIENTES</b> (desde el Inicio). Mientras tanto, agrega un <b>invitado</b> abajo.</div>}
              {clientes.length > 0 && listaClientes.length === 0 && <div className="ct-mnote">Sin coincidencias. Agrégalo como invitado abajo.</div>}
              {listaClientes.map((c) => (
                <div key={c.Id} className="ct-crow" onClick={() => agregar({ cliente: c })}>
                  <span className="ct-av" /><span className="ct-cn">{c.Nombre}{c.Apodo && <span style={{ color: '#98a2b4', fontSize: 12 }}> ({c.Apodo})</span>}</span><span className="ct-reg">● CLIENTE</span>
                </div>
              ))}
            </div>
            <div className="ct-msep">— O INVITADO —</div>
            <div className="ct-guestrow">
              <input placeholder="Nombre del invitado" autoComplete="off" value={invitado} onChange={(e) => setInvitado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invitado.trim() && agregar({ invitado })} />
              <button onClick={() => invitado.trim() && agregar({ invitado })}>Agregar</button>
            </div>
            <div className="ct-mnote">El jugador es un <b>cliente</b> de la base. Los <b>invitados</b> juegan y suman, pero no cuentan para el récord ni las rivalidades.</div>
          </div>
        )}
      </div>

      {informe && (
        <Informe d={informe} onPdf={() => window.print()} onInicio={irInicio} onCobrar={() => irCuenta(cuenta.Id)} />
      )}
      {admin.modal}
    </div>
  );
}
