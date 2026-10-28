# Listados operativos paginados

La misma regla se aplica a producción y demo a través del ámbito de conexión existente:

- Órdenes, Cotizaciones, Gestión de repuestos y listados de Reportes: 10 resultados por defecto, selector 10/20/30.
- El servidor valida `page` y `pageSize`, filtra antes de contar y aplica `LIMIT/OFFSET` con orden estable por fecha e ID.
- Búsqueda, estado, modalidad, fechas y demás filtros operan sobre todos los registros. Cambiar filtros o tamaño vuelve a la primera página.
- Las respuestas incluyen `pagination: { page, pageSize, total, pages }`. Una página fuera de rango se ajusta a la última disponible.
- Los indicadores y las opciones de los filtros se obtienen independientemente de la página visible.
- Inicio consulta cinco órdenes recientes; notificaciones devuelve hasta ocho prioridades con contadores globales.
- Reportes consulta resúmenes agregados. Las exportaciones CSV/PDF usan `/reports/export/quotes` o `/reports/export/parts`, con los mismos filtros y todas las coincidencias en una sola consulta, únicamente al solicitar la exportación.

## Verificación manual

1. En cada modo, abrir Órdenes y comprobar 10 filas y el total global.
2. Cambiar a 20/30 y navegar hasta la última página.
3. Desde una página posterior, buscar una orden que no estuviera en la primera página: debe aparecer y el paginador debe volver a 1.
4. Repetir en Cotizaciones, Repuestos y ambas pestañas de Reportes; probar filtros combinados y cero coincidencias.
5. Comprobar que métricas y opciones no se reducen a la página visible.
6. Exportar un reporte con más de 30 coincidencias y verificar que incluye todas.
7. Cambiar entre demo y producción y confirmar que los resultados pertenecen al modo activo.

## Carga de volumen en la base demo

Los casos ficticios viven únicamente en la base demo. La carga se ejecuta con
`runWithDatabaseScope("demo")`, por lo que `createOrder`, `createQuote` y
`transitionQuote` usan la conexión demo y la carpeta de adjuntos demo. Si
`DEMO_MODE_ENABLED` no es `true`, el proceso se detiene sin escribir nada.

```bash
npm run seed:demo:1000     # carga 1.000 órdenes (idempotente por placa DM-####)
npm run verify:demo:1000   # reporte de solo lectura
```

Variables opcionales:

- `DEMO_SEED_COUNT` (por defecto `1000`) y `DEMO_SEED_START` (por defecto `0`) para
  ejecutar lotes o reanudar una carga.
- `DEMO_SEED_1000=false` omite la carga durante el despliegue.

El despliegue (`scripts/run-deploy-migrations.mjs`) ejecuta, con los binarios
compilados de `server/dist`, las migraciones, las migraciones demo, el seed demo
base y esta carga cuando `DEMO_MODE_ENABLED=true` y `DEPLOY_RUN_MIGRATIONS=true`.
Las órdenes ya cargadas se omiten, así que los despliegues posteriores no
duplican datos.

Si además `DEMO_PURGE_CONFIRM=PURGE` está definida en el entorno del despliegue,
el build purga primero el lote `DM####` y luego lo recarga completo, de modo que
los nombres y las fechas se regeneran en cada despliegue. Esa recarga añade unos
minutos al build; quite la variable cuando ya no necesite refrescar los datos
ficticios. Sin la variable, el despliegue solo ejecuta la carga idempotente.

Formato de los datos ficticios: nombre y apellidos peruanos generados de forma
determinista, DNI `70xxxxxx`, placa `DM-####`, VIN `DMV…`, correo
`nombre.apellido##@demo.parautos.pe` y fechas repartidas en los últimos 365 días
en horario de 08:00 a 18:59. Esos prefijos (placa y dominio de correo) son los
que identifican el lote para una limpieza controlada.

## Purga controlada del lote demo

`npm run purge:demo:1000` elimina solo las órdenes con placa `DM####` de la base
demo. Por defecto **simula** (dry-run); para borrar hay que confirmar con la
variable de entorno:

```bash
DEMO_PURGE_CONFIRM=PURGE npm run purge:demo:1000
```

El despliegue ejecuta automáticamente esa purga antes de la carga cuando
`DEMO_PURGE_CONFIRM=PURGE` está presente en el entorno de Hostinger.

En PowerShell:

```powershell
$env:DEMO_PURGE_CONFIRM="PURGE"; npm run purge:demo:1000; Remove-Item Env:DEMO_PURGE_CONFIRM
```

Salvaguardas, todas obligatorias:

- `DEMO_MODE_ENABLED=true` y `DEMO_DB_NAME` distinto de `DB_NAME`.
- La conexión debe ser exactamente `DEMO_DB_NAME`: se comprueba con
  `SELECT DATABASE()` antes de tocar nada.
- Cualquier valor de `DEMO_PURGE_CONFIRM` distinto de `PURGE` aborta.
- La selección se limita a placas `^DM[0-9]+$`; nunca hay un `DELETE` global.
- El borrado va en una sola transacción y respeta el orden de las claves
  foráneas. Después elimina los adjuntos demo de esas órdenes.
- Los cuatro casos base `DEM101`…`DEM404` no se tocan.

Al terminar, `npm run seed:demo:1000` vuelve a cargar el lote completo.

