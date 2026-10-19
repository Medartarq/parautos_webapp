# Revisión técnica y priorización

Fecha de revisión: 2026-10-19.

## Estado operativo actual

- Hostinger ejecuta `npm run build` con `DEPLOY_RUN_MIGRATIONS=true`: las
  migraciones se aplican durante el build, antes de publicar. La API no migra al
  iniciar, evitando indisponibilidad por una migración fallida.
- Hay 20 migraciones versionadas. La cuenta inicial es `SUPERADMINISTRADOR`;
  `ADMINISTRADOR` conserva todos los módulos excepto Usuarios y `ASESOR` el
  flujo operativo.
- La autorización HTTP de Usuarios está cubierta para los tres roles. La línea
  base actual es 58 pruebas aprobadas y 2 omitidas (las de MariaDB requieren
  credenciales temporales explícitas).

## Decisión recomendada

No conviene terminar funcionalidades sobre una base que no puede instalarse de
cero, que no aplica autorización real por rol y que puede dejar órdenes
incompletas si falla una carga de archivo. Esos defectos deben corregirse antes
de continuar con la paridad funcional, porque bloquean pruebas reproducibles y
pueden invalidar los flujos que se implementen después.

Una vez resueltos los bloqueadores, la prioridad debe ser terminar los
requerimientos pendientes en `PROTOTYPE_PARITY.md`, siguiendo su secuencia
estratégica y usando `documentos/prototipo` exclusivamente como referencia.
No se debe ampliar el alcance fuera de `app-final`.

## Checklist maestro de ejecución

**Uso:** ejecutar en orden. Una tarea sólo se marca al cumplir su criterio de
cierre y al registrar evidencia en `PROTOTYPE_PARITY.md` cuando aplique. Los
ítems de una fase bloquean el inicio de la fase siguiente, salvo los que se
  indiquen expresamente como mantenimiento continuo.

### Sincronización de recepción (Hostinger Cloud Startup)

- [x] **Base de continuidad PC↔móvil.** Implementada el 2026-10-17 mediante
  `018_reception_drafts.sql`: un borrador de recepción por usuario persiste en
  MariaDB con `revision`, `current_step` y el contenido estructurado del
  formulario. Express aplica control optimista y responde `409` si otro
  dispositivo guardó antes; no existe sobrescritura silenciosa.
- [x] **Recuperación ante desconexión de formulario.** El cliente conserva el
  último borrador estructurado en IndexedDB, indica conexión/guardado/conflicto,
  reintenta al recuperar red y revisa cambios remotos al enfocar la pestaña y
  cada 30 segundos. No requiere Redis, WebSocket ni proceso persistente, por lo
  que es compatible con Hostinger Cloud Startup.
- [x] **Validar continuidad de recepción.** Producto verificó el 2026-10-17,
  con el mismo Asesor en móvil y PC, la continuidad bidireccional, recuperación
  tras desconexión y el conflicto de revisión entre dos sesiones. El cierre y
  su evidencia están registrados en 2.1b y `PROTOTYPE_PARITY.md`.
- [ ] **Adjuntos sin conexión.** Parcialmente implementado: fotografías y
  evaluación manuscrita seleccionadas se conservan en IndexedDB del dispositivo
  de origen y se restauran tras una recarga antes de crear la orden. Pendiente:
  transferencia móvil↔PC, subida reanudable/fragmentada y almacenamiento
  persistente de producción con reintentos seguros.

### 0. Preparación y línea base

- [x] **0.1 Preservar el alcance.** Confirmado el 2026-10-17: los cambios de
  esta ejecución se limitaron a
  `app-final` y que `documentos/prototipo` se usa sólo como referencia, sin
  modificarlo.
- [x] **0.2 Crear línea base reproducible.** Verificado el 2026-10-17 con
  Node.js 24.19.0, npm 11.17.0 y MariaDB 11.8.9. `npm test` aprobó 28 pruebas;
  `npm run build` aprobó con las advertencias de tamaño ya registradas. Repetir
  estas comprobaciones antes de cada fase relevante.
- [x] **0.3 Definir datos de prueba.** Completado el 2026-10-17 en
  `DATOS_PRUEBA_MANUAL.md`: usuarios Superadministrador/Administrador/Asesor, casos semilla por
  placa/estado, comandos idempotentes de carga y datos de recepción reutilizables
  para pruebas manuales. Incluye el recorrido documentado de R-05.

### 1. Bloqueadores de despliegue e integridad (P0)

- [x] **1.1 Diseñar la corrección de migraciones duplicadas.** Completado el
  2026-10-17: las migraciones históricas 005 y 006 son ahora idempotentes
  mediante `ADD COLUMN IF NOT EXISTS`, compatible con MariaDB 11.8 y con bases
  ya actualizadas.
- [x] **1.2 Aplicar la corrección compatible.** Completado el 2026-10-17:
  `npm run migrate` finalizó correctamente sobre la base configurada. El camino
  de compatibilidad para instalaciones existentes está documentado más abajo.
- [x] **1.3 Automatizar instalación limpia.** Completado el 2026-10-17:
  `server/src/db/migrate.integration.test.ts` crea una base temporal y verifica
  las migraciones disponibles y las dos columnas antes duplicadas. Se activa sólo con
  variables `MIGRATION_TEST_DB_*` administrativas, sin guardar credenciales.
- [x] **1.4 Verificar migraciones reales.** Verificado inicialmente el
  2026-10-17 y actualizado al conjunto actual de 20 migraciones: una instalación
  limpia las aplica y `npm run migrate` sobre la base ya configurada finaliza sin
  cambios ni errores.
- [x] **1.5 Confirmar la matriz de permisos.** Completado el 2026-10-17:
  `documentos/prototipo/app.js` limita exclusivamente las rutas Reportes y
  Auditoría a Administrador; el flujo operativo (órdenes, cotizaciones,
  repuestos, control final y entrega) está disponible para ambos roles.
- [x] **Matriz aplicada — Administrador.** Puede usar todo el flujo operativo
  y, cuando se implementen, Reportes y Auditoría.
- [x] **Matriz aplicada — Asesor.** Puede usar el flujo operativo; no puede
  acceder a Reportes ni Auditoría.
- [x] **1.6 Implementar autorización de API.** Completado el 2026-10-17:
   `requireRoles` valida el usuario y sus roles; los routers operativos de
   Órdenes y Adjuntos la aplican explícitamente para Superadministrador,
   Administrador y Asesor. Usuarios usa exclusivamente
   `requireRoles("SUPERADMINISTRADOR")`.
- [x] **1.7 Cubrir autorización con pruebas.** El middleware cubre acceso
  permitido, `403` y `401`; además, las pruebas HTTP de Usuarios validan que
  sólo Superadministrador puede listar, crear o cambiar el estado de cuentas y
  que Administrador y Asesor reciben `403`.
- [x] **1.8 Asegurar consistencia de orden y archivos.** Completado el
  2026-10-17: la firma obligatoria se almacena como adjunto dentro de la misma
  transacción que crea la orden y su recepción. La evidencia y el diagnóstico
  continúan siendo opcionales, conforme al flujo actual del prototipo.
- [x] **1.9 Implementar recuperación de fallos de carga.** Completado el
  2026-10-17: el asistente conserva la orden creada y ofrece “Reintentar
  cargas” sin duplicar archivos ya confirmados. El servidor elimina el archivo
  local y revierte metadatos si falla su transacción de adjunto; también elimina
  la firma si falla la creación de la orden.
- [x] **1.10 Verificar documentos de recepción.** Verificado manualmente el
  2026-10-17: firma, evidencias y diagnóstico están vinculados, son
  recuperables y aparecen correctamente tanto en el detalle como en el
  documento A4 de recepción.

### 2. Cierre de paridad de módulos ya implementados

- [x] **2.1 Cerrar R-01.** Verificado manualmente el 2026-10-17 en escritorio
  y móvil: login, persistencia de sesión, cierre de sesión, visibilidad por rol
  y acceso operativo de Administrador y Asesor. La autorización de API está
  cubierta por las pruebas de middleware registradas en 1.7.
- [x] **2.1a Refinar recepción móvil R-04.** Aprobado visualmente el 2026-10-17:
  orden de foco coherente con la retícula de Datos; checklist por categoría con
  marcado confirmado/deshacer y observaciones bajo demanda; consideraciones con
  objetivos táctiles y separación de navegación; y jerarquía clara en
   Diagnóstico y Resumen/Firma. `npm run build` y `npm test` pasaron (34 pruebas,
   1 omitida).
- [x] **2.1b Verificar continuidad R-04 entre dispositivos.** La migración
  `018_reception_drafts.sql` y la interfaz de borrador están implementadas:
  MariaDB es la fuente de verdad, IndexedDB conserva cambios estructurados sin
  red y `revision` evita sobrescrituras silenciosas. Producto confirmó la
  validación manual móvil↔PC, desconexión/reconexión y conflicto concurrente.
  No incluye fotos ni
  evaluación manuscrita entre dispositivos; esos archivos sólo se preservan
  localmente antes de crear la orden. La captura integrada usa `getUserMedia` y
  requiere una URL HTTPS; la prueba LAN HTTP sólo puede validar galería.
  Verificación técnica realizada el 2026-10-17: migración aplicada, `npm run
  build` correcto y `npm test` con 35 pruebas aprobadas y 1 omitida.
- [x] **2.2 Cerrar R-02.** Verificado manualmente el 2026-10-17: navegación de
  todas las rutas reales en escritorio y móvil; menú móvil y sidebar compacto/
  expandido; campana, panel de pendientes y recordatorio por sesión; placas en
  Dashboard, Órdenes y Cotizaciones; y visibilidad/autorización correcta para
  Administrador y Asesor. Auditoría, Reportes y Cotizaciones sustituyeron los
  placeholders de navegación. Revisión final confirmada por producto: la barra
  móvil se oculta al desplazarse hacia abajo y reaparece al subir o cambiar de
  ruta, sin cubrir contenido.
- [x] **2.3 Verificar R-05.** Validado manualmente el 2026-10-17 con el caso
  semilla `DEM-101`: detalle y pestañas Resumen/Recepción/Cotización/Historial,
  corrección operativa con razón y evento auditado, A4 de recepción reabierto,
  recarga, nuevo inicio de sesión y persistencia en escritorio y móvil. Se
  se reabrió para comprobar en móvil estrecho la corrección de filtros y la
  reserva bajo la navegación; producto confirmó su funcionamiento correcto.
- [x] **2.4 Verificar R-06.** Se cerró por confirmación del producto el
  2026-10-17: se validaron en escritorio y móvil PDF/XLSX, borrador persistente
  y recarga, creación separada de V1/Vn, motivo de ajuste, envío, aprobación,
  historial y acceso por Cotizaciones. La migración 017 conserva el borrador
  separado de las versiones auditables; la normalización de DECIMAL cubre la
  regresión de guardado detectada inicialmente. Se reabrió para una única
  comprobación visual móvil: la bandeja de Cotizaciones fue corregida para
  presentar una tarjeta de caso legible en vez de columnas fragmentadas, y fue
  aceptada por producto.
- [x] **2.5 Verificar R-07.** Ejecutar pruebas manuales de escritorio y móvil
  para la mesa global de repuestos, filtros, proveedores, recepción individual
  y transición a reparación. El rediseño de gestión por orden fue aprobado en
  escritorio el 2026-10-17; falta la validación integral indicada. En móvil se
  corrigió la búsqueda para ocupar una fila completa y evitar el hueco/compresión
  observado junto a los filtros; producto confirmó el resultado en dispositivo
  físico.
- [x] **2.6 Verificar R-08.** Producto confirmó el flujo completo de control
  final, publicación, reapertura y entrega en escritorio y móvil.
- [x] **2.7 Verificar R-09.** Comprobar la consulta pública real, URL
  precompletada, estados terminales, mensajes de error y versión móvil. La
  consulta de escritorio fue confirmada; en desarrollo LAN móvil se añadió
  reintento directo a la API local y tiempo límite visible. Producto confirmó
  que la consulta móvil funciona correctamente.
- [x] **2.8 Registrar el Mandatory Parity Gate.** Registrado el 2026-10-17 en
  `PROTOTYPE_PARITY.md`: validaciones funcionales, persistencia, escritorio y
  móvil, roles, límite público, comandos (`npm run build`, `npm test`), datos de
  prueba y diferencias aprobadas. Resultado: **Passed**; la paridad funcional
  queda cerrada.

### 3. Funcionalidad pendiente del prototipo

- [x] **3.1 Validar documento de conformidad imprimible (R-08).** Validado
  manualmente el 2026-10-17: PDF A4 descargable desde una orden entregada, con
  cabecera institucional, margen izquierdo de 20 mm y demás márgenes de 15 mm,
  contenido textual aprobado y firma del cliente; sin asesor, gerente ni lista
  de reparaciones.
- [x] **3.2 Validar la orden de trabajo imprimible (R-10).** Validada
  manualmente el 2026-10-17: descarga, formato A4, cabecera institucional,
  datos de orden/vehículo, partidas agrupadas de mano de obra sin precios ni
  repuestos, legibilidad y continuidad coinciden con el resultado aprobado.
- [x] **3.3 Implementar auditoría inmutable (R-10).** Validada manualmente el
  2026-10-17: API y UI sólo para Administrador, con filtros de texto, usuario,
  acción y fecha; las acciones se muestran en español en el selector sin alterar
  el valor técnico filtrado, y no se exponen capacidades de modificación.
- [x] **3.4 Probar autorización y datos de auditoría.** Verificado manualmente
  el 2026-10-17: Asesor no ve ni accede a Auditoría; con Administrador, los
  resultados persistentes son filtrables por texto, usuario, acción y fecha, y
  son coherentes con los eventos guardados.
- [x] **3.5 Implementar reportes administrativos (R-10).** Completado el
  2026-10-17: dashboard administrativo con métricas, estados, modalidades,
  tendencia, embudo, carga/actividad de asesores y antigüedad; reportes de
  cotizaciones y repuestos pendientes con filtros locales, CSV y descarga PDF
  A4 institucional.
  Verificación interna: compilación aprobada; 34 pruebas aprobadas y 1 omitida;
  `GET /reports/operational` sobre MariaDB devolvió 401 sin sesión, 403 para
  Asesor y 200 para Administrador con todas las series esperadas. Los datos
  actuales validaron 10 órdenes activas, 2 cotizaciones, 1 repuesto, 2 asesores,
  2 series de antigüedad y embudo consistente de 5 creadas ≥ 4 enviadas ≥ 3
  aprobadas. La revisión visual del dashboard fue confirmada por usuario.
- [x] **3.6 Probar reportes de extremo a extremo.** Validado manualmente el
  2026-10-17: Dashboard y Reportes administrativos, en escritorio y móvil;
  filtros por estado, modalidad, fecha, búsqueda, antigüedad/urgencia, asesor y
  proveedor; etiquetas de filtros activos y limpieza; CSV y PDF A4 institucional
  con el conjunto filtrado; recarga y permisos de Administrador. La verificación
  interna complementaria confirmó 401 sin sesión, 403 para Asesor y 200 para
  Administrador, además de cálculos analíticos consistentes. Producto confirmó
  la nueva disposición móvil de filtros, fechas, resultados en tarjetas y
  navegación no superpuesta.
- [x] **3.7 Cerrar R-10.** Cerrado inicialmente el 2026-10-17: Mandatory Parity Gate
  registrado para Auditoría, Dashboard y Reportes, CSV y PDF A4 institucional.
  Se consolidaron permisos, cálculos persistidos, filtros, exportaciones y las
  validaciones manuales de escritorio/móvil. R-10 queda verificado; el cierre
  de shell R-02 se gestiona por separado. La comprobación visual móvil de 3.6
  fue aceptada por producto.

### Estado de cambios recientes (sin cierre automático)

- **Centro de pendientes operativos (2026-10-17):** API derivada de órdenes,
  campana SVG, panel desplegable, recordatorio una vez por sesión y bloque en
  Dashboard para diagnóstico pendiente de subir y cotización pendiente de crear.
  `npm test` (34 aprobadas, 1 omitida) y `npm run build` aprobaron. La
  validación posterior de R-02 y el Mandatory Parity Gate confirmaron
  escritorio/móvil, recarga y sesión.
- **Identificación por placa (2026-10-17):** se reemplazaron emojis de vehículo
  dañados por insignias estables de placa en Prioridades y Órdenes; la bandeja
  de órdenes tiene columnas explícitas y versión móvil. La validación posterior
  de R-05 y el Mandatory Parity Gate confirmaron el resultado visual.

### 4. Seguridad y almacenamiento (después de la paridad funcional)

- [x] **4.1 Resolver la configuración S3/R2.** Implementado el 2026-10-17:
  `STORAGE_PROVIDER=s3` escribe, lee y elimina objetos mediante API
  S3-compatible, conservando el proveedor por adjunto para que archivos locales
  históricos sigan siendo recuperables. Se documentaron variables para AWS S3 o
  Cloudflare R2 y se cubrieron escritura, lectura, borrado, hash y prefijo con
  pruebas unitarias. Pendiente operativo: provisionar bucket/credencial y
  ejecutar una carga real en Hostinger antes del despliegue. Alternativa local
  confirmada por soporte: `LOCAL_UPLOAD_BASE=home` y
  `LOCAL_UPLOAD_DIR=parautos-data/uploads` resuelven una carpeta privada bajo
  `$HOME`, fuera de `public_html` y `hbuilds`; requiere prueba de marcador tras
  reinicio/redeploy y copia de seguridad antes de depender de ella.
- [x] **4.2 Validar contenido de imágenes.** Implementado el 2026-10-17:
  antes de persistir un adjunto, el servidor comprueba firmas binarias JPEG,
  PNG y WebP y exige coincidencia con el MIME declarado. Se conservan los
  límites de Multer (un archivo, máximo 10 MB) y se rechazan bytes arbitrarios
  o tipos falsificados; las pruebas cubren firmas válidas y discrepancias.
- [x] **4.3 Revisar autorización por caso y adjunto.** Decisión de producto
  confirmada el 2026-10-17: el acceso operativo es global para Administrador y
  Asesor; no existe asignación exclusiva de casos. Órdenes y adjuntos exigen
  sesión autenticada y uno de ambos roles, mientras Reportes y Auditoría siguen
  restringidos a Administrador. No se aplican filtros por `advisor_user_id` para
  no alterar el flujo operativo validado. Una futura regla de asignación deberá
  convertir esta decisión en controles de pertenencia sobre cada ruta por orden,
  repuesto y adjunto.
- [x] **4.4 Endurecer tracking público.** Implementado el 2026-10-17 con
  `019_public_rate_limits.sql`: MariaDB aplica una ventana compartida de 60
  segundos y 10 intentos por IP anonimizada con SHA-256. Las solicitudes que
  exceden el límite reciben 429; se purgan filas vencidas oportunistamente sin
  Redis ni procesos persistentes. Las pruebas cubren hash, límite permitido y
  rechazo. El monitoreo inicial consiste en la tabla indexada; el monitoreo
  externo de Hostinger debe alertar sobre respuestas 429 anómalas.
- [x] **4.5 Endurecer login y bootstrap.** Implementado el 2026-10-17 sobre
  el límite persistente de MariaDB: login limita 20 intentos/IP y 5 por cuenta
  cada 60 segundos; bootstrap limita 5/IP y 3 por correo. La espera aumenta de
  forma acotada hasta 1.5 segundos, los intentos que reciben 429 quedan en
  Auditoría como `RATE_LIMITED` sin guardar credenciales, y un login/bootstrap
  correcto limpia el contador de cuenta correspondiente.
- [x] **4.6 Revisar el código público.** Evaluado el 2026-10-17. Se mantiene el
  código criptográficamente aleatorio de seis dígitos generado con
  `crypto.randomInt`, porque esa longitud visible y recuperable por el personal
  es un requisito de paridad. Aumentar su longitud rompería la constancia y usar
  sólo hash impediría mostrarlo de nuevo en el Resumen. El riesgo se mitiga con
  placa obligatoria normalizada, respuesta uniforme sin coincidencia y límite
  persistente de 10 intentos por IP cada 60 segundos. Cualquier futura migración
  a token de mayor entropía deberá rediseñar explícitamente la constancia y el
  flujo público, no sustituir silenciosamente este código.

### 5. Calidad, rendimiento y mantenimiento continuo

- [ ] **5.1 Tipar la capa de persistencia.** Reemplazar los `any` de consultas
  SQL por tipos explícitos y normalizadores de filas.
- [ ] **5.2 Separar módulos extensos.** En curso: la API cliente, el cargador
  PDF y el módulo de Reportes se separaron de `client/src/app.tsx`; Reportes se
  carga de forma diferida al abrir esa ruta. Falta dividir detalle de orden,
  cotizaciones, `client/src/full-new-order.tsx` y
  `server/src/modules/orders/service.ts`, conservando comportamiento y paridad.
- [ ] **5.3 Ampliar pruebas de integración.** En curso: se añadieron pruebas
  HTTP de Express para login y seguimiento público, que verifican 429 antes de
  comprobar credenciales/datos, creación de sesión y limpieza de la ventana de
  cuenta tras login correcto, además de normalización y proyección pública de
  tracking. También se cubrieron por HTTP los roles de Usuarios. Falta cubrir
  MariaDB real, adjuntos y el flujo completo de orden a entrega.
- [x] **5.4 Optimizar carga del cliente.** Completado: ExcelJS y las librerías
  PDF (`jspdf` y `jspdf-autotable`) se cargan bajo demanda al exportar. El
  bundle inicial JavaScript bajó de 919.76 kB a 472.50 kB sin minificar; los
  chunks pesados se descargan sólo al solicitar XLSX, PDF o abrir Reportes.
- [x] **5.5 Resolver dependencias vulnerables.** Completado: los overrides
  vigentes de `uuid@11.1.1` y `esbuild@0.28.2` dejan
  `npm audit --omit=dev --audit-level=moderate` sin vulnerabilidades. No usar
  `npm audit fix --force` para degradar ExcelJS.
- [ ] **5.6 Cierre técnico.** Ejecutar pruebas, build, auditoría de
  dependencias, pruebas manuales de paridad y actualizar documentación de
  operación/despliegue.

## Fase 0: bloqueadores previos a nuevas funcionalidades

### P0 — Migraciones instalables desde una base vacía

`database/migrations/003_reception_media.sql` ya define:

- `damage_marks.body_code`.
- `receptions.diagnosis_review_state`.

Sin embargo, `005_damage_body_type.sql` intenta volver a crear `body_code` y
`006_diagnosis_review_states.sql` intenta volver a crear
`diagnosis_review_state`. Una migración limpia se detendrá con error de columna
duplicada.

#### Compatibilidad aplicada el 2026-10-17

Las migraciones históricas `005_damage_body_type.sql` y
`006_diagnosis_review_states.sql` utilizan ahora `ADD COLUMN IF NOT EXISTS`.
Así, en una instalación nueva las columnas creadas previamente por la migración
003 no causan error; y en una base existente donde 005/006 ya estén registradas
no se vuelve a ejecutar nada. No se modificaron datos ni versiones registradas
en `schema_migrations`.

La ejecución de `npm run migrate` contra la base configurada finalizó
correctamente. También se verificó una instalación limpia en una base temporal
MariaDB 11.8.9 creada con una cuenta administrativa: en esa verificación
histórica se aplicaron 16 migraciones. El conjunto vigente contiene 20; el
esquema resultante contiene una sola columna `body_code` y una sola columna
`diagnosis_review_state`. La base temporal fue eliminada al finalizar.

Acción:

1. Diseñar una corrección compatible tanto con instalaciones nuevas como con
   bases que ya aplicaron migraciones.
2. Agregar una prueba de integración que ejecute todas las migraciones en una
   MariaDB vacía.
3. Documentar el procedimiento seguro de actualización para ambientes ya
   existentes.

### P0 — Autorización efectiva por rol

Diagnóstico histórico, resuelto: la API ahora aplica permisos por ruta. Ocultar
menús en React no es el único control; Usuarios exige Superadministrador y sus
pruebas HTTP confirman `403` para Administrador y Asesor.

Acción:

1. Definir en el contrato de paridad qué acciones son exclusivas de
   administrador, según el prototipo.
2. Implementar middleware de autorización en `server/`.
3. Aplicarlo a todas las rutas correspondientes, incluidas las futuras rutas de
   reportes y auditoría.
4. Añadir pruebas de ruta que verifiquen respuestas `403` para cada rol no
   autorizado.

### P1 — Consistencia entre la orden y sus archivos

La orden se crea antes de cargar evidencia, diagnóstico y firma. Si una carga
posterior falla, queda una orden incompleta.

Acción:

1. **Parcialmente implementado:** `reception_drafts` mantiene los datos
   estructurados de una recepción en progreso. Falta extender este mecanismo a
   fotografías y evaluación manuscrita sin conexión.
2. Permitir reintento seguro y visible de cada carga.
3. Eliminar archivos locales huérfanos cuando falle la persistencia de sus
   metadatos.
4. Confirmar que la firma, evidencia y diagnóstico requeridos por el prototipo
   quedan vinculados de forma verificable a la orden.

## Fase 1: completar la aplicación según el contrato de paridad

Después de la Fase 0, seguir el orden de
`PROTOTYPE_PARITY.md`:

1. Cerrar autorización administrativa y verificar paridad de rutas reales
   (R-01 y R-02).
2. Completar y verificar manualmente los flujos de repuestos, control final y
   seguimiento público pendientes de validación (R-07, R-08 y R-09).
3. Terminar el documento imprimible de conformidad y validar la orden de
   trabajo contra el prototipo (R-08 y R-10).
4. Implementar búsqueda inmutable de auditoría sólo para administradores.
5. Implementar reportes, filtros, CSV e impresión sólo para administradores.
6. Para cada módulo, completar el *Mandatory Parity Gate*: persistencia,
   recarga, sesión nueva, escritorio, móvil, roles y evidencia registrada en
   `PROTOTYPE_PARITY.md`.

No deben considerarse completos los módulos que aún muestran pantallas de
placeholder, en particular Reportes y Auditoría.

## Fase 2: endurecimiento y mantenimiento

Estas mejoras son importantes, pero no deben desplazar los requisitos de
paridad una vez corregidos los bloqueadores de la Fase 0.

### Archivos y almacenamiento

- `STORAGE_PROVIDER=s3` está declarado, pero el código sólo implementa
  almacenamiento local. Implementar S3/R2 o retirar temporalmente la opción.
- Validar contenido binario real de JPEG, PNG y WebP; no confiar sólo en el
  MIME type enviado por el navegador.
- Aplicar control de acceso por orden/adjunto si la regla del prototipo exige
  que un asesor no vea casos ajenos.

### Protección de endpoints públicos y de autenticación

- Aplicar limitación distribuida y persistente a seguimiento, login y
  configuración inicial; la `Map` en memoria no funciona entre instancias ni
  tras reinicios.
- Considerar ampliar el código público o guardar únicamente su hash si el
  modelo de seguimiento lo permite sin romper la paridad del prototipo.

### Calidad, pruebas y rendimiento

- Reemplazar los resultados SQL `any` por tipos explícitos.
- Separar `client/src/app.tsx`, `client/src/full-new-order.tsx` y
  `server/src/modules/orders/service.ts` por responsabilidades.
- Ampliar pruebas de integración con MariaDB y carga de archivos; las rutas de
  Usuarios ya cuentan con cobertura HTTP por rol, pero buena parte de la suite
  aún usa persistencia simulada.
- Usar importación dinámica para exportaciones PDF/XLSX y visualizadores; el
  build actual alerta por bundles mayores a 500 KB.
- Mantener los overrides de seguridad y repetir la auditoría al actualizar
  dependencias, validando antes las exportaciones XLSX.

## Verificación observada durante la revisión

- `npm test`: estado actual de referencia: 58 pruebas aprobadas y 2 omitidas.
- `npm run build`: aprobado; Vite reportó bundles grandes.
- `npm audit --omit=dev --audit-level=moderate`: sin vulnerabilidades.

Estas verificaciones no sustituyen pruebas contra MariaDB real, carga de
archivos ni verificación visual contra el prototipo.
