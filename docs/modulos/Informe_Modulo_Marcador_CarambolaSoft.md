# Informe técnico — Módulo Marcador (Scoremaster Carambola)
**CarambolaSoft · Cliente: Mero Parche (antes El Parche de Jony) · Octubre 2026**
**Estado:** maqueta HTML aprobada (Inicio + Clientes + Marcador) · pendiente de integrar al sistema empresarial

---

## 1. ¿Dónde va en CarambolaSoft?

Ya teníamos el espacio, solo que quedó sin informe: es la **Pantalla 3 — Marcador electrónico**, prioridad #4 del plan A5.

| Capa | Ubicación |
|---|---|
| Frontend mesa | `carambolasoft-mesa/` (React + Tailwind) → `src/screens/Marcador/` |
| API | `MarcadorController` nuevo en .NET 10 (independiente de `CuentasController`) |
| Persistencia local | Stores nuevos en IndexedDB (`db/schema.js`) + cola `SYNC_QUEUE` |
| BD nube | Tablas `MARCADOR_*` nuevas en `ElParcheDeJony` (SQL Server, `Modern_Spanish_CI_AI`) |

Relación con el resto: **solo lee** de otros módulos. No escribe pedidos, stock ni caja.

---

## 2. Alcance (lo que acordamos)

**Sí hace**
- Conteo de carambolas por jugador (series con bolas 1–9, botón `+` para ≥10, corregir última).
- Modos Individual y Parejas (hasta 4 jugadores).
- Analítica: promedio, última, mejor serie, entradas, líder, serie más alta, récord de la casa (Reto del Parche).
- Informe de partida (ranking, análisis, PDF).
- **Ver** el consumo de la mesa (solo lectura).

**No hace**
- Crear, editar ni cancelar pedidos → se hacen en el módulo de Mesas/Cuentas.
- Cobrar, facturar ni tocar stock.
- Gestionar clientes (usa el catálogo existente de Jugador).

---

## 3. Modelo de datos propuesto (tablas independientes)

Todas con `Id` GUID generado en cliente, `EsSincronizado`, `UltimaModificacion` (decisión #10).

**MARCADOR_PARTIDAS**
`Id, SesionMesaId (FK nullable, solo para leer consumo), MesaId, Modo (INDIVIDUAL|PAREJAS), Estado (ARMANDO|EN_JUEGO|FINALIZADA), InicioUtc, FinUtc, CerradaPorUsuarioId`

**MARCADOR_JUGADORES**
`Id, PartidaId, JugadorId (FK nullable → JUGADORES), NombreInvitado (nullable), Equipo (A|B|NULL), Orden`
> `JugadorId` NULL = invitado: suma en la partida pero no cuenta para récord ni rivalidades (regla ya aplicada en la maqueta).

**MARCADOR_ENTRADAS** (append-only)
`Id, PartidaId, MarcadorJugadorId, Serie, Tipo (SERIE|CORRECCION), RegistradaUtc`
> Puntaje, promedio, mejor y entradas se **derivan** de aquí. Esto sirve a la analítica Pro (alineado con decisión #7).

**RECORDS_CASA**
`Id, JugadorId, Serie, PartidaId, FechaUtc, Vigente` — el Reto del Parche sale de la fila vigente (hoy "billarcito · 0").

**Vista:** `VW_MARCADOR_RESUMEN` (totales por jugador/partida) y `VW_MARCADOR_CONSUMO` (lectura del consumo vía `SesionMesaId`, sin tocar tablas de pedidos).

---

## 4. Reglas de negocio vigentes en la maqueta

1. Iniciar chico bloquea el cambio de modo.
2. Finalizar exige PIN de administrador.
3. Récord: solo jugadores registrados; se rompe con serie estrictamente mayor.
4. Corregir última afecta puntaje y mejor serie.
5. Informe: ganador, total, entradas, serie alta, mejor promedio, diferencia 1° vs 2°.
6. Tiempo de mesa a $100/min (= $6.000/h), igual que el producto "Tiempo Mesa Billar".

---

## 5. Riesgos y mejoras

**[RIESGO] Dinero en pantalla pública.** La maqueta muestra el drawer de consumo y el informe con pesos. Regla vigente: *nada de dinero en pantallas públicas*. Propuesta: en la tablet/monitor de mesa el consumo se muestra **sin precios** (ítem y cantidad); el informe con valores solo bajo PIN admin.

**[RIESGO] PIN en el cliente.** `1234` está quemado en el JS. En producción debe validarse contra la API (hash), nunca en el navegador.

**[RIESGO] Reloj del PC.** La maqueta usa `secs++` y `new Date()` locales. Por decisión #17 los timestamps de partida y entradas deben sellarse con **UTC del servidor**; el cronómetro en pantalla solo calcula `ahora − InicioUtc`.

**[RIESGO] Clientes duplicados.** La maqueta guarda clientes en `meroparche_clientes_v1`. En el sistema real debe leer la entidad Jugador (decisión #1). Plan de migración: exportar ese JSON → importar a JUGADORES con GUID existente.

**[RIESGO] Récord en memoria.** En la maqueta el récord se pierde al recargar. Debe persistirse en `RECORDS_CASA`.

**[MEJORA] Corrección auditable.** "Corregir última" hoy muta el valor. Pasarlo a una entrada tipo `CORRECCION` deja trazabilidad (anti-fraude suave).

**[MEJORA] Mesa dinámica.** "Mesa 04" está fija; debe venir de `MesaId`.

**[MEJORA] Rivalidades.** Cuando haya ganador con 2 registrados, alimentar `RIVALIDADES` desde el cierre de partida (trigger sobre `FINALIZADA`), manteniendo la decisión #8 sin acoplar tablas de Mesas.

**[MEJORA] Sin conexión.** Registrar cada entrada primero en IndexedDB y sincronizar por el motor A4 (mismo patrón `PUT /sync/...`). Meta táctil < 50 ms.

---

## 6. Pregunta abierta (decide la Dueña/Albeiro)

¿Una partida del Marcador **debe** colgar de una `SesionMesa` o puede existir suelta (mesa sin cuenta abierta)? Propuesta: `SesionMesaId` nullable; si existe, se ve el consumo; si no, el drawer muestra "Sin cuenta asociada".

---

## 7. Siguientes pasos (micro-pasos, mockup primero)

1. **Aprobar este informe** (modelo + reglas + decisión sobre dinero en pantalla).
2. Ajustar la maqueta: consumo sin precios en vista de mesa.
3. Script BD v6.2: tablas `MARCADOR_*` + `RECORDS_CASA` + vistas.
4. Re-scaffold EF Core (junto con el pendiente de las 17 entidades v6).
5. `MarcadorController` + endpoints sync.
6. Pantalla 3 en React conectada a IndexedDB.
7. Migración de clientes del localStorage → JUGADORES.
8. Registrar como decisión #18: *el Marcador es módulo independiente y de solo lectura sobre consumo.*
