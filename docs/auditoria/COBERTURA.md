# Cobertura de auditoría — 25/10/2026

> **Cierre de confiabilidad del perfil ampliado:** 9 avisos corregidos automáticamente como FIXED; **0 de confiabilidad, 472 de mantenibilidad pendientes**. 151 pruebas y build aprobados. [Correcciones y evidencia](sonarqube-completo-2026-10-25/CORRECCIONES-CONFIABILIDAD.md).

> **Medición posterior con LCOV:** 147 pruebas aprobadas; cobertura Sonar combinada **24,0 %**, de líneas **29,0 %**; Vitest líneas **31,19 %**. Las diferencias corresponden al alcance y denominadores de cada herramienta. El cliente alcanza 12,22 % de líneas Vitest. [Resultados y cobertura por archivo](sonarqube-completo-2026-10-25/INFORME.md). Las notas y la matriz siguientes conservan el estado histórico anterior a esta medición.

> Verificación posterior de las correcciones de SonarQube: **147 pruebas aprobadas y 67 comprobaciones HTTP** con bases temporales. Cero hallazgos abiertos de confiabilidad y seguridad en el perfil local aplicado. Esto no constituye cobertura medida de líneas: el gate de cobertura permanece pendiente de importar LCOV. [Detalle y evidencia](sonarqube-local-2026-10-25/CORRECCIONES.md).

Complementa [INFORME.md](INFORME.md). El estado expresa el alcance comprobado y sus límites; no garantiza ausencia de defectos. «Cumple parcialmente» distingue revisión estática de ejecución real. No se calculó cobertura numérica de líneas.

## Matriz de módulos

| Módulo | Estado | Evidencia y límites |
|---|---|---|
| Configuración, arranque, workspaces | cumple parcialmente | Instalación offline, compilación y scripts de prueba; Node 24.19.0. Mínimo 22.12 declarado, no ejecutado en esa versión exacta. |
| Contratos compartidos | cumple | Compilación y contratos aditivos de snapshot; pruebas de consumidores. |
| Autenticación, sesiones y roles | cumple parcialmente | Pruebas automatizadas y recorrido HTTP con tres roles; sin pentest externo. |
| Usuarios y auditoría | cumple parcialmente | Creación/activación atómicas y rollback; pantallas comprobadas. Sin ensayo de volumen. |
| MariaDB, migraciones, setup y demo | cumple parcialmente | 23 migraciones en bases temporales, idempotencia y baseline; bases locales principal/demo actualizadas. Producción pendiente. |
| Recepción y creación de órdenes | cumple parcialmente | Validaciones, checklist duplicado, snapshot transaccional, repetición de cliente/vehículo, conflictos de borrador. |
| Detalle y correcciones operativas | cumple parcialmente | Identidad histórica preservada; corrección operativa con motivo/auditoría; detalle visual y PDF. |
| Cotización y exportaciones | cumple parcialmente | Flujo HTTP y estados terminales, interfaz de cotización. No se exportaron todas las variantes Excel/PDF. |
| Repuestos y reparación | cumple parcialmente | Transiciones y rechazo de órdenes cerradas; estado vacío visual. Sin carga masiva. |
| Control final y entrega | cumple parcialmente | Cierre y bloqueos posteriores por HTTP; detalle entregado en navegador. Cámara real pendiente. |
| Seguimiento público | cumple parcialmente | Consulta HTTP, estado entregado y validación móvil; colisión de códigos revisada, no forzada en prueba. |
| Lookups y Factiliza | cumple parcialmente | Contratos y validaciones locales; proveedor externo sin consulta con datos reales. |
| Adjuntos y almacenamiento | cumple parcialmente | Carga/descarga local e igualdad de bytes; cabeceras Unicode/CRLF. S3 remoto no verificado. |
| Panel, órdenes, reportes | cumple parcialmente | Pantallas y errores de carga visibles; consultas locales. Paginación/rendimiento pendientes de medición. |
| Asistente: datos, checklist, daños, fotos y firma | cumple parcialmente | Lógica y contratos revisados, pantalla inicial escritorio/móvil; no se recorrieron todos los pasos en dispositivo físico. |
| Borradores offline y cámara | cumple parcialmente | Aislamiento de claves por usuario y transacciones IndexedDB; ciclo de stream simulado. Dos dispositivos offline y hardware pendientes. |
| Estilos y accesibilidad | cumple parcialmente | CSS propio analizado; login antes/después idéntico; escritorio 1440 y móvil 390, menú/Escape, alertas. Sin certificación WCAG completa. |
| Plantillas y recursos gráficos | cumple parcialmente | SVG y escape de texto/fecha probados; PDF A4 renderizado e inspeccionado. Binarios inventariados por grupo, no todos comparados píxel a píxel. |
| Hostinger, proxy y operación remota | no verificable | Usuario confirma despliegue existente; esta revisión no accedió ni desplegó la versión nueva. |
| Tareas programadas externas | no aplica | No se identificó un worker/cron propio independiente en el proyecto revisado. |

## Inventario de endpoints

Extraído de las declaraciones de routers del código propio. Los prefijos se registran por módulo; el montaje y middleware se revisan en `server/src/app.ts`. El listado no implica que cada rama de cada endpoint haya sido ejecutada. El arnés de integración enumera las comprobaciones realizadas en su JSON de evidencia.

| Archivo | Router | Método | Ruta declarada |
|---|---|---|---|
| server/src/modules/attachments/routes.ts | attachmentsRouter | GET | `/orders/:orderId` |
| server/src/modules/attachments/routes.ts | attachmentsRouter | GET | `/:attachmentId/content` |
| server/src/modules/attachments/routes.ts | attachmentsRouter | POST | `/orders/:orderId` |
| server/src/modules/audit/routes.ts | auditRouter | GET | `/events` |
| server/src/modules/auth/routes.ts | authRouter | POST | `/login` |
| server/src/modules/auth/routes.ts | authRouter | POST | `/logout` |
| server/src/modules/auth/routes.ts | authRouter | GET | `/me` |
| server/src/modules/demo/routes.ts | demoRouter | GET | `/status` |
| server/src/modules/demo/routes.ts | demoRouter | POST | `/enter` |
| server/src/modules/demo/routes.ts | demoRouter | POST | `/exit` |
| server/src/modules/lookups/routes.ts | lookupsRouter | GET | `/local/client/:document` |
| server/src/modules/lookups/routes.ts | lookupsRouter | GET | `/local/vehicle/:plate` |
| server/src/modules/lookups/routes.ts | lookupsRouter | GET | `/factiliza/client/:document` |
| server/src/modules/lookups/routes.ts | lookupsRouter | GET | `/factiliza/vehicle/:plate` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/reception-catalog` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/navigation-summary` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/pending-notifications` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/reception-draft` |
| server/src/modules/orders/routes.ts | ordersRouter | PUT | `/reception-draft` |
| server/src/modules/orders/routes.ts | ordersRouter | DELETE | `/reception-draft` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/:orderId` |
| server/src/modules/orders/routes.ts | ordersRouter | PATCH | `/:orderId/claim` |
| server/src/modules/orders/routes.ts | ordersRouter | PATCH | `/:orderId/operational-data` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/:orderId/quote-draft` |
| server/src/modules/orders/routes.ts | ordersRouter | PUT | `/:orderId/quote-draft` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/quotes/from-draft` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/:orderId/quotes` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/quotes` |
| server/src/modules/orders/routes.ts | ordersRouter | PUT | `/:orderId/quotes/:quoteId` |
| server/src/modules/orders/routes.ts | ordersRouter | DELETE | `/:orderId/quotes/:quoteId` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/quotes/:quoteId/send` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/quotes/:quoteId/approve` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/parts/workbench` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/:orderId/parts` |
| server/src/modules/orders/routes.ts | ordersRouter | PATCH | `/parts/:partId` |
| server/src/modules/orders/routes.ts | ordersRouter | PUT | `/:orderId/parts/logistics` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/start-repair` |
| server/src/modules/orders/routes.ts | ordersRouter | GET | `/:orderId/final-control` |
| server/src/modules/orders/routes.ts | ordersRouter | PUT | `/:orderId/final-control/labor/:quoteLineId` |
| server/src/modules/orders/routes.ts | ordersRouter | PUT | `/:orderId/final-control/labor` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/final-control/complete` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/final-control/reopen` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/final-control/publish` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/:orderId/final-control/deliver` |
| server/src/modules/orders/routes.ts | ordersRouter | POST | `/` |
| server/src/modules/reports/routes.ts | reportsRouter | GET | `/operational` |
| server/src/modules/setup/routes.ts | setupRouter | GET | `/status` |
| server/src/modules/setup/routes.ts | setupRouter | POST | `/initial` |
| server/src/modules/tracking/routes.ts | trackingRouter | GET | `/` |
| server/src/modules/users/routes.ts | usersRouter | GET | `/` |
| server/src/modules/users/routes.ts | usersRouter | POST | `/` |
| server/src/modules/users/routes.ts | usersRouter | PATCH | `/:userId/active` |
| server/src/modules/users/routes.ts | usersRouter | DELETE | `/:userId` |

## Inventario de archivos propios

Archivos de código, configuración, migraciones y pruebas enumerados individualmente. Las pruebas se ejecutaron como suite (112 casos), no se consideran una prueba completa de cada función. Los DAO/puertos repetitivos se revisaron siguiendo servicios y transacciones; los SQL por versión, ejecutando la cadena completa y su repetición. Recursos binarios y SVG de assets se agrupan para inventario y sólo se atribuye inspección visual a las vistas/PDF indicados.

| Archivo | Grupo / método |
|---|---|
| `.env.example` | Configuración y documentación |
| `.gitignore` | Configuración y documentación |
| `.opencode/agents/solid-hostinger-refactor.md` | Configuración y documentación |
| `PROTOTYPE_PARITY.md` | Configuración y documentación |
| `README.md` | Configuración y documentación |
| `client/index.html` | Interfaz |
| `client/package.json` | Interfaz |
| `client/src/api.test.ts` | Pruebas |
| `client/src/api.ts` | Interfaz |
| `client/src/app.tsx` | Interfaz |
| `client/src/assets/login-background.webp` | Recursos visuales |
| `client/src/assets/logo_parautos.svg` | Recursos visuales |
| `client/src/assets/marcas.png` | Recursos visuales |
| `client/src/audit-view.tsx` | Interfaz |
| `client/src/body-type-suggestion.ts` | Interfaz |
| `client/src/camera-stream.test.ts` | Pruebas |
| `client/src/camera-stream.ts` | Interfaz |
| `client/src/checklist-parity.ts` | Interfaz |
| `client/src/demo-fill.ts` | Interfaz |
| `client/src/final-control.css` | Estilos |
| `client/src/final-control.tsx` | Interfaz |
| `client/src/full-new-order.css` | Estilos |
| `client/src/full-new-order.tsx` | Interfaz |
| `client/src/main.tsx` | Interfaz |
| `client/src/new-order-checklist-steps.tsx` | Interfaz |
| `client/src/new-order-damage-step.tsx` | Interfaz |
| `client/src/new-order-data-step.tsx` | Interfaz |
| `client/src/new-order-media-steps.tsx` | Interfaz |
| `client/src/new-order-summary-step.tsx` | Interfaz |
| `client/src/order-detail.tsx` | Interfaz |
| `client/src/orders.css` | Estilos |
| `client/src/parts-order-workbench.tsx` | Interfaz |
| `client/src/parts-workbench.css` | Estilos |
| `client/src/pdf-library.ts` | Interfaz |
| `client/src/public-tracking.css` | Estilos |
| `client/src/public-tracking.tsx` | Interfaz |
| `client/src/quote-editor.tsx` | Interfaz |
| `client/src/quote-export-toolbar.tsx` | Interfaz |
| `client/src/reception-detail.test.tsx` | Pruebas |
| `client/src/reception-detail.tsx` | Interfaz |
| `client/src/reception-draft-storage.test.ts` | Pruebas |
| `client/src/reception-draft-storage.ts` | Interfaz |
| `client/src/reception-print.ts` | Interfaz |
| `client/src/reception-svg-body.ts` | Interfaz |
| `client/src/reception-svg.test.ts` | Pruebas |
| `client/src/reception-svg.ts` | Interfaz |
| `client/src/reception.css` | Estilos |
| `client/src/reports-view.tsx` | Interfaz |
| `client/src/styles.css` | Estilos |
| `client/src/users-view.tsx` | Interfaz |
| `client/src/vite-env.d.ts` | Interfaz |
| `client/tsconfig.app.json` | Interfaz |
| `client/tsconfig.json` | Interfaz |
| `client/tsconfig.node.json` | Interfaz |
| `client/vite.config.ts` | Interfaz |
| `database/migrations/001_identity_and_audit.sql` | Migraciones |
| `database/migrations/002_cases_and_reception.sql` | Migraciones |
| `database/migrations/003_reception_media.sql` | Migraciones |
| `database/migrations/004_checklist_text_parity.sql` | Migraciones |
| `database/migrations/005_damage_body_type.sql` | Migraciones |
| `database/migrations/006_diagnosis_review_states.sql` | Migraciones |
| `database/migrations/007_quotes.sql` | Migraciones |
| `database/migrations/008_diagnosis_reminder.sql` | Migraciones |
| `database/migrations/009_parts_management.sql` | Migraciones |
| `database/migrations/010_backfill_approved_parts.sql` | Migraciones |
| `database/migrations/011_partial_parts_receipt.sql` | Migraciones |
| `database/migrations/012_final_control_delivery.sql` | Migraciones |
| `database/migrations/013_public_tracking_lookup.sql` | Migraciones |
| `database/migrations/014_plaintext_public_tracking_code.sql` | Migraciones |
| `database/migrations/015_remove_legacy_public_code_hash_requirement.sql` | Migraciones |
| `database/migrations/016_order_operational_data.sql` | Migraciones |
| `database/migrations/017_quote_drafts.sql` | Migraciones |
| `database/migrations/018_reception_drafts.sql` | Migraciones |
| `database/migrations/019_public_rate_limits.sql` | Migraciones |
| `database/migrations/020_superadministrator_role.sql` | Migraciones |
| `database/migrations/021_user_retention.sql` | Migraciones |
| `database/migrations/022_add_qualitas_modality.sql` | Migraciones |
| `database/migrations/025_reception_snapshots.sql` | Migraciones |
| `package-lock.json` | Configuración y documentación |
| `package.json` | Configuración y documentación |
| `scripts/audit-local.mjs` | Herramientas |
| `scripts/run-deploy-migrations.mjs` | Herramientas |
| `server/package.json` | Configuración y documentación |
| `server/src/app.ts` | Servidor / infraestructura |
| `server/src/config/env.test.ts` | Pruebas |
| `server/src/config/env.ts` | Servidor / infraestructura |
| `server/src/db/migrate-demo.ts` | Servidor / infraestructura |
| `server/src/db/migrate.integration.test.ts` | Pruebas |
| `server/src/db/migrate.ts` | Servidor / infraestructura |
| `server/src/db/pool.ts` | Servidor / infraestructura |
| `server/src/db/seed-demo-environment.ts` | Servidor / infraestructura |
| `server/src/db/seed-demo.ts` | Servidor / infraestructura |
| `server/src/db/seed-report-analytics.ts` | Servidor / infraestructura |
| `server/src/errors/app-error.ts` | Servidor / infraestructura |
| `server/src/middleware/auth.test.ts` | Pruebas |
| `server/src/middleware/auth.ts` | Servidor / infraestructura |
| `server/src/middleware/demo-context.ts` | Servidor / infraestructura |
| `server/src/middleware/error-handler.test.ts` | Pruebas |
| `server/src/middleware/error-handler.ts` | Servidor / infraestructura |
| `server/src/middleware/request-id.ts` | Servidor / infraestructura |
| `server/src/modules/attachments/attachment-repository.ts` | Servidor / attachments |
| `server/src/modules/attachments/attachment-service.test.ts` | Pruebas |
| `server/src/modules/attachments/attachment-service.ts` | Servidor / attachments |
| `server/src/modules/attachments/image-validation.test.ts` | Pruebas |
| `server/src/modules/attachments/image-validation.ts` | Servidor / attachments |
| `server/src/modules/attachments/local-storage.test.ts` | Pruebas |
| `server/src/modules/attachments/local-storage.ts` | Servidor / attachments |
| `server/src/modules/attachments/routes.integration.test.ts` | Pruebas |
| `server/src/modules/attachments/routes.ts` | Servidor / attachments |
| `server/src/modules/attachments/s3-storage.test.ts` | Pruebas |
| `server/src/modules/attachments/s3-storage.ts` | Servidor / attachments |
| `server/src/modules/attachments/storage-port.ts` | Servidor / attachments |
| `server/src/modules/attachments/storage.test.ts` | Pruebas |
| `server/src/modules/attachments/storage.ts` | Servidor / attachments |
| `server/src/modules/audit/audit-repository.ts` | Servidor / audit |
| `server/src/modules/audit/audit-writer.test.ts` | Pruebas |
| `server/src/modules/audit/audit-writer.ts` | Servidor / audit |
| `server/src/modules/audit/routes.ts` | Servidor / audit |
| `server/src/modules/audit/service.test.ts` | Pruebas |
| `server/src/modules/audit/service.ts` | Servidor / audit |
| `server/src/modules/auth/routes.integration.test.ts` | Pruebas |
| `server/src/modules/auth/routes.ts` | Servidor / auth |
| `server/src/modules/auth/security.test.ts` | Pruebas |
| `server/src/modules/auth/security.ts` | Servidor / auth |
| `server/src/modules/auth/service.test.ts` | Pruebas |
| `server/src/modules/auth/service.ts` | Servidor / auth |
| `server/src/modules/auth/session-repository.ts` | Servidor / auth |
| `server/src/modules/demo/routes.ts` | Servidor / demo |
| `server/src/modules/lookups/routes.ts` | Servidor / lookups |
| `server/src/modules/lookups/service.test.ts` | Pruebas |
| `server/src/modules/lookups/service.ts` | Servidor / lookups |
| `server/src/modules/orders/closed-orders.test.ts` | Pruebas |
| `server/src/modules/orders/final-control-completion-repository.test.ts` | Pruebas |
| `server/src/modules/orders/final-control-completion-repository.ts` | Servidor / orders |
| `server/src/modules/orders/final-control-delivery-repository.test.ts` | Pruebas |
| `server/src/modules/orders/final-control-delivery-repository.ts` | Servidor / orders |
| `server/src/modules/orders/final-control-query-repository.test.ts` | Pruebas |
| `server/src/modules/orders/final-control-query-repository.ts` | Servidor / orders |
| `server/src/modules/orders/final-control-reopen-repository.test.ts` | Pruebas |
| `server/src/modules/orders/final-control-reopen-repository.ts` | Servidor / orders |
| `server/src/modules/orders/final-control-service.ts` | Servidor / orders |
| `server/src/modules/orders/final-control.service.test.ts` | Pruebas |
| `server/src/modules/orders/labor-verification-repository.test.ts` | Pruebas |
| `server/src/modules/orders/labor-verification-repository.ts` | Servidor / orders |
| `server/src/modules/orders/operational-data.service.test.ts` | Pruebas |
| `server/src/modules/orders/order-creation.service.test.ts` | Pruebas |
| `server/src/modules/orders/order-detail-repository.ts` | Servidor / orders |
| `server/src/modules/orders/orders-list-repository.test.ts` | Pruebas |
| `server/src/modules/orders/orders-list-repository.ts` | Servidor / orders |
| `server/src/modules/orders/orders-navigation-repository.ts` | Servidor / orders |
| `server/src/modules/orders/orders-service.ts` | Servidor / orders |
| `server/src/modules/orders/parts-mutation-repository.test.ts` | Pruebas |
| `server/src/modules/orders/parts-mutation-repository.ts` | Servidor / orders |
| `server/src/modules/orders/parts-query-repository.test.ts` | Pruebas |
| `server/src/modules/orders/parts-query-repository.ts` | Servidor / orders |
| `server/src/modules/orders/parts-service.ts` | Servidor / orders |
| `server/src/modules/orders/pending-claim-repository.ts` | Servidor / orders |
| `server/src/modules/orders/pending-notifications.service.test.ts` | Pruebas |
| `server/src/modules/orders/public-code.test.ts` | Pruebas |
| `server/src/modules/orders/quote-creation-repository.test.ts` | Pruebas |
| `server/src/modules/orders/quote-creation-repository.ts` | Servidor / orders |
| `server/src/modules/orders/quote-draft-repository.test.ts` | Pruebas |
| `server/src/modules/orders/quote-draft-repository.ts` | Servidor / orders |
| `server/src/modules/orders/quote-mutation-repository.test.ts` | Pruebas |
| `server/src/modules/orders/quote-mutation-repository.ts` | Servidor / orders |
| `server/src/modules/orders/quote-query-repository.test.ts` | Pruebas |
| `server/src/modules/orders/quote-query-repository.ts` | Servidor / orders |
| `server/src/modules/orders/quote-service.ts` | Servidor / orders |
| `server/src/modules/orders/quote-transition-repository.ts` | Servidor / orders |
| `server/src/modules/orders/quotes.service.test.ts` | Pruebas |
| `server/src/modules/orders/reception-draft-repository.ts` | Servidor / orders |
| `server/src/modules/orders/reception-snapshot.ts` | Servidor / orders |
| `server/src/modules/orders/routes.ts` | Servidor / orders |
| `server/src/modules/orders/service.ts` | Servidor / orders |
| `server/src/modules/orders/validation.test.ts` | Pruebas |
| `server/src/modules/reports/routes.ts` | Servidor / reports |
| `server/src/modules/setup/routes.ts` | Servidor / setup |
| `server/src/modules/setup/service.ts` | Servidor / setup |
| `server/src/modules/tracking/rate-limit.test.ts` | Pruebas |
| `server/src/modules/tracking/rate-limit.ts` | Servidor / tracking |
| `server/src/modules/tracking/routes.integration.test.ts` | Pruebas |
| `server/src/modules/tracking/routes.ts` | Servidor / tracking |
| `server/src/modules/tracking/service.test.ts` | Pruebas |
| `server/src/modules/tracking/service.ts` | Servidor / tracking |
| `server/src/modules/users/routes.integration.test.ts` | Pruebas |
| `server/src/modules/users/routes.ts` | Servidor / users |
| `server/src/modules/users/service.test.ts` | Pruebas |
| `server/src/modules/users/service.ts` | Servidor / users |
| `server/src/server.ts` | Servidor / infraestructura |
| `server/tsconfig.json` | Configuración y documentación |
| `shared/package.json` | Contratos compartidos |
| `shared/src/index.ts` | Contratos compartidos |
| `shared/tsconfig.json` | Contratos compartidos |

Total inventariado: 193 archivos; 54 declaraciones de endpoint. Estos números son inventario, no porcentaje de cobertura.

## Evidencias funcionales y visuales

- `2026-10-25/evidencia/pruebas-finales.txt`: 103 pruebas servidor y 9 cliente, todas aprobadas.
- `2026-10-25/evidencia/integracion-local.json`: 66 comprobaciones con datos sintéticos y bases descartables.
- `2026-10-25/evidencia/migracion-local.json`: versiones y conteos agregados de las dos bases locales existentes.
- `2026-10-25/evidencia/comparacion-login.json`: comparación antes/después de login; igualdad de píxeles. No se extiende esa igualdad a todas las pantallas.
- Capturas de panel, órdenes, recepción, cotización, repuestos vacíos, control entregado, reportes, usuarios y auditoría a 1440 px.
- Capturas de login, nueva orden y validación de seguimiento a 390 px; menú responsive y cierre con Escape comprobados.
- Capturas de error de órdenes/reportes: fallo HTTP visible en lugar de carga indefinida.
- `checklist-prueba.pdf` y `checklist-prueba.png`: descarga y render de una recepción sintética A4, una página inspeccionada.
- `estilos.json`: análisis estructural del CSS propio; no sustituye la comprobación de accesibilidad con tecnologías de apoyo.

## Exclusiones explícitas

Dependencias descargadas (node_modules), .git, cachés y artefactos compilados no se auditan como código propio; se verifican instalación, compilación y dependencias. Los archivos .env se consultan sólo para operación local y no se reproducen. Los datos y adjuntos reales no se copian a evidencias. No se verificaron despliegue nuevo en Hostinger, S3 remoto, Factiliza en vivo, cámara física, impresión física, todos los formatos de exportación ni concurrencia/carga a escala de producción. El historial anterior a la baseline es irrecuperable con certeza a partir de los maestros actuales.

## Documentación y recursos complementarios

Los siguientes archivos completan el inventario: documentación de contexto, CSS independiente y recursos públicos agrupados. Los PNG se inventarían sin atribuirles inspección individual.

| Archivo | Tratamiento |
|---|---|
| `REVISION_TECNICA_Y_PRIORIZACION.md` | Contexto documental |
| `DATOS_PRUEBA_MANUAL.md` | Contexto documental |
| `final-control.css` | Análisis CSS; hoja independiente |
| `client/public/damage-assets/V1-01.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V1-02.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V1-03.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V1-04.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V1-05.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V2-01.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V2-02.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V2-03.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V2-04.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V2-05.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V3-01.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V3-02.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V3-03.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V3-04.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V3-05.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V4-01.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V4-02.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V4-03.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V4-04.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/damage-assets/V4-05.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/favicon.svg` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/reception-template/checklist.identified.svg` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/reception-template/checklist.optimized.svg` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/reception-template/checklist.svg` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/reception-template/Formato_checklist_Images/Formato_checklist_ImgID1.png` | Recurso público; plantilla utilizada o asset agrupado |
| `client/public/reception-template/Formato_checklist_Images/Formato_checklist_ImgID2.png` | Recurso público; plantilla utilizada o asset agrupado |

Adicionales: 29 archivos. El total del inventario principal más este anexo es 222 archivos.

## Reconciliación con los cambios posteriores de master

La matriz inicial cubría el checkout antiguo. Se integró además el delta `4c07f7e..9aa3c91`, sin restablecer cambios locales. Archivos adicionales: `database/migrations/023_add_order_status_triggers.sql`, `database/migrations/024_protect_role_deletion.sql`, `server/src/db/migrate.test.ts`, `server/src/middleware/order-transition-error.test.ts`; migrador, integración de migraciones, middleware de errores, app y CSS combinados con la auditoría. Snapshot renumerado a 025. Pruebas finales de reconciliación: 115 aprobadas; integración repetida: 66 comprobaciones con 25 migraciones. Perfil, nueva orden y filtro desde tarjeta verificados en navegador. Captura `nueva-orden-perfil-reconciliado.jpg`. Los respaldos `.antes/.base/.remoto/.mezcla/.conflictos` de `2026-10-25/reconciliacion/` son evidencia de la combinación y no forman parte del código ejecutable. Los marcadores de conflicto en esos respaldos no son conflictos pendientes en el producto.

## Incremento de librerías y seguridad

- Pino: `server/src/logging/technical-logger.ts` y prueba de exclusión de SQL, mensajes, causas y datos personales. Middleware `request-log.ts` con prueba HTTP de correlación y ausencia de ruta/query/body/headers. Integrado en arranque, errores y fallos de tareas de base de datos. Configuración `LOG_LEVEL`, manifiesto y lock actualizados.
- TanStack Query: `client/src/query-client.ts`, `scoped-query.tsx`, `main.tsx`, `api.ts`, panel/órdenes/cotizaciones/notificaciones en `app.tsx` y carga de diagnóstico en `reception-detail.tsx`. Pruebas de deduplicación, aislamiento, cancelación, invalidación y limpieza de sesión. Estado: cumple parcialmente; no se migraron a Query todos los módulos, ni se hizo una prueba de carga o memoria a escala.
- 123 pruebas aprobadas (108 servidor y 15 cliente), build correcto y 66 comprobaciones HTTP repetidas. Evidencia `pruebas-librerias.txt`. Principal sintética: seis órdenes; demo sintética: cero, sin contaminación visual al alternar modos. Logout vuelve al acceso. Capturas `librerias-ordenes-principal.jpg` y `librerias-demo-aislado.jpg`.
- Sharp/ClamAV no incorporados por las restricciones de ejecución indicadas por el usuario para Cloud Startup. Compatibilidad remota de la nueva versión: no verificable sin despliegue; ninguna prueba local acredita un despliegue realizado.


## Limpieza de dependencias sin uso — 25/10/2026

Se retiraron `react-router-dom` y la dependencia directa `html2canvas` de `client/package.json`, y npm actualizó el bloqueo y la instalación local (cuatro paquetes retirados del árbol instalado). `react-router` y `react-router-dom` ya no figuran como entradas de paquete en el bloqueo ni están instalados. `html2canvas` permanece como dependencia opcional transitiva de jsPDF y conserva su chunk; no se modificó el código de terceros ni se excluyeron arbitrariamente sus módulos opcionales. Se conservan las referencias históricas de auditoría como documentación, no como dependencias ejecutables.

Se inspeccionaron importaciones estáticas, dinámicas y de tipos con el parser de TypeScript: las veinte declaraciones restantes de dependencias de ejecución entre los tres workspaces tienen referencias en código propio. Los tipos y herramientas de desarrollo se conservan por su uso en TypeScript, Vite, Vitest y scripts. S3 se conserva por su adaptador opcional activo. Evidencia: `2026-10-25/evidencia/dependencias-en-uso.json`.

Verificación posterior: compilación aprobada y 123 pruebas aprobadas (108 servidor + 15 cliente, incluida MariaDB temporal). Salida: `2026-10-25/evidencia/pruebas-limpieza-dependencias.txt`. CSS conserva el hash `index-hh2fvN8w.css`; no se atribuye una reducción del bundle a paquetes que ya quedaban fuera del código ejecutado. No se añadieron pruebas que sólo reflejen el manifiesto, ni se repitió la revisión visual completa por este cambio de dependencias. Hostinger permanece sin cambios.
