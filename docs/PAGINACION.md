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

Formato de los datos ficticios: DNI `70xxxxxx`, placa `DM-####`, VIN `DMV…`,
correo `cliente<n>@demo.parautos.pe`. Esos prefijos son los que identifican el
lote para una limpieza controlada.
