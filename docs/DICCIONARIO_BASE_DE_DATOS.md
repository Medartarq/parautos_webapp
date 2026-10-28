# Diccionario de la base de datos principal

Este documento explica **cada tabla** de la base de datos principal de PARAUTOS:
para qué existe, qué guarda, cómo se relaciona y por qué está separada de las
demás.

## Contexto

- Motor: **MariaDB / InnoDB**, charset `utf8mb4`.
- Base principal: la definida en `DB_NAME` (en local, `parautos_local`).
- La base demo (`DEMO_DB_NAME`) usa **el mismo esquema**; solo cambia el
  contenido. Todo lo descrito aquí aplica a ambas.
- El esquema se crea y evoluciona con los archivos de
  `database/migrations/001_…` a `025_…`.
- El migrador `server/src/db/migrate.ts` aplica cada archivo una sola vez y
  registra el avance en `schema_migrations`.
- No hay vistas SQL: toda la lectura se hace con consultas de la aplicación.

Resumen por dominios:

| Dominio | Tablas |
| --- | --- |
| Control técnico | `schema_migrations` |
| Identidad y acceso | `roles`, `users`, `sessions`, `app_settings`, `api_rate_limits` |
| Auditoría | `audit_events` |
| Catálogos | `body_types`, `checklist_categories`, `checklist_items`, `parts_providers`, `order_status_transitions` |
| Clientes y vehículos | `clients`, `vehicles`, `client_vehicles` |
| Casos y recepción | `service_orders`, `receptions`, `reception_snapshots`, `damage_marks`, `checklist_answers`, `attachments`, `reception_drafts`, `order_operational_data` |
| Cotizaciones | `quote_versions`, `quote_lines`, `quote_drafts`, `quote_draft_lines` |
| Repuestos | `order_parts`, `order_parts_logistics` |
| Cierre y entrega | `order_labor_verifications`, `order_final_controls` |

---

## 1. Control técnico

### `schema_migrations`

**Para qué sirve:** registrar qué archivos de migración ya se aplicaron.

**Columnas principales:**

- `version` (`VARCHAR(255)`, PK): nombre del archivo, por ejemplo
  `025_reception_snapshots.sql`.
- `applied_at` (`DATETIME(6)`): momento en que se aplicó.

**Relaciones y reglas:** no tiene claves foráneas. La crea el propio migrador
(`server/src/db/migrate.ts`) con `CREATE TABLE IF NOT EXISTS`.

**Razón de ser:** permite que `npm run build` / `npm run migrate` sean
idempotentes. Sin esta tabla, cada despliegue intentaría recrear tablas y
columnas ya existentes. Es la memoria del proceso de migración, no un dato del
negocio.

---

## 2. Identidad y acceso

### `roles`

**Para qué sirve:** catálogo de roles del sistema.

**Columnas principales:**

- `id` (PK).
- `code` (`VARCHAR(30)`, único): `SUPERADMINISTRADOR`, `ADMINISTRADOR`, `ASESOR`.
- `name` (`VARCHAR(80)`, único).
- `description`, `active`, `created_at`.
- `CHECK active IN (0,1)`.

**Relaciones:** `users.role_id` referencia esta tabla.

**Razón de ser:** centraliza los permisos y evita guardar textos de rol
repetidos en cada usuario. Los roles sembrados en las migraciones son parte del
contrato de autorización del backend (`requireRoles(...)`). El trigger
`trg_roles_before_delete` (migración 024) impide borrar un rol con usuarios
asignados.

### `users`

**Para qué sirve:** cuentas que inician sesión y operan el sistema.

**Columnas principales:**

- `id` (PK).
- `role_id` (FK a `roles`).
- `names` (`VARCHAR(120)`).
- `username` (`VARCHAR(80)`, único) y `email` (`VARCHAR(150)`, único).
- `password_hash` (`VARCHAR(255)`): hash Argon2, nunca la contraseña.
- `active` (`TINYINT(1)`).
- `deactivated_at`, `anonymized_at`: retención y anonimización.
- `password_changed_at`, `created_at`, `updated_at`.
- Índice `(role_id, active)`.

**Relaciones:** es referenciada por `sessions`, `service_orders`
(`advisor_user_id`), `receptions`, `attachments`, `quote_versions`,
`quote_drafts`, `reception_drafts`, `order_final_controls`,
`order_labor_verifications` y `audit_events`.

**Razón de ser:** separa la identidad de la persona (nombre, correo) del rol y
de la sesión. El asesor de una orden se guarda como FK, no como texto, para
poder filtrar por usuario y conservar la trazabilidad. Los campos de
desactivación y anonimización permiten retirar cuentas sin borrar el historial
de las órdenes que atendieron.

### `sessions`

**Para qué sirve:** sesiones activas emitidas al iniciar sesión.

**Columnas principales:**

- `id` (PK).
- `user_id` (FK a `users`).
- `token_hash` (`CHAR(64)`, único): SHA-256 del token; el token original nunca
  se guarda.
- `expires_at`, `created_at`, `last_seen_at`, `revoked_at`.
- Índice `(user_id, expires_at, revoked_at)`.

**Relaciones:** una sesión pertenece a un usuario.

**Razón de ser:** permitir logout real, expiración y revocación sin depender de
un JWT autocontenido. Guardar el hash y no el token evita que una lectura de la
base permita suplantar sesiones. La separación de `users` permite varias
sesiones por usuario (varios dispositivos) y cerrar una sin afectar las demás.

### `app_settings`

**Para qué sirve:** configuración puntual y banderas de estado de la aplicación.

**Columnas principales:**

- `setting_key` (`VARCHAR(100)`, PK).
- `setting_value` (`VARCHAR(500)`).
- `updated_at`.

**Relaciones:** ninguna.

**Razón de ser:** guardar estados que deben sobrevivir a reinicios y que no son
datos de negocio. Hoy se usa para `bootstrap_completed_at`, que impide volver a
ejecutar el alta inicial del superadministrador. Es una tabla clave-valor para
pocas banderas; no sustituye a las variables de entorno de infraestructura.

### `api_rate_limits`

**Para qué sirve:** limitar intentos por ventana de tiempo en endpoints
públicos, especialmente la consulta de seguimiento con código de 6 dígitos.

**Columnas principales:**

- `scope` (`VARCHAR(80)`): grupo del límite (por ejemplo, seguimiento público).
- `client_key_hash` (`CHAR(64)`): hash de IP + identificador del cliente.
- `window_started_at`, `attempts`.
- PK compuesta `(scope, client_key_hash)`.
- Índice por `window_started_at` para purgar ventanas viejas.

**Relaciones:** ninguna.

**Razón de ser:** un contador en memoria se pierde al reiniciar y no se comparte
entre instancias. Esta tabla hace que el límite sea persistente y común a todo
el proceso. Se purga periódicamente (`DELETE ... LIMIT 500`) para no crecer sin
control.

---

## 3. Auditoría

### `audit_events`

**Para qué sirve:** bitácora append-only de lo que ocurre en el sistema.

**Columnas principales:**

- `id` (PK).
- `actor_user_id` (FK a `users`, nullable): nulo si la acción la hizo el sistema
  o una migración.
- `entity` (`VARCHAR(80)`): por ejemplo `service_order`, `user`.
- `record_id` (`VARCHAR(80)`): id del registro afectado, como texto para servir
  a varias entidades.
- `action` (`VARCHAR(80)`): `CREATED`, `QUOTE_SENT`, `QUOTE_APPROVED`,
  `ORDER_DELIVERED`, `ROLE_MIGRATED_TO_SUPERADMINISTRADOR`, etc.
- `previous_data`, `new_data` (`JSON`): estado antes y después.
- `request_id`, `ip_address`, `user_agent`.
- `created_at`.
- Índices `(entity, record_id, created_at)` y `(actor_user_id, created_at)`.

**Relaciones:** el actor es opcional; el registro auditado no tiene FK porque
puede ser de cualquier entidad.

**Razón de ser:** reconstruir la historia sin crear una tabla de versiones por
cada entidad. Guardar `previous_data` y `new_data` en JSON permite auditar
cambios de estructura variable sin migraciones constantes. Es la fuente de los
reportes de actividad por asesor y de los eventos de la línea de tiempo de una
orden. En la operación normal solo se inserta; la purga controlada del lote demo
es la única excepción que elimina eventos de ese lote.

---

## 4. Catálogos

### `body_types`

**Para qué sirve:** tipos de carrocería usados en el vehículo y en el diagrama
de daños.

**Columnas principales:**

- `id` (PK).
- `code` (`VARCHAR(10)`, único): `V1`, `V2`, `V3`, `V4`.
- `name` (`VARCHAR(80)`, único).
- `active`.

**Relaciones:** `vehicles.body_type_id`; el código también se copia en
`damage_marks.body_code`.

**Razón de ser:** el formulario de recepción dibuja un esquema distinto según la
carrocería. Tenerlo como catálogo evita repetir nombres y permite desactivar un
tipo sin romper los vehículos históricos.

### `checklist_categories`

**Para qué sirve:** agrupar los ítems del checklist de recepción.

**Columnas principales:**

- `id` (PK).
- `name` (`VARCHAR(100)`, único).
- `display_order` (`SMALLINT`, único).
- `active`.

**Relaciones:** `checklist_items.category_id`.

**Razón de ser:** el checklist se muestra por secciones (exterior, interior,
accesorios, documentos). La categoría permite ordenar y agrupar sin duplicar esa
información en cada ítem.

### `checklist_items`

**Para qué sirve:** catálogo de ítems revisables en la recepción.

**Columnas principales:**

- `id` (PK).
- `category_id` (FK a `checklist_categories`).
- `name` (`VARCHAR(120)`), `display_order`, `active`.
- Único `(category_id, name)`.

**Relaciones:** `checklist_answers.item_id`.

**Razón de ser:** centraliza los 44 ítems activos. Sin este catálogo, cada
recepción tendría que copiar los nombres y no se podrían comparar respuestas
entre órdenes ni desactivar un ítem de forma controlada. Las respuestas
históricas conservan la referencia al ítem.

### `parts_providers`

**Para qué sirve:** directorio de proveedores de repuestos.

**Columnas principales:**

- `id` (PK).
- `name` (`VARCHAR(180)`, único).
- `contact_name`, `email`, `phone`.
- `brands` (`JSON`), `qualities` (`JSON`): marcas y calidades que maneja.
- `lead_time_days`, `freight_available`, `coverage`, `active`.

**Relaciones:** `order_parts.provider_id` (opcional).

**Razón de ser:** evitar reescribir los datos del proveedor en cada repuesto y
permitir filtrar por proveedor en la vista de repuestos. `brands` y `qualities`
son JSON porque son listas variables y no se consultan por separado. En
`order_parts` se copian además el nombre y los contactos usados, para que un
cambio posterior del proveedor no reescriba el historial de una compra.

### `order_status_transitions`

**Para qué sirve:** catálogo de transiciones válidas del estado de una orden.

**Columnas principales:**

- `from_status` (`VARCHAR(50)`).
- `to_status` (`VARCHAR(50)`).
- PK compuesta `(from_status, to_status)`.

**Relaciones:** la usan dos triggers de `service_orders`
(`trg_service_orders_internal_status_before_update` y
`trg_service_orders_public_status_before_update`), creados en la migración 023.

**Razón de ser:** la aplicación ya valida las transiciones, pero la base también
debe impedir saltos inválidos (por ejemplo, de `COTIZACION_PENDIENTE` a
`ENTREGADA`). Tenerlas en una tabla, y no dentro del trigger, permite cambiarlas
con una migración de datos sin reescribir el trigger.

---

## 5. Clientes y vehículos

### `clients`

**Para qué sirve:** personas o empresas dueñas de los vehículos.

**Columnas principales:**

- `id` (PK).
- `document_type` (`ENUM('DNI','RUC')`).
- `document_number` (`VARCHAR(20)`).
- `full_name` (`VARCHAR(160)`).
- `phone`, `email`.
- `created_at`, `updated_at`.
- Único `(document_type, document_number)`.

**Relaciones:** `client_vehicles.client_id`.

**Razón de ser:** evitar duplicar clientes por documento. La identidad del
cliente se guarda una vez y se reutiliza en todas sus órdenes. El nombre y los
contactos pueden corregirse; lo que se recibió originalmente queda protegido en
`reception_snapshots`.

### `vehicles`

**Para qué sirve:** vehículos físicos que ingresan al taller.

**Columnas principales:**

- `id` (PK).
- `plate` (`VARCHAR(12)`, único).
- `brand`, `model`, `manufacture_year`, `vin`, `color`, `color_type`.
- `body_type_id` (FK a `body_types`).
- `created_at`, `updated_at`.
- Único `vin`; `CHECK` de año entre 1900 y 2099.

**Relaciones:** `client_vehicles.vehicle_id`.

**Razón de ser:** un vehículo existe independientemente de quién lo lleve. La
placa y el VIN son únicos para no crear duplicados del mismo auto. Separarlo de
`clients` permite que un vehículo cambie de dueño sin perder su historial de
órdenes.

### `client_vehicles`

**Para qué sirve:** relacionar clientes con vehículos.

**Columnas principales:**

- `id` (PK).
- `client_id` (FK a `clients`).
- `vehicle_id` (FK a `vehicles`).
- Único `(client_id, vehicle_id)`.

**Relaciones:** `service_orders.client_vehicle_id`.

**Razón de ser:** modela una relación muchos-a-muchos. Un cliente puede tener
varios vehículos y un vehículo puede pasar por varios clientes con el tiempo. La
orden referencia esta asociación (`client_vehicle_id`), no un cliente y un
vehículo sueltos, para que el par sea siempre coherente.

---

## 6. Casos y recepción

### `service_orders`

**Para qué sirve:** es el caso. Representa la orden de servicio desde que se
crea hasta que se entrega o se cancela.

**Columnas principales:**

- `id` (PK).
- `order_number` (`VARCHAR(30)`): número visible `OS-AAAA-#####`.
- `public_code` (`VARCHAR(6)`): código para la consulta pública de seguimiento.
- `public_code_hash` (`CHAR(64)`, nullable): legado del esquema anterior.
- `client_vehicle_id` (FK a `client_vehicles`).
- `advisor_user_id` (FK a `users`).
- `modality` (`ENUM`): `PARTICULAR`, `PACIFICO`, `MAPFRE`, `LA_POSITIVA`,
  `RIMAC`, `QUALITAS`.
- `claim_number`, `claim_pending_reminder`, `diagnosis_pending_reminder`.
- `internal_status` y `public_status` (`ENUM` con los 7 estados del flujo).
- `version` (`INT UNSIGNED`): control de versión reservado para concurrencia.
- `created_at`.
- Índices `(internal_status, created_at)` y `(advisor_user_id, created_at)`.

**Relaciones:** es el centro del modelo. De ella dependen `receptions`,
`quote_versions`, `order_parts`, `attachments`, `order_parts_logistics`,
`order_operational_data`, `reception_snapshots`, `order_labor_verifications`,
`order_final_controls` y los eventos de `audit_events`.

**Razón de ser:** separa el caso de su recepción y de sus cotizaciones. Una
orden puede tener varias versiones de cotización, una sola recepción y varios
repuestos; meterlo todo en una tabla haría imposible versionar y auditar. Los
dos estados (`internal_status` y `public_status`) permiten que el taller vea un
detalle operativo distinto del que se publica al cliente. Los índices están
pensados para las listas paginadas por estado y por asesor, que son las
consultas más frecuentes.

### `receptions`

**Para qué sirve:** registrar el acto de recepción del vehículo.

**Columnas principales:**

- `id` (PK).
- `order_id` (FK a `service_orders`, **único**).
- `advisor_user_id` (FK a `users`).
- `mileage`, `fuel_level`, `considerations` (JSON), `observations`.
- `accepted_terms`.
- `diagnosis`, `diagnosis_legibility`, `diagnosis_review_state`.
- `signature_object_key`: clave del archivo de firma.
- `checklist_reviewed_at`.
- `created_at`.
- `CHECK` de combustible en `0, 25, 50, 75, 100`.

**Relaciones:** una recepción por orden. De ella dependen `checklist_answers`,
`damage_marks`, `attachments` (opcional) y `reception_snapshots`.

**Razón de ser:** la recepción es un acto con evidencia propia (kilometraje,
combustible, diagnóstico, firma). Mantenerla en una tabla aparte permite exigir
que exista una sola por orden, validar el checklist antes de avanzar y no
mezclar los datos del vehículo con los del caso.

### `reception_snapshots`

**Para qué sirve:** congelar los datos de cliente, vehículo, asesor, modalidad y
siniestro tal como estaban al recibir el auto.

**Columnas principales:**

- `reception_id` (PK, FK a `receptions`).
- `order_id` (FK a `service_orders`, **único**).
- `source` (`ENUM('RECEPTION','LEGACY_BASELINE')`).
- `payload` (`JSON`).
- `captured_at`.

**Relaciones:** una por recepción y una por orden.

**Razón de ser:** los datos maestros (`clients`, `vehicles`) pueden corregirse
después. La orden, en cambio, debe conservar lo que realmente se recibió. La
función `snapshotIdentityColumn` lee el snapshot cuando existe; si no, cae al
dato maestro. `LEGACY_BASELINE` marca los casos anteriores a la migración 025,
que no se pueden reconstruir con precisión; nunca se sobrescribe un snapshot.

### `damage_marks`

**Para qué sirve:** guardar cada daño dibujado sobre el diagrama del vehículo.

**Columnas principales:**

- `id` (PK).
- `reception_id` (FK a `receptions`).
- `body_code` (`ENUM('V1','V2','V3','V4')`).
- `body_view` (`ENUM('01'…'05')`): vista del diagrama.
- `path_data` (`JSON`): trazos o puntos del daño.
- `description`, `created_at`.

**Relaciones:** muchos daños por recepción.

**Razón de ser:** un auto puede tener varios daños y cada uno se dibuja en una
vista distinta. Una tabla hija permite listarlos, contarlos y auditar su
modificación sin guardar un JSON gigante en `receptions`. `path_data` es JSON
porque la forma del trazo es libre.

### `checklist_answers`

**Para qué sirve:** respuestas del checklist de recepción.

**Columnas principales:**

- `id` (PK).
- `reception_id` (FK a `receptions`).
- `item_id` (FK a `checklist_items`).
- `answer` (`ENUM('SI','NO')`).
- `observation` (`VARCHAR(300)`).
- Único `(reception_id, item_id)`.

**Relaciones:** una respuesta por ítem y recepción.

**Razón de ser:** normaliza las respuestas para poder comparar entre órdenes y
detectar ítems observados. La clave única impide responder dos veces el mismo
ítem y hace que el guardado sea idempotente. La observación vive en la respuesta
y no en el catálogo, porque depende de cada auto.

### `attachments`

**Para qué sirve:** metadatos de los archivos asociados a una orden.

**Columnas principales:**

- `id` (PK).
- `order_id` (FK a `service_orders`).
- `reception_id` (FK a `receptions`, nullable).
- `uploaded_by_user_id` (FK a `users`).
- `category` (`ENUM`): recepción, daño, evaluación manuscrita, cotización,
  control final, conformidad u otro.
- `storage_provider` (`local` o `s3`).
- `object_key`, `original_name`, `mime_type`, `byte_size`, `sha256`.
- `created_at`.
- Índices `(order_id, created_at)` y `(reception_id, created_at)`.

**Relaciones:** pertenece a una orden y, opcionalmente, a una recepción.

**Razón de ser:** el archivo binario vive en disco o en S3; la base guarda solo
la referencia y el hash. Así se puede cambiar de proveedor de almacenamiento sin
migrar la base, verificar integridad con `sha256` y listar la evidencia por
orden o por recepción sin recorrer carpetas. La categoría ordena los archivos
en la interfaz.

### `reception_drafts`

**Para qué sirve:** autoguardar el avance del formulario de recepción.

**Columnas principales:**

- `id` (PK).
- `user_id` (FK a `users`, **único**).
- `revision`, `current_step` (`0` a `6`).
- `payload` (`JSON`).
- `created_at`, `updated_at`.

**Relaciones:** un borrador por usuario.

**Razón de ser:** el formulario de recepción es largo y el usuario puede salir
antes de terminar. Guardar un borrador por usuario evita crear órdenes
incompletas y permite continuar donde quedó. No se relaciona con una orden
porque la orden todavía no existe. La `revision` permite resolver escrituras
concurrentes entre pestañas.

### `order_operational_data`

**Para qué sirve:** contactos operativos específicos de una orden.

**Columnas principales:**

- `order_id` (PK, FK a `service_orders`).
- `phone_override`, `email_override`.
- `created_at`, `updated_at`.

**Relaciones:** una fila por orden.

**Razón de ser:** durante el caso puede usarse un teléfono o correo distinto al
del cliente maestro (por ejemplo, el contacto del seguro o del taller). Guardarlo
en una tabla aparte permite que el dato operativo no contamine al cliente y que
la interfaz muestre ambas cosas: el contacto original y el operativo.

---

## 7. Cotizaciones

### `quote_versions`

**Para qué sirve:** cada versión de la cotización de una orden.

**Columnas principales:**

- `id` (PK).
- `order_id` (FK a `service_orders`).
- `version_number` (`INT`).
- `status` (`ENUM('PENDIENTE','ENVIADA','REEMPLAZADA','APROBADA')`).
- `currency` (`PEN` o `USD`), `no_parts`.
- `adjustment_reason`.
- `created_by_user_id` (FK a `users`).
- `created_at`, `sent_at`, `approved_at`.
- `sent_snapshot`, `approved_snapshot` (`JSON`).
- Único `(order_id, version_number)`.
- Índice `(order_id, status)`.

**Relaciones:** de ella dependen `quote_lines`. La orden es la dueña del
historial completo.

**Razón de ser:** una cotización enviada no se edita: se reemplaza por otra
versión. Así se conserva qué se envió, cuándo y quién lo aprobó. Los snapshots
`sent_snapshot` y `approved_snapshot` congelan el contenido y los totales en el
momento del envío/aprobación, de modo que un cambio posterior en las líneas no
reescribe la historia. `REEMPLAZADA` deja claro que la versión fue sustituida,
sin borrarla.

### `quote_lines`

**Para qué sirve:** detalle económico de una versión de cotización.

**Columnas principales:**

- `id` (PK).
- `quote_version_id` (FK a `quote_versions`).
- `line_type` (`MANO_OBRA` o `REPUESTO`).
- `labor_category` (`PLANCHADO`, `PINTURA`, `MECANICA`; solo para mano de obra).
- `description`, `quantity` (`DECIMAL(12,3)`), `unit_price` (`DECIMAL(14,2)`).
- `created_at`.
- `CHECK`: mano de obra exige categoría; repuesto no la admite.
- `CHECK`: cantidad > 0 y precio >= 0.

**Relaciones:** `order_parts.quote_line_id` y
`order_labor_verifications.quote_line_id` apuntan a estas líneas.

**Razón de ser:** separar el detalle del encabezado permite validar cada línea
por tipo, calcular totales y convertir una línea de repuesto en un repuesto a
comprar. Las restricciones `CHECK` impiden combinaciones incoherentes
(categoría en un repuesto, cantidades negativas).

### `quote_drafts`

**Para qué sirve:** borrador editable de la cotización de una orden.

**Columnas principales:**

- `id` (PK).
- `order_id` (FK a `service_orders`, **único**).
- `currency`, `no_parts`.
- `updated_by_user_id` (FK a `users`).
- `created_at`, `updated_at`.

**Relaciones:** un borrador por orden; `quote_draft_lines` cuelga de él con
`ON DELETE CASCADE`.

**Razón de ser:** el usuario puede guardar avances sin generar una versión
formal. La versión (`quote_versions`) se crea recién cuando la cotización se
guarda en firme o se envía. Así no se llena el historial de versiones con cada
cambio de precio. Al existir una sola fila por orden, el borrador siempre
representa el estado actual de la edición.

### `quote_draft_lines`

**Para qué sirve:** líneas del borrador de cotización.

**Columnas principales:**

- `id` (PK).
- `quote_draft_id` (FK a `quote_drafts`, `ON DELETE CASCADE`).
- Mismas columnas y `CHECK` que `quote_lines`.

**Relaciones:** pertenece a un borrador.

**Razón de ser:** replica la estructura de `quote_lines` para que el borrador
tenga el mismo modelo de datos que la versión final y la conversión sea directa.
El `CASCADE` evita dejar líneas huérfanas cuando se descarta el borrador.

---

## 8. Repuestos

### `order_parts`

**Para qué sirve:** seguir cada repuesto que necesita una orden aprobada.

**Columnas principales:**

- `id` (PK).
- `order_id` (FK a `service_orders`).
- `quote_line_id` (FK a `quote_lines`, **único**).
- `description`, `quantity`, `received_quantity`, `partial_received`.
- `management_status` (`POR_GESTIONAR`, `PEDIDO`, `EN_TALLER`).
- `quality` (`ORIGINAL` o `ALTERNATIVO`), `part_code`, `expected_date`.
- `provider_id` (FK opcional a `parts_providers`).
- `provider_name`, `provider_contact`, `provider_email`, `provider_phone`,
  `notes`, `updated_at`.
- Índices `(order_id)` y `(management_status, expected_date)`.
- `CHECK`: cantidad > 0 y `0 <= received_quantity <= quantity`.

**Relaciones:** nace de una línea de repuesto de una cotización aprobada.
`order_parts_logistics` complementa a la orden.

**Razón de ser:** la cotización dice qué repuesto se cobra; esta tabla dice si
ya se pidió, a qué proveedor, cuándo llega y cuánto se recibió. La clave única
sobre `quote_line_id` impide duplicar el mismo repuesto si se reprocesa una
aprobación. Los datos del proveedor se copian aquí para preservar la compra
histórica aunque el directorio de proveedores cambie después.

### `order_parts_logistics`

**Para qué sirve:** datos logísticos de los repuestos de una orden.

**Columnas principales:**

- `order_id` (PK, FK a `service_orders`).
- `freight_requested`, `freight_amount`, `freight_payment`
  (`PENDIENTE`, `PARCIAL`, `PAGADO`).
- `expansion_required`, `owner`, `notes`.

**Relaciones:** una fila por orden.

**Razón de ser:** el flete y la expansión se deciden por orden, no por repuesto.
Si se guardaran en `order_parts`, habría que repetir el mismo dato en cada línea
y se podría desincronizar. Una tabla de una fila por orden mantiene esa
información única y fácil de actualizar.

---

## 9. Cierre y entrega

### `order_labor_verifications`

**Para qué sirve:** dejar constancia de qué partidas de mano de obra fueron
verificadas antes de cerrar la orden.

**Columnas principales:**

- `order_id` (FK a `service_orders`).
- `quote_line_id` (FK a `quote_lines`).
- `verified_at`.
- `verified_by_user_id` (FK a `users`).
- PK compuesta `(order_id, quote_line_id)`.

**Relaciones:** una verificación por línea de mano de obra aprobada.

**Razón de ser:** el control final exige que la mano de obra esté verificada.
La PK compuesta hace que marcar y desmarcar sea idempotente y evita duplicados.
Separarlo de `order_final_controls` permite tener muchas líneas verificadas por
orden sin repetir los datos del cierre.

### `order_final_controls`

**Para qué sirve:** registrar el cierre, la publicación y la entrega de la
orden.

**Columnas principales:**

- `order_id` (PK, FK a `service_orders`).
- `completed_at`, `completed_by_user_id`.
- `published_at`, `published_by_user_id`, `publication_channel`,
  `publication_note`.
- `delivered_at`, `delivered_by_user_id`.
- `conformity_acknowledged_at`.

**Relaciones:** una fila por orden. Varias FK a `users` para distinguir quién
completó, publicó y entregó.

**Razón de ser:** la entrega no es un simple cambio de estado: requiere control
final, publicación y conformidad. Tener las cuatro marcas en una sola fila por
orden permite exigirlas en orden y auditar quién hizo cada paso. Es la puerta
antes de pasar a `LISTA_PARA_ENTREGA` y `ENTREGADA`.

---

## Relaciones principales en una frase

- Un **cliente** tiene varios **vehículos** a través de `client_vehicles`.
- Cada **orden** pertenece a un par cliente-vehículo y a un asesor.
- Cada orden tiene **una recepción**, que tiene **respuestas de checklist**,
  **daños** y **adjuntos**.
- Cada orden tiene **varias versiones de cotización**, cada una con **líneas**.
- Una cotización aprobada genera **repuestos** a gestionar.
- El **cierre** verifica la mano de obra y registra publicación y entrega.
- Todo lo relevante se refleja en **audit_events**.

## Notas de mantenimiento

- Las migraciones son la fuente de verdad del esquema; no se modifican archivos
  ya aplicados, se agrega uno nuevo.
- `schema_migrations` es la única tabla que no pertenece al negocio.
- La base demo comparte este esquema y se puede reconstruir con
  `npm run seed:demo:1000` sin tocar la base principal.
- Al agregar una tabla, conviene actualizar este documento y justificar por qué
  no alcanza con una tabla existente.
