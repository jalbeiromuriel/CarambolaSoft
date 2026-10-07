# database/

- `ElParcheDeJony_DB_v6.sql` — esquema real de la BD `ElParcheDeJony` (19 tablas, 5 vistas, 1 función, 4 triggers). Generado con SSMS el 2026-10-05 desde `ALBEIROMURIEL\SQLEXPRESS`: instancia independiente, SQL Server 2019, **solo esquema** (sin datos).
- `propuestas/ElParcheDeJony_DB_v6_2_delta.sql` — delta v6.2 (absorbe v6.1). **PROPUESTA: no se ha ejecutado.** Probar en la BD de laboratorio, con backup previo. Cuando se ejecute, regenerar el script completo y subirlo aquí.

Este repositorio es público: **no subir** datos (backups del POS, clientes, fiados), cadenas de conexión ni datos de pago.
- `propuestas/ElParcheDeJony_DB_v6_2_costos_vistas.sql` — costo promedio ponderado (TR_COMPRAS_ActualizarCosto), VW_MARGENES y VW_FIADOS_POR_CLIENTE. **PROPUESTA: no se ha ejecutado.** Va DESPUÉS del delta v6.2. Probado en la BD de laboratorio el 2026-10-07 (5 pruebas OK); falta aplicarlo en la BD real.
- `propuestas/ElParcheDeJony_DB_v6_2_triggers_stock.sql` — triggers de stock v6.2 (ControlaStock, productos compartidos, suma por lote). **PROPUESTA: no se ha ejecutado.** Va DESPUÉS del delta v6.2. Probado en la BD de laboratorio el 2026-10-07 (5 pruebas OK); falta aplicarlo en la BD real.
- `propuestas/ElParcheDeJony_DB_v6_3_usuarios.sql` — tabla USUARIOS con roles ADMIN, PATRONA y EMPLEADO (PIN solo como hash con sal, bloqueo por intentos). **PROPUESTA: no se ha ejecutado contra la BD real.** Va DESPUÉS del delta v6.2. No crea usuarios ni PIN: el primer ADMIN se aprovisiona por un endpoint seguro.
