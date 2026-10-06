# BACKLOG MAESTRO — CarambolaSoft (Mero Parche)
### Fuente: POS temporal en producción (v6.28 al 2026-10-05; `referencias/` aún trae v6.11) = especificación validada del negocio
### Actualizado: 2026-10-05 (línea base de BD y sección G) · Avance estimado: ~45% (sin recalcular)
### Esquema real de la BD: `database/ElParcheDeJony_DB_v6.sql` · Modelo: `docs/modelo/` (ERD y UML v6.2)

---

## A. EN CURSO — orden de ejecución confirmado

1. ~~**Smoke test CuentasController vía Scalar**~~ ✅ COMPLETADO (2026-07-18)
   Flujo validado en vivo: turno → cuenta 201 → pedido con precio server-side → trigger stock 24→22 → factura PAGADO.
2. ~~**Capa IndexedDB (Offline-First)**~~ ✅ COMPLETADO (2026-07-19)
   `db/schema.js` (19 stores espejo v6 + `SYNC_QUEUE`) y `db/repository.js` (`put()` atómico store+cola, GUID cliente, sella sync). Probado en consola y en UI.
3. ~~**Pantallas 1 y 2**~~ ✅ COMPLETADO (2026-07-21) — construidas ya conectadas al patrón `put()`:
   TableroMesas (cronómetro vivo, apertura BILLAR/LICORES) y DetalleCuenta (catálogo, pedidos, taxímetro, cobro con cambio/mixto/fiado espejo del POS). Refactor a `components/` + `screens/` hecho.
4. **Motor de sincronización** ← PRÓXIMO PASO
   - Subida: vaciar `SYNC_QUEUE` en orden contra el API (idempotente por GUID); marcar `EsSincronizado=true` al confirmar
   - Bajada: traer cambios del servidor por `UltimaModificacion` (productos, precios, promos)
   - Reintentos con red intermitente (Service Worker / online-offline events)
   - Indicador de estado de sync en UI (equivalente al "💾 guardado" del POS)
5. **Pantalla 3 — Marcador electrónico** (maqueta aprobada en `referencias/contador/`; ver sección H)
6. **Reescritura SesionesController + SesionRepository** (deuda técnica: handlers comentados; adaptar a v6 donde `TarifaPorHora` vive en CUENTAS)
7. **Migración go-live**: inventario, clientes y fiados desde backup JSON del POS → SQL Server

---

## B. BD v6.1 / v6.2 — delta de esquema pendiente

> **2026-10-05:** el delta v6.2 (que absorbe v6.1) está redactado en `database/propuestas/ElParcheDeJony_DB_v6_2_delta.sql`,
> validado contra el esquema real. **NO se ha ejecutado.** Probar primero en la BD de laboratorio, con backup.
> Trae: GARITAS_RELOJ, GRUPOS_COMPARTIDOS, COMPRAS_INVENTARIO (absorbe HISTORIAL_COSTOS), CONFIGURACION_NEGOCIO,
> consecutivo de factura, deuda antes/después en abonos, campos de producto compartido, Codigo/ControlaStock/Favorito/CostoUltimaCompra en
> PRODUCTOS, CategoriaConsumo en CATEGORIAS, Equipo en PARTICIPANTES, `GARITA` en CK_CUENTAS_Tipo e Icono → NVARCHAR.
> Decisión: Bancolombia se registra como TRANSFERENCIA (los CHECK de método de pago no cambian).
> Pendiente del delta: triggers (compartidos, ControlaStock, costo promedio) y vistas (VW_FIADOS_PENDIENTES por cliente, VW_MARGENES).

- [ ] **COMPRAS_INVENTARIO**: ProductoId FK, Cantidad, CostoUnitario, FechaHora, Proveedor (opcional), TurnoCajaId (opcional), campos sync
- [ ] **Trigger de costo promedio ponderado**: al insertar compra →
      `PRODUCTOS.CostoCompra = (StockActual×CostoActual + Cant×CostoNuevo)/(StockActual+Cant)` y `StockActual += Cant`
- [ ] Verificar que la vista de P&L use `CostoCompraHist` (congelado por venta) y no el costo vigente

---

## C. Backend (.NET 10 API) — módulos pendientes

- [x] **CuentasController** ✅ (2026-07-18): abrir con anti-fantasma y 409 mesa ocupada, pedidos con `FN_ObtenerPrecioVigente`, cancelación con restitución, liquidar con pago mixto y FIADO-exige-cliente, cancelar cuenta sin borrado físico
- [ ] **GastosController**: CRUD gastos del turno (tabla lista); validación categoría; PIN/autorización a nivel de app
- [ ] **MaquinasController**: CRUD máquinas (desactivar, nunca borrar con movimientos) + movimientos PREMIO/CUADRE + endpoint `VW_MAQUINAS_PENDIENTES` (el "papelito del dueño")
- [ ] **AbonosController**: registrar abono (trigger ya actualiza factura); listar por cliente
- [ ] **Fiados**: endpoint anular fiado (EstadoPago→ANULADO, requiere autorización; NO genera cobro)
- [ ] **PromocionesController**: CRUD + exponer precio vigente (siempre server-side vía `FN_ObtenerPrecioVigente`, jamás en frontend)
- [ ] **ComprasInventarioController** (tras B): registrar compra con costo
- [ ] **CierreController**: arqueo real —
      `EfectivoEsperado = Base + VentasEfectivo + CobrosFiadoEfectivo − GastosEfectivo − PremiosMaq`
      Poblar TotalGastos, TotalPremiosMaq, TotalCobrosFiado; Descuadre calculado
- [ ] **Informe del día** (endpoint de reporte): vendidos por producto (cantidad, ingresos, costo histórico, ganancia), ganancia total, sugerido de pedido (agotados/bajo mínimo ordenados por vendidos)
- [ ] **Apertura de turno con BaseEfectivo** (campo ya existe en TURNOS_CAJA)
- [x] **Pago mixto** en liquidación ✅ — implementado en CuentasController (valida Monto1+Monto2 = Total)
- [ ] **ClientesController**: regla no eliminar con fiado pendiente → solo desactivar

## Reglas ya garantizadas por BD v6 (verificar en smoke tests, no reimplementar)
- ✔ Anti-fantasma: cuenta exige ClienteId o NombreLibre (constraint) — VERIFICADO en smoke test
- ✔ FIADO exige cliente registrado (validación en CuentasController)
- ✔ Stock al ENTREGAR + restitución al CANCELAR, INSERT directo cubierto, TIEMPO excluido (trigger) — VERIFICADO en smoke test
- ✔ Abono actualiza factura original — pago de fiado NO es venta nueva (trigger)
- ✔ CIERRE_DIA inmutable tras Confirmado=1 (trigger)
- ✔ Precio congelado por pedido (PrecioUnitarioHist + CostoCompraHist)

## Infra backend (notas de la trinchera)
- Triggers declarados en `CarambolaSoftDbContext.Partial.cs` (EF Core 7+ OUTPUT): PEDIDOS_CUENTAS, CIERRE_DIA, ABONOS_FIADO, PARTICIPANTES — la partial sobrevive re-scaffolds
- `Directory.Build.props` en raíz suprime NU1903 (necesario para que el scaffold corra) — deuda: actualizar Microsoft.OpenApi
- SesionRepository + handlers Sesiones comentados (era v5) — se reconstruyen en A6

---

## D. Frontend Mesa (React + Tailwind) — pendientes

- [ ] Cabecera TableroMesas.jsx → **MERO PARCHE** (rebranding)
- [x] Panel de cuentas dinámicas ✅ (base): tarjetas con cronómetro vivo, apertura BILLAR/LICORES; al liquidar desaparece — FALTA: nombre-gigante, franja de color por tipo, chip FÍA con monto
- [ ] Botonera de apertura por tipo completa: LICORES / BILLAR / CARTAS (+ DOMINO) / VENTA RÁPIDA (hoy solo LICORES y BILLAR)
- [ ] Catálogo con icono + franja por categoría (Icono/ColorHex ya en BD); precio siempre dorado
- [ ] Cronómetro para CARTAS/DOMINO con tarifa propia (TarifaPorHora en CUENTAS)
- [x] Cuenta en $0 se elimina sin confirmación ✅ (DetalleCuenta)
- [ ] Eliminar cuenta con consumo → PIN + restitución (cancelar pedidos → trigger restituye)
- [ ] Indicador de estado de sincronización (entra con A4)
- [ ] Regla de diseño: **cero dinero visible en pantallas públicas** (totales solo en pantalla de barra/Admin)
- [ ] Integración del logo oficial (logo.jpeg "Licores y Billar MERO PARCHE"; sistema SVG propuesto pendiente de aprobación)

---

## E. Panel Admin (Blazor) — pendientes

- [ ] Caja: resumen por método + línea "Cobros de fiado" + arqueo con efectivo esperado
- [ ] Gastos del turno (registro con autorización, categorías)
- [ ] Máquinas: registro premio/cuadre, pendiente por máquina, reporte por período (turno/semana/quincena/mes/rango) imprimible
- [ ] Informe del día imprimible/PDF (el reporte de la patrona — referencia: `informeDia()` del POS v6.11)
- [ ] Fiados: cartera por cliente, abonos, anulación autorizada
- [ ] Compras de inventario con costo promedio ponderado
- [ ] Historial de cierres (sellados por timestamp — el cierre de 2 a.m. pertenece al día de negocio anterior)
- [ ] [RIESGO] Investigar `node_modules`/`package.json` dentro de CarambolaSoft.Mesa (Blazor) — posible basura de un setup viejo de Vite

---

## F. Datos y go-live

- [ ] Consolidar duplicados en el POS antes de migrar (ej: "Aguardiente Rojo Trago" vs "aguardiente copa roja") — sin borrar historial
- [ ] Script de migración: backup JSON POS → SQL Server (productos+costos promedio, clientes, fiados pendientes como FACTURAS estado FIADO)
- [x] ERD y UML al esquema real v6 (+ delta v6.2 propuesto) ✅ 2026-10-05 → `docs/modelo/` — FALTA el rebranding Mero Parche en los diagramas y las maquetas
- [x] Commit del ElParcheDeJony_DB_v6.sql al repo ✅ 2026-10-05 → `database/` (el futuro v6.2 entra cuando se ejecute)
- [x] POS v6.11 + logo.jpeg a referencias/ ✅ — **actualizar a v6.28** (producción)
- [ ] Mapear `Bancolombia` del POS → `TRANSFERENCIA` en la migración; fiados anteriores a v6.19 sin total original: reconstruir sumando productos y marcar la fila para revisión
- [ ] [RIESGO] Re-sembrar iconos de CATEGORIAS **después** de cambiar la columna a NVARCHAR (re-sembrar antes con `N'...'` no sirve: la columna es VARCHAR)

---

## G. Requisitos nuevos del POS v6.17 → v6.28 (fuente: informe de cambios, 2026-10-02)

Casos de uso que el sistema empresarial aún no tiene. IDs del informe (CU-xx) y decisiones propuestas D-A a D-H (reciben número oficial al aprobarlas; hoy van hasta la #12).
Ninguno revierte las decisiones vigentes. El informe y las capturas viven en el Proyecto de Claude, no en el repo.

- [ ] **CU-01 Factura consecutiva `F-####`** (D-A). Un pago mixto comparte número. [RIESGO] con tablets offline el servidor debe asignar el consecutivo al sincronizar (número provisional en el equipo)
- [ ] **CU-02 Abono parcial de fiado**: pantalla "queda debiendo"; en la BD solo baja `TotalPendienteFiado` (`TotalPagar` no cambia, D-B). Orden de reparto entre varias facturas: **por confirmar** (recomendado: la más antigua primero). El cobro del abono suma al efectivo esperado del turno que lo recauda
- [ ] **CU-03 Cartera de fiados por cliente** (D-C): una fila por cliente con sus facturas (`F-0001 · $10.000 (de $30.000)`); identidad normalizada por id, nombre o apodo → `VW_FIADOS_PENDIENTES` hoy es por factura
- [ ] **CU-04 Recibo de fiado** por factura (total, abonado, saldo) con zona "¿Dónde pagar?"
- [ ] **CU-05 Cierre de caja agrupado por cliente** (no registrados marcados; ventas rápidas y garita aparte). El cierre sigue inmutable tras confirmar
- [ ] **CU-06 Buscar una venta por número de factura**
- [ ] **CU-07 / CU-08 Producto compartido entre cuentas** (D-D, D-E): montos desiguales, suma = precio × cantidad, **stock se descuenta una sola vez** (hoy el trigger restaría por cada parte), restitución solo si ninguna parte se cobró. `Liquidar` debe sumar `ValorParte`
- [ ] **CU-09 Garita por reloj** (D-G): reemplaza la cuenta CARTAS; cada cobro crea una cuenta `GARITA` + su factura; el reloj se calcula desde `InicioUtc` del servidor, nunca con contador local. [RIESGO] el análisis CARTAS vs LICORES pierde su fuente: decidir si se mide por los cobros de GARITAS_RELOJ
- [ ] **CU-10** Botón "+ LICORES" → "+ MESA" (solo nombre visible; `TipoCuenta` sigue `LICORES`)
- [ ] **CU-11 / CU-12 Reabastecer y editar costo con análisis de margen** (D-F): margen = (precio − costo) ÷ precio con el último costo de compra; alerta bajo el objetivo (hoy 40 %); el sistema sugiere, nunca cambia un precio solo; el costo promedio ponderado se mantiene
- [ ] **CU-13 Pantalla de márgenes**: productos bajo objetivo, del más flojo al mejor, con "Subir a $X" (precio sugerido en servidor: `costo ÷ (1 − objetivo)` redondeado hacia arriba)
- [ ] **CU-14 Datos de pago configurables** (D-H): viven en `CONFIGURACION_NEGOCIO`, salen en todos los recibos y en el QR de cobro. [RIESGO] son datos personales: acceso restringido, **nunca** en el código ni en el repo (que es público)
- [ ] **Productos sin límite de stock** (Tinto, Aromática, garita): `ControlaStock` + trigger que lo respete; hoy `CK_PRODUCTOS_Stock` (≥ 0) hace fallar la venta con stock 0
- [ ] **Zona horaria / decisión #12**: la API usa `DateTime.Now` y la BD `GETDATE()`; fijar convención (local vs UTC) antes del go-live — el sync por `desde=` depende de `UltimaModificacion`
- [ ] Redondeo del tiempo de billar a la centena (T2) y pago con tres métodos (T4: hoy `FACTURAS` solo guarda dos)
- [x] `sync.js`, `IndicadorSync.jsx` y ajustes del motor de sync del frontend (A4) subidos al repo (PR #2, 2026-10-06). Pendiente verificar el orquestador, si es un archivo aparte
- [ ] Borrar `CarambolaSoft.Mesa/` (carpeta sin código: `.csproj` + `package.json`; el frontend real es `carambolasoft-mesa/`) y `PedidosCuenta.Partial.cs` en el próximo re-scaffold

---

## H. Marcador (Contador del billar) — Pantalla 3 (2026-10-06)

Fuente: maqueta aprobada en `referencias/contador/` (Inicio, Clientes, Marcador) e informe en `docs/modulos/Informe_Modulo_Marcador_CarambolaSoft.md`.
Propuesta de BD (no ejecutada): `database/propuestas/ElParcheDeJony_DB_v6_2_marcador.sql`. Reutiliza `PARTICIPANTES` y `PARTICIPANTE_MARCAS_TIEMPO`; no crea tablas `MARCADOR_*`.

**Reglas confirmadas por Albeiro**
- El Marcador **agrega jugadores y registra carambolas**. No crea pedidos, no cobra, no toca stock ni caja, y no abre cuentas.
- Solo se registra el número de carambolas de cada serie (bolas 1 a 9 y `+` para 10 o más). **No existe la entrada en cero.** Promedio = total ÷ series contadas.
- Récord **por jugador** = su tacada (serie) más alta. El **récord a tumbar** es la tacada más alta de todas las jugadas de jugadores registrados; se supera solo con una serie estrictamente mayor. Los invitados juegan y suman, pero no cuentan para récord ni rivalidades.
- Nuevo chico = nueva `SesionMesa` bajo la misma cuenta; los jugadores pueden ser los mismos o nuevos.
- El teléfono del cliente es dato nuevo (`CLIENTES.Telefono`) y solo lo ve el administrador.
- En la pantalla de mesa el consumo se ve **sin precios**. El informe con valores sale solo después del PIN de administrador.

**Pendiente**
- [ ] Ejecutar en laboratorio (con backup): delta v6.2 → triggers de stock → costos y vistas → delta del Marcador
- [ ] Portar la maqueta a `carambolasoft-mesa/src/screens/Marcador/` (React) conectada a IndexedDB; cada serie se guarda en el momento (la maqueta pierde todo al recargar)
- [ ] Jugadores identificados por id (no por nombre); máximo 4 jugadores; empate no marca ganador (decisión #8)
- [ ] Corregir última = anular y reinsertar; el récord se recalcula desde las series (la maqueta lo deja mal al corregir)
- [ ] Tiempo de mesa por minuto completo hacia arriba (como `Liquidar`), calculado desde la hora del servidor
- [ ] PIN validado en el API; sin internet, hash con sal guardado en la tablet y revalidado al sincronizar
- [ ] `MarcadorController` y endpoints de sync; el DTO de clientes hacia la tablet de mesa **sin** teléfono; endpoint de administrador para el teléfono
- [ ] Pantalla de Clientes solo para administrador; agregar teléfono al formulario
- [ ] Agregar `PARTICIPANTE_MARCAS_TIEMPO` a `VW_COLA_SINCRONIZACION`
- [ ] Registrar como decisión #18: el Marcador es un módulo independiente que solo lee el consumo
