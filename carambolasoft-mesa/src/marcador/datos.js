// ============================================================
//  CarambolaSoft — Mero Parche
//  marcador/datos.js — acceso a IndexedDB del Marcador (Offline-First).
//  Toda escritura pasa por put() del repositorio (GUID en cliente + cola de sync).
//  El Marcador solo AGREGA jugadores y REGISTRA carambolas. No crea pedidos, no cobra,
//  no toca stock ni caja y no abre cuentas: la barra abre la cuenta de la mesa.
//
//  [RIESGO] Las horas se estampan con el reloj de la tablet (decisión #12/#17: UTC del servidor).
//  Sirven para ordenar y mostrar; el servidor debe re-sellarlas al sincronizar.
//  [API] El servidor debe recibir a todos los ganadores de una partida en UN SOLO UPDATE
//  (ver TR_PARTICIPANTES_ActualizarRivalidades en el delta del Marcador).
// ============================================================
import { put, get, getAll, porIndice, nuevoGuid, leerMeta, escribirMeta } from '../db/repository.js';
import { ganadores, ranking, recordDeMarcas, retoDelParche } from './logica.js';

const ahora = () => new Date().toISOString();
const porHora = (a, b) => (a.MarcaTiempo < b.MarcaTiempo ? -1 : a.MarcaTiempo > b.MarcaTiempo ? 1 : 0);

/** Mesas de billar con cuenta BILLAR abierta: las únicas donde se puede jugar. */
export async function mesasConCuenta() {
  const [mesas, cuentas] = await Promise.all([getAll('MESAS_BILLAR'), porIndice('CUENTAS', 'porEstado', 'ABIERTA')]);
  return mesas
    .sort((a, b) => a.Numero - b.Numero)
    .map((mesa) => ({ mesa, cuenta: cuentas.find((c) => c.MesaId === mesa.Id) ?? null }));
}

// ---------- Clientes (catálogo; el Jugador sale de aquí) ----------
export async function listarClientes() {
  return (await getAll('CLIENTES')).sort((a, b) => (a.Nombre ?? '').localeCompare(b.Nombre ?? '', 'es'));
}

/** Crea o edita un cliente. Desactivar no borra (regla de la casa). */
export async function guardarCliente({ Id, Nombre, Apodo, Telefono, Activo = true }) {
  const previo = Id ? await get('CLIENTES', Id) : null;
  return put('CLIENTES', {
    Visitas: 0, GastoAcumulado: 0, FechaRegistro: ahora(),
    ...previo,
    Id: previo?.Id,
    Nombre: Nombre.trim(),
    Apodo: Apodo?.trim() || null,
    // El teléfono solo lo edita el administrador: si no viene, se conserva el que había.
    Telefono: Telefono === undefined ? (previo?.Telefono ?? null) : (Telefono?.trim() || null),
    Activo,
  });
}

/** Jugador de un cliente; se crea la primera vez que juega (sin login todavía). */
export async function asegurarJugador(cliente) {
  const existente = (await getAll('JUGADORES')).find((j) => j.ClienteId === cliente.Id);
  if (existente) return existente;
  const base = cliente.Nombre.normalize('NFD').replace(/[^\w]/g, '').toLowerCase().slice(0, 30) || 'jugador';
  return put('JUGADORES', {
    ClienteId: cliente.Id,
    Username: `${base}-${crypto.randomUUID().slice(0, 6)}`,
    PasswordHash: null,
    AvatarUrl: null,
    RecordCarambolas: 0,
    FechaRegistro: ahora(),
  });
}

// ---------- Reto del Parche ----------
export async function cargarReto() {
  const [jugadores, clientes] = await Promise.all([getAll('JUGADORES'), getAll('CLIENTES')]);
  const cli = new Map(clientes.map((c) => [c.Id, c]));
  return retoDelParche(
    jugadores.map((j) => {
      const c = cli.get(j.ClienteId);
      return { Id: j.Id, Nombre: c?.Apodo || c?.Nombre || j.Username, RecordCarambolas: j.RecordCarambolas };
    }),
  );
}

// ---------- Chico en juego ----------
async function enriquecer(participante) {
  let nombre = participante.NombreInvitado, apodo = null, jugador = null;
  if (participante.JugadorId) {
    jugador = await get('JUGADORES', participante.JugadorId);
    const c = jugador?.ClienteId ? await get('CLIENTES', jugador.ClienteId) : null;
    nombre = c?.Nombre ?? jugador?.Username ?? '—';
    apodo = c?.Apodo ?? null;
  }
  const marcas = (await porIndice('PARTICIPANTE_MARCAS_TIEMPO', 'porParticipante', participante.Id)).sort(porHora);
  return { ...participante, nombre, apodo, esInvitado: !participante.JugadorId, jugador, marcas };
}

/** Recupera el chico abierto de la mesa (sobrevive a recargar la página). null = aún no empieza. */
export async function cargarChico(cuenta, mesa) {
  const sesiones = await porIndice('SESIONES_MESAS', 'porCuenta', cuenta.Id);
  const sesion = sesiones.filter((s) => s.MesaId === mesa.Id && !s.HoraFin).sort((a, b) => (a.HoraInicio < b.HoraInicio ? 1 : -1))[0];
  if (!sesion) return null;
  const participantes = await porIndice('PARTICIPANTES', 'porSesion', sesion.Id);
  const lista = await Promise.all(participantes.map(enriquecer));
  // Orden de llegada = orden de la tarjeta. El Id es aleatorio, así que se usa la hora de la primera marca o la modificación.
  lista.sort((a, b) => (a.UltimaModificacion < b.UltimaModificacion ? -1 : 1));
  const modo = lista.some((p) => p.Equipo) ? 'par' : 'ind';
  return { sesion, participantes: lista, modo };
}

/**
 * Agrega un jugador al chico. def = { cliente } o { invitado: 'Pedro' }, equipo 1|2 solo en parejas.
 * Si el chico aún no empezó (sesion = null) solo valida; se crea todo al iniciar.
 */
export async function crearParticipante(sesion, def, equipo) {
  const jugador = def.cliente ? await asegurarJugador(def.cliente) : null;
  const p = await put('PARTICIPANTES', {
    SesionMesaId: sesion.Id,
    JugadorId: jugador?.Id ?? null,
    NombreInvitado: def.cliente ? null : def.invitado.trim(),
    Equipo: equipo ?? null,
    Puntaje: 0, Posicion: null, EsGanador: false,
  });
  return enriquecer(p);
}

/** "Iniciar chico": abre la sesión de la mesa bajo la cuenta que abrió la barra y crea a los participantes. */
export async function iniciarChico(cuenta, mesa, armados) {
  const sesion = await put('SESIONES_MESAS', {
    CuentaId: cuenta.Id, MesaId: mesa.Id, HoraInicio: ahora(), HoraFin: null, RivalidadesAplicadas: false,
  });
  const participantes = [];
  for (const a of armados) participantes.push(await crearParticipante(sesion, a.def, a.equipo));
  // Récord vigente al empezar: sirve para saber si ESTE chico lo rompió (aunque se recargue la página).
  await escribirMeta(`marcador.retoInicial.${sesion.Id}`, (await cargarReto())?.serie ?? 0);
  return { sesion, participantes, modo: armados.some((a) => a.equipo) ? 'par' : 'ind' };
}

/** Registra una serie (número de carambolas ≥ 1). Devuelve la marca y, si rompió su récord, el jugador actualizado. */
export async function registrarSerie(participante, valor, marcaId = nuevoGuid()) {
  // El Id lo pone la pantalla (actualización optimista): el registro local y el de pantalla son el mismo.
  const marca = await put('PARTICIPANTE_MARCAS_TIEMPO', {
    Id: marcaId, ParticipanteId: participante.Id, MarcaTiempo: ahora(), CarambolasEnMarca: valor, Anulada: false, CorrigeA: null,
  });
  let jugador = null;
  // Invitados no tienen récord. Solo una serie MAYOR lo rompe (comparación O(1), sin releer todas las marcas).
  if (participante.jugador && valor > participante.jugador.RecordCarambolas) {
    jugador = await put('JUGADORES', { ...participante.jugador, RecordCarambolas: valor });
  }
  return { marca, jugador };
}

/** "Corregir última": anula la serie y, si el valor corregido es ≥ 1, registra otra. Recalcula el récord del jugador. */
export async function corregirUltima(participante, ultima, plan, nuevaId = nuevoGuid()) {
  const anulada = await put('PARTICIPANTE_MARCAS_TIEMPO', { ...ultima, Anulada: true });
  const nueva = plan.nueva
    ? await put('PARTICIPANTE_MARCAS_TIEMPO', {
        Id: nuevaId, ParticipanteId: participante.Id, MarcaTiempo: ahora(), CarambolasEnMarca: plan.nueva, Anulada: false, CorrigeA: ultima.Id,
      })
    : null;

  let jugador = null;
  if (participante.jugador) {
    // El récord sale de TODAS las marcas vigentes del jugador, no de lo que quedó en pantalla.
    const propios = (await getAll('PARTICIPANTES')).filter((p) => p.JugadorId === participante.JugadorId);
    const marcas = (await Promise.all(propios.map((p) => porIndice('PARTICIPANTE_MARCAS_TIEMPO', 'porParticipante', p.Id)))).flat();
    const record = recordDeMarcas(marcas);
    if (record !== participante.jugador.RecordCarambolas) {
      jugador = await put('JUGADORES', { ...participante.jugador, RecordCarambolas: record });
    }
  }
  return { anulada, nueva, jugador };
}

/**
 * Cierra el chico: guarda puntaje, posición y ganadores; luego marca el fin de la sesión.
 * Un empate no marca ganador. NO cobra: el cobro de la cuenta se hace en la barra.
 */
export async function finalizarChico(sesion, participantes, modo) {
  const conPuntaje = participantes.map((p) => ({ Id: p.Id, Equipo: p.Equipo, puntaje: p.puntaje }));
  const g = ganadores(modo, conPuntaje);
  const orden = ranking(conPuntaje);
  for (const p of participantes) {
    const { Id, SesionMesaId, JugadorId, NombreInvitado, Equipo } = p;
    await put('PARTICIPANTES', {
      ...(await get('PARTICIPANTES', Id)),
      Id, SesionMesaId, JugadorId, NombreInvitado, Equipo,
      Puntaje: p.puntaje,
      Posicion: Math.min(4, orden.findIndex((o) => o.Id === Id) + 1),
      EsGanador: g.ids.includes(Id),
    });
  }
  await put('SESIONES_MESAS', { ...(await get('SESIONES_MESAS', sesion.Id)), HoraFin: ahora() });
  return g;
}

// ---------- Consumo de la cuenta (solo lectura) ----------
/**
 * Pedidos de la cuenta agrupados por producto. Los PRECIOS solo se cargan con { conPrecios: true }
 * (informe del administrador); la pantalla de mesa nunca los recibe.
 */
export async function leerConsumo(cuentaId, { conPrecios = false } = {}) {
  const [pedidos, productos] = await Promise.all([porIndice('PEDIDOS_CUENTAS', 'porCuenta', cuentaId), getAll('PRODUCTOS')]);
  const nombre = new Map(productos.map((p) => [p.Id, p.Nombre]));
  const grupos = new Map();
  for (const p of pedidos) {
    if (p.EstadoPedido === 'CANCELADO') continue;
    const g = grupos.get(p.ProductoId) ?? { productoId: p.ProductoId, nombre: nombre.get(p.ProductoId) ?? 'Producto', cantidad: 0, valor: 0 };
    g.cantidad += p.Cantidad;
    // Producto compartido: cada parte vale ValorParte (la suma ya es el total del grupo).
    if (conPrecios) g.valor += p.GrupoCompartidoId ? (p.ValorParte ?? 0) : p.PrecioUnitarioHist * p.Cantidad;
    grupos.set(p.ProductoId, g);
  }
  return [...grupos.values()].map((g) => (conPrecios ? g : { productoId: g.productoId, nombre: g.nombre, cantidad: g.cantidad }));
}

/** Récord a tumbar que había cuando empezó el chico. */
export async function retoInicialDe(sesionId) {
  return (await leerMeta(`marcador.retoInicial.${sesionId}`)) ?? 0;
}
