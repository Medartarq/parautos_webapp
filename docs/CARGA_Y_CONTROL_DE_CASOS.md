# Carga y control de casos

Este documento explica dos cosas por separado:

1. **Cómo se controla la carga (paginación, filtros, contadores y exportaciones) de los casos** que vienen de la base de datos y se muestran en las vistas.
2. **Qué archivo crea los casos ficticios de la demo y cómo funciona** paso a paso.

Todas las rutas son relativas a la raíz del repositorio (`D:\Parautos\app-final`).

---

## Parte 1. Control de carga de casos en la base de datos y en las vistas

### 1.1 Archivo central

El control vive en un único archivo del servidor:

```
server/src/modules/orders/paginated-lists.ts
```

Ese archivo concentra la regla para las cuatro listas paginadas del sistema:

| `kind`        | Uso                                          |
| ------------- | -------------------------------------------- |
| `orders`      | Vista Órdenes y vista Cotizaciones            |
| `parts`       | Vista Repuestos                               |
| `reportQuotes`| Reporte de cotizaciones pendientes            |
| `reportParts` | Reporte de repuestos pendientes               |

Contiene estas piezas:

#### `listQuerySchema`

Esquema Zod que valida **todo** lo que llega por query string:

- `page`: entero entre 1 y 1 000 000. Por defecto `1`.
- `pageSize`: solo admite `10`, `20` o `30`. Por defecto `10`.
- `search`: texto libre, máximo 200 caracteres.
- `status`, `modality`, `advisor`, `provider`, `quality`: filtros de texto.
- `age`: `RECENT`, `ATTENTION`, `OVERDUE`, `NEXT_3`, `NO_DATE` o vacío.
- `from` y `to`: fechas ISO (`YYYY-MM-DD`) para el rango de fechas.
- `pendingClaim`: `true` / `false` para el filtro de siniestro pendiente.
- `view`: vacío o `quotes`; con `quotes` la lista de órdenes se restringe a
  `COTIZACION_PENDIENTE` y `ESPERA_APROBACION`.

Si `pageSize` llega con otro valor (`5`, `31`, `1000`, `all`, etc.), la petición
falla con error de validación; no se puede pedir "todo" por la API.

#### `buildListFilter(kind, query)`

Construye el `WHERE` y el arreglo de valores **parametrizados**. Nunca concatena
datos del usuario dentro del SQL. Algunos ejemplos de cómo traduce los filtros:

- `search`: `(orderNumber LIKE ? OR plate LIKE ? OR ...)` con `%término%`
  repetido por columna.
  - Órdenes y cotizaciones: `orderNumber`, `plate`, `client`, `brand`, `model`.
  - Repuestos: `orderNumber`, `plate`, `description`, `partCode`, `claimNumber`,
    `providerName`.
  - Reporte de repuestos: `orderNumber`, `plate`, `client`, `brand`, `model`,
    `description`, `providerName`.
- `status`: `status = ?` (o el estado calculado de un repuesto).
- `modality`: `modality = ?`.
- `from` / `to`: `createdAt >= ?` y `createdAt < DATE_ADD(?, INTERVAL 1 DAY)`
  para órdenes; `expectedDate` para repuestos.
- `age`: `DATEDIFF(CURDATE(), DATE(createdAt))` para órdenes y cotizaciones;
  `expectedDate` para repuestos.
- `view = quotes`: agrega `status IN ('COTIZACION_PENDIENTE','ESPERA_APROBACION')`.
- `pendingClaim = true`: agrega `claimPending = 1`.

El mismo `WHERE` se usa para contar y para traer la página, por eso los totales
siempre coinciden con los filtros aplicados.

#### `listPage(kind, query)`

Hace exactamente dos consultas:

1. `SELECT COUNT(*)` sobre la misma subconsulta y el mismo `WHERE`.
2. `SELECT * ... LIMIT ? OFFSET ?` con el tamaño de página y el desplazamiento.

Además:

- Calcula `pages = max(1, ceil(total / pageSize))`.
- Ajusta `page` al rango válido con `min(page, pages)`. Si el usuario estaba en
  la página 9 y un filtro deja solo 2 páginas, la respuesta devuelve la página 2
  en lugar de una lista vacía.
- Devuelve `{ rows, pagination: { page, pageSize, total, pages } }`.

El orden es estable y está definido en `listOrder`:

- Órdenes, cotizaciones y reporte de cotizaciones:
  `createdAt DESC, id DESC`.
- Repuestos y reporte de repuestos:
  `expectedDate IS NULL, expectedDate, updatedAt DESC, id DESC`
  (primero los que no tienen fecha, luego por fecha esperada y por última
  actualización).

#### `orderListSummary()`

Calcula los **contadores globales** que se muestran arriba de la tabla:

- Cantidad de órdenes agrupadas por `internal_status`.
- Total general.
- Cantidad de casos con más de 5 días en
  `COTIZACION_PENDIENTE` o `ESPERA_APROBACION`.

Estos contadores no dependen de la página ni del `pageSize`; son totales de la
base activa (producción o demo).

#### `exportReportRows(kind, query)`

Usa el mismo `buildListFilter` que la lista, pero **sin `LIMIT` ni `OFFSET`**.
Así la exportación incluye todas las coincidencias de los filtros actuales, no
solo la página visible. Es la razón por la que el botón "Exportar CSV" y
"Descargar PDF" pueden devolver más de 30 filas.

#### `partsPage(query)` y `recentOrders()`

- `partsPage`: reutiliza `listPage("parts", query)` y agrega métricas de
  repuestos (vencidos, pedidos, sin proveedor, recibidos) y el catálogo de
  proveedores.
- `recentOrders`: devuelve las últimas 5 órdenes y el resumen global para el
  panel de inicio.

### 1.2 Rutas HTTP que exponen ese control

```
server/src/modules/orders/routes.ts
```

- `GET /api/v1/orders`
  Valida con `listQuerySchema.parse(request.query)`, llama a
  `listPage("orders", ...)` y responde:

  ```json
  {
    "orders": [],
    "pagination": { "page": 1, "pageSize": 10, "total": 1000, "pages": 100 },
    "counts": { "COTIZACION_PENDIENTE": 254 },
    "total": 1000,
    "overdue": 123
  }
  ```

- `GET /api/v1/orders/parts/workbench`
  Usa `partsPage(...)` y devuelve repuestos, paginación, métricas y proveedores.

```
server/src/modules/reports/routes.ts
```

- `GET /api/v1/reports/list/:kind`
  `kind` es `quotes` o `parts`. Devuelve `{ rows, pagination, options }`.
- `GET /api/v1/reports/export/:kind`
  Devuelve `{ rows }` con **todas** las coincidencias, sin paginar.

### 1.3 Separación demo / producción en la base de datos

El control de paginación es el mismo para ambos entornos; lo que cambia es la
conexión:

```
server/src/middleware/demo-context.ts
server/src/db/pool.ts
```

- `demo-context.ts` lee la cookie `parautos_demo_mode=1` y exige que el usuario
  sea `SUPERADMINISTRADOR`. Si se cumple, ejecuta el resto de la petición dentro
  de `runWithDatabaseScope("demo", next)`.
- `runWithDatabaseScope` guarda el ámbito en `AsyncLocalStorage`.
- `getPool()` devuelve el pool de demo dentro de ese ámbito y el pool de
  producción fuera de él. Las consultas de `paginated-lists.ts` no saben de qué
  base se trata: siempre llaman a `getPool()`.
- `getDemoPool()` exige `DEMO_MODE_ENABLED=true` y usa las variables
  `DEMO_DB_*`.

Gracias a eso, la misma función `listPage` pagina la base demo cuando el
superadministrador entra en modo demo y la base real cuando no.

### 1.4 Control en las vistas (cliente)

#### Hook y componente compartido

```
client/src/pagination.tsx
client/src/pagination.css
```

`usePagination(filters)` mantiene el estado de paginación de cada vista:

- `page`: página actual.
- `pageSize`: `10` por defecto.
- `setPage(n)`: cambia de página.
- `setPageSize(n)`: cambia el tamaño y **vuelve a la página 1**.
- `params`: construye el query string con los filtros + `page` + `pageSize`.

Cuando cambia cualquier filtro, el hook detecta el cambio (compara la clave de
los filtros) y reinicia la página a 1. Así no se queda en una página que ya no
existe.

`<Pagination>` es la **única barra de resultados** de cada vista. Muestra:

- `Mostrando X–Y de Z` (o `Cargando resultados…` mientras consulta).
- Selector de resultados por página: `10`, `20`, `30`.
- Botones `« Primera`, `Anterior`, `Siguiente` y `Última »`.
- Números de página con el actual resaltado y puntos suspensivos cuando hay
  muchas páginas.
- En la primera página se deshabilitan `Primera` y `Anterior`; en la última se
  deshabilitan `Siguiente` y `Última`.
- `aria-live="polite"` para que el cambio se anuncie a lectores de pantalla.

No hay una segunda barra ni contadores duplicados: los contadores de arriba son
métricas globales y la barra de paginación es la única que describe la página.

#### Vistas que la usan

```
client/src/app.tsx
```

- `QuotesView` (Cotizaciones): `usePagination({ search, status, modality, age, from, to, view: "quotes" })`.
  Los botones de etapa muestran los contadores globales (`counts`) y el total
  de "más de 5 días" (`overdue`).
- `OrdersView` (Órdenes): `usePagination({ search, status, modality, pendingClaim })`.
- `PartsView` (Repuestos): `usePagination({ search, status, provider, age, quality })`.

```
client/src/report-lists.tsx
```

- `ReportLists` (reportes de cotizaciones y repuestos):
  `usePagination(filters)` y `<Pagination>` una sola vez.
- La exportación llama a `/reports/export/:kind` con los filtros pero sin
  `page` ni `pageSize`, y arma el CSV o el PDF con todas las filas devueltas.

#### Caché separada por entorno

```
client/src/scoped-query.tsx
client/src/query-client.ts
```

`useScopedQuery` arma la clave de caché con `resourceKey(scope, resource)`, que
incluye `userId` y `mode` (`production` o `demo`). Al cambiar de entorno, las
consultas se vuelven a pedir y no se mezclan filas de demo con filas reales.

### 1.5 Flujo completo de una consulta

1. El usuario escribe en el buscador o cambia un filtro.
2. `usePagination` reinicia `page` a 1 y arma `?search=...&page=1&pageSize=10`.
3. `useScopedQuery("orders", "/orders?...")` hace `GET /api/v1/orders?...`.
4. `demo-context.ts` decide si la petición va a demo o a producción.
5. La ruta valida el query con `listQuerySchema`.
6. `listPage` cuenta el total con el `WHERE` y luego trae solo la página.
7. La respuesta incluye `orders`, `pagination` y los contadores globales.
8. `<Pagination>` muestra "Mostrando 1–10 de 1000" y los botones.
9. Al cambiar de página solo cambia `page`; al cambiar un filtro se vuelve a la
   página 1.

### 1.6 Pruebas del control de carga

```
server/src/modules/orders/paginated-lists.test.ts
client/src/pagination.test.tsx
```

Cubren, entre otras cosas:

- `pageSize` por defecto en 10 y válido solo para 10/20/30.
- Rechazo de `0`, `5`, `31`, `1000`, `10.5`, etc.
- Cálculo de `total` y `pages` con los mismos filtros.
- Ajuste de una página fuera de rango.
- Que el SQL use `LIMIT ? OFFSET ?` y un orden estable.
- Que la barra muestre el rango correcto y oculte botones cuando corresponde.

---

## Parte 2. Creación de casos ficticios

### 2.1 Archivos que participan

| Archivo | Función |
| --- | --- |
| `server/src/db/seed-1000-demo.ts` | **Archivo principal**: crea las 1 000 órdenes ficticias. |
| `server/src/db/demo-personas.ts` | Genera nombres, correos y teléfonos realistas de forma determinista. |
| `server/src/db/seed-demo-environment.ts` | Prepara el entorno demo: usuario de sistema y los 4 casos base. |
| `server/src/db/seed-demo.ts` | Crea los 4 casos base `DEM-101`, `DEM-202`, `DEM-303`, `DEM-404`. |
| `scripts/seed-1000-demo.ts` | Lanzador local por línea de comandos. |
| `server/src/db/verify-1000-demo.ts` | Reporte de solo lectura para comprobar la carga. |
| `server/src/db/purge-1000-demo.ts` | Purga controlada del lote `DM####`. |
| `scripts/run-deploy-migrations.mjs` | Orquesta la carga (y la purga opcional) durante el despliegue. |

Los comandos npm están definidos en `package.json` (raíz) y `server/package.json`:

```bash
npm run seed:demo:1000      # carga
npm run verify:demo:1000    # verificación de solo lectura
npm run purge:demo:1000     # purga (simulación por defecto)
```

### 2.2 Punto de entrada y protecciones

El archivo principal es:

```
server/src/db/seed-1000-demo.ts
```

Su función exportada es `seed1000Demo()`. Antes de escribir nada:

1. Exige `DEMO_MODE_ENABLED=true`. Si no, lanza un error y termina.
2. Lee `DEMO_SEED_COUNT` (por defecto `1000`) y `DEMO_SEED_START` (por defecto
   `0`) para permitir lotes o reanudar una carga.
3. Ejecuta todo dentro de `runWithDatabaseScope("demo", ...)`. Eso hace que
   `createOrder`, `createQuote` y `transitionQuote` usen `getPool()` apuntando a
   la base demo y que los adjuntos se guarden en la carpeta demo
   (`DEMO_LOCAL_UPLOAD_BASE` + `DEMO_LOCAL_UPLOAD_DIR`).
4. Nunca usa `DB_NAME` ni el pool de producción.

La conexión demo se define en `server/src/db/pool.ts` con las variables
`DEMO_DB_HOST`, `DEMO_DB_PORT`, `DEMO_DB_NAME`, `DEMO_DB_USER` y
`DEMO_DB_PASSWORD`.

### 2.3 Catálogos que necesita

Dentro del ámbito demo, el seed consulta:

- Usuarios activos con rol `ASESOR`, `ADMINISTRADOR` o `SUPERADMINISTRADOR`
  (para asignar el asesor de cada orden).
- `body_types` activos.
- `checklist_items` activos.

Si falta alguno de esos catálogos, se detiene con un error claro. Las órdenes se
crean siempre con **todos** los ítems activos del checklist.

### 2.4 Idempotencia por placa

Antes del bucle, el seed lee las placas existentes:

```sql
SELECT v.plate
FROM service_orders o
JOIN client_vehicles cv ON cv.id = o.client_vehicle_id
JOIN vehicles v ON v.id = cv.vehicle_id
WHERE v.plate LIKE 'DM%'
```

Guarda esas placas en un `Set` y, por cada índice, calcula la placa normalizada
(`DM0001`, sin guion). Si ya existe, incrementa `skipped` y continúa. Por eso:

- La primera ejecución crea las 1 000.
- Una segunda ejecución reporta `Creadas=0 existentes=1000`.
- Un despliegue posterior no duplica datos.

La placa visible se genera como `DM-0001` y se normaliza a `DM0001` al guardar.

### 2.5 Generación de datos de cada caso

La función `seedOneCase(context, index)` arma un caso completo a partir del
índice. No usa `Math.random`: el mismo índice produce siempre los mismos datos.

#### Personas (`demo-personas.ts`)

`personaFor(index)` usa `demoHash(index)` (un hash entero de 32 bits) para elegir:

- Un nombre de pila de una lista de nombres peruanos.
- Dos apellidos distintos de una lista de apellidos peruanos.
- Un correo `nombre.apellido##@demo.parautos.pe`.
- Un teléfono de 9 dígitos que empieza con `9`.

El resultado es un nombre creíble, por ejemplo `Ricardo Maldonado Yupanqui`,
distinto de `Cliente Demo 0001`. El dominio `demo.parautos.pe` identifica el
lote.

#### Datos del cliente y del vehículo

- DNI: `70000000 + index`.
- Placa: `DM-####`.
- VIN: `DMV` + 8 dígitos + 6 dígitos = 17 caracteres, sin las letras `I`, `O`
  ni `Q`.
- Marca, modelo y color: se eligen con `index % 10` de listas fijas.
- Año: `2015 + (index % 10)`.
- Kilometraje: `12000 + (index % 90) * 137`.
- Nivel de combustible: uno de `0`, `25`, `50`, `75`, `100`.
- Modalidad: rota entre `PARTICULAR`, `MAPFRE`, `RIMAC`, `PACIFICO`,
  `LA_POSITIVA` y `QUALITAS`.
- Las modalidades que no son `PARTICULAR` agregan un número de siniestro
  `DM-2026-####`.

#### Checklist y firma

`checklistAnswersFor` responde `SI` a todos los ítems activos y marca `NO` (con
observación) cada onceavo ítem. La orden se crea con:

- `checklistReviewed: true`.
- Una firma PNG 1×1 válida en `signature`.
- `acceptedTerms: true`.

Estos campos son obligatorios en `createOrder`; sin ellos la orden se rechaza.

#### Cotización

`createQuote` se llama con dos líneas de mano de obra:

- `PLANCHADO`: precio base 140 + variación.
- `PINTURA`: precio base 165 + variación.

Si `index % 3 === 0` se agrega una línea de `REPUESTO` con precio variable. La
cotización se crea siempre, incluso en la etapa "por cotizar" (etapa 0).

#### Etapas del flujo

`stage = index % 4` reparte los casos en cuatro grupos:

| `index % 4` | Acción | Estado resultante |
| --- | --- | --- |
| `0` | Solo se crea la cotización | `COTIZACION_PENDIENTE` |
| `1` | `transitionQuote(..., "SEND")` | `ESPERA_APROBACION` |
| `2` | `transitionQuote(..., "SEND")` | `ESPERA_APROBACION` |
| `3` | `SEND` y luego `APPROVE` | `ESPERA_REPUESTOS` si la cotización tiene repuesto; `EN_REPARACION` si no |

La transición `APPROVE` también inserta en `order_parts` las líneas de repuesto
de la cotización, por eso la vista de repuestos muestra casos reales.

#### Manejo de errores por caso

Cada llamada a `seedOneCase` está envuelta en `try/catch`. Si un caso falla:

- Se registra `Falló índice=... placa=...: mensaje`.
- Se incrementa `failed`.
- El lote continúa con el siguiente índice.

Al final se imprime un resumen:

```
[seed-1000] Creadas=1000 existentes=0 fallidas=0 en 139.3s.
```

### 2.6 Fechas variadas (`backdateCase`)

Después de crear la orden, la cotización y sus transiciones, `backdateCase`
reescribe las fechas para que la demo no parezca creada "toda hoy":

- `dateFor(index, anchor)` usa el hash del índice para elegir:
  - Un día entre los últimos 365.
  - Una hora entre las 08:00 y las 18:59.
  - Minutos y segundos variables.
- Si la fecha calculada cae en el futuro, se resta un día.
- Se calcula una línea de tiempo coherente:
  - Orden: fecha base.
  - Recepción: base + 60 minutos.
  - Cotización: base + 180 minutos.
  - Envío: base + 1 día (solo etapas 1, 2 y 3).
  - Aprobación: base + 2 días (solo etapa 3).

Luego actualiza:

- `service_orders.created_at` y `service_orders.order_number`, recalculando el
  número como `OS-<año>-<id con 5 dígitos>`. El año del número coincide con el
  año de la fecha retroactiva.
- `receptions.created_at`.
- `quote_versions.created_at`, `sent_at` y `approved_at`.
- `attachments.created_at`.
- `audit_events.created_at`, diferenciando `CREATED`, `QUOTE_CREATED`,
  `QUOTE_SENT` y `QUOTE_APPROVED`.

En la base quedan fechas repartidas en 13 meses (por ejemplo, 182 casos en 2025
y 818 en 2026), sin desalineación entre el año de la fecha y el año del
`order_number`.

### 2.7 Bucle, progreso y resultado

El bucle es **secuencial a propósito**: cada caso depende de su propia orden y
cotización, y así un error no arrastra a los demás. Está marcado con `NOSONAR`
para dejar explícita esa decisión.

Cada 50 casos se imprime el avance:

```
[seed-1000] 50/1000 creadas (6.8s, 0 fallidas)
```

Al finalizar, una carga completa deja aproximadamente:

- 1 000 órdenes con placa `DM####`.
- 1 000 clientes, vehículos y recepciones.
- 1 000 cotizaciones del lote (más las de los 4 casos base y las pruebas).
- 85 repuestos generados por las cotizaciones aprobadas con repuesto.
- 1 000 adjuntos de firma en la carpeta demo.
- Los 4 casos base `DEM-101`…`DEM-404` intactos.

### 2.8 Variables de configuración

| Variable | Por defecto | Efecto |
| --- | --- | --- |
| `DEMO_MODE_ENABLED` | — | Debe ser `true`; si no, el seed no escribe nada. |
| `DEMO_SEED_COUNT` | `1000` | Cantidad de casos a crear en esta ejecución. |
| `DEMO_SEED_START` | `0` | Índice inicial; permite lotes o reanudar. |
| `DEMO_SEED_1000` | — | `false` omite la carga durante el despliegue. |
| `DEMO_PURGE_CONFIRM` | vacío | `PURGE` borra el lote antes de recargarlo. |
| `DEMO_DB_HOST/PORT/NAME/USER/PASSWORD` | — | Conexión de la base demo. |
| `DEMO_LOCAL_UPLOAD_BASE` | — | `project` (cwd) o `home` para la carpeta de adjuntos demo. |
| `DEMO_LOCAL_UPLOAD_DIR` | — | Subcarpeta de adjuntos demo (por ejemplo `data/demo-uploads`). |

### 2.9 Cómo se ejecuta en local

```bash
npm run seed:demo:1000
```

El script npm de la raíz delega en `server/package.json`, que ejecuta:

```
tsx src/db/seed-1000-demo.ts
```

El lanzador `scripts/seed-1000-demo.ts` hace lo mismo pero fijando el directorio
de trabajo en `server/`, para que la carpeta de adjuntos coincida con la que usa
la aplicación.

### 2.10 Cómo se ejecuta en el despliegue

`scripts/run-deploy-migrations.mjs` ejecuta, con los binarios compilados de
`server/dist` y solo cuando `DEPLOY_RUN_MIGRATIONS=true`:

1. `server/dist/db/migrate.js` — migraciones de la base real.
2. `server/dist/db/migrate-demo.js` — migraciones de la base demo.
3. `server/dist/db/seed-demo-environment.js` — usuario de sistema y 4 casos base.
4. Si `DEMO_PURGE_CONFIRM=PURGE`:
   `server/dist/db/purge-1000-demo.js` — purga el lote `DM####`.
5. `server/dist/db/seed-1000-demo.js` — carga las 1 000 órdenes.

Si `DEMO_SEED_1000=false`, el paso 5 (y la purga del paso 4) se omiten.

### 2.11 Verificación y purga

Para comprobar la carga sin modificar nada:

```bash
npm run verify:demo:1000
```

Revisa el total de órdenes, cuántas son `DM%`, la distribución por estado y
modalidad, las cotizaciones, los repuestos y las últimas órdenes.

Para borrar solo el lote ficticio:

```bash
npm run purge:demo:1000
```

Sin `DEMO_PURGE_CONFIRM=PURGE` solo simula y muestra cuántas filas borraría. Con
la variable confirmada borra únicamente placas `^DM[0-9]+$`, dentro de una
transacción y después de verificar con `SELECT DATABASE()` que la conexión es la
base demo. Los 4 casos base `DEM101`…`DEM404` no se tocan.

### 2.12 Precauciones

- No ejecutar el seed con `DEMO_MODE_ENABLED=false`: se detiene, pero es mejor
  no arriesgar una configuración cruzada.
- No cambiar `DEMO_DB_NAME` por el nombre de producción: el seed usa el pool
  demo, pero la configuración debe ser explícita.
- La purga solo reconoce placas `DM####`. Cualquier caso ficticio con otra placa
  no se borra automáticamente.
- Si se deja `DEMO_PURGE_CONFIRM=PURGE` en el entorno de Hostinger, **cada
  despliegue** purga y recarga el lote completo. Quitarla cuando ya no se
  necesite regenerar nombres y fechas.
- La carga es idempotente por placa; para "refrescar" nombres o fechas hay que
  purgar primero.

---

## Mapa rápido de archivos

| Necesito… | Archivo |
| --- | --- |
| Entender la paginación, filtros y contadores | `server/src/modules/orders/paginated-lists.ts` |
| Ver los endpoints de órdenes | `server/src/modules/orders/routes.ts` |
| Ver los endpoints de reportes y exportación | `server/src/modules/reports/routes.ts` |
| Entender el cambio demo/producción | `server/src/middleware/demo-context.ts` y `server/src/db/pool.ts` |
| Ver la barra de paginación | `client/src/pagination.tsx` y `client/src/pagination.css` |
| Ver las vistas de órdenes, cotizaciones y repuestos | `client/src/app.tsx` |
| Ver las vistas de reportes y exportación | `client/src/report-lists.tsx` |
| Crear los 1 000 casos ficticios | `server/src/db/seed-1000-demo.ts` |
| Cambiar nombres, correos o teléfonos ficticios | `server/src/db/demo-personas.ts` |
| Crear los 4 casos base de la demo | `server/src/db/seed-demo.ts` |
| Lanzar la carga en local | `scripts/seed-1000-demo.ts` |
| Verificar la carga | `server/src/db/verify-1000-demo.ts` |
| Purgar el lote | `server/src/db/purge-1000-demo.ts` |
| Integrar todo en el despliegue | `scripts/run-deploy-migrations.mjs` |
