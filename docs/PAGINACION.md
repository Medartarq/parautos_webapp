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

El despliegue de esta mejora no requiere migraciones nuevas ni carga datos ficticios.
