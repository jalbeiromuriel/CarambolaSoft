# BACKLOG MAESTRO — CarambolaSoft (Mero Parche)
### Fuente: POS temporal v6.11 en producción = especificación validada del negocio
### Actualizado: 2026-07-21 · Avance estimado: ~45%

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
5. **Pantalla 3 — Marcador electrónico** (maqueta primero, luego código)
6. **Reescritura SesionesController + SesionRepository** (deuda técnica: handlers comentados; adaptar a v6 donde `TarifaPorHora` vive en CUENTAS)
7. **Migración go-live**: inventario, clientes y fiados desde backup JSON del POS → SQL Server

---

## B. BD v6.1 — delta de esquema pendiente

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
- [ ] Actualizar ERD/UML/maquetas al rebranding Mero Parche y al esquema v6/v6.1
- [ ] Commit del ElParcheDeJony_DB_v6.sql (+ futuro v6.1) al repo y a referencias/ del monorepo
- [x] POS v6.11 + logo.jpeg a referencias/ ✅ (pendiente commit)
