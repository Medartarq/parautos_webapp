# Arquitectura y funcionamiento de PARAUTOS

> Documento técnico-funcional de referencia. Explica cómo está construida la aplicación, qué módulos existen, cómo se relacionan, qué reglas aplica y cómo se opera. No sustituye al diccionario de datos ni al manual de usuario.
>
> Línea base verificada: rama `master`, commit `e93584e`, 28 de octubre de 2026.
>
> Este documento describe únicamente comportamiento observable en el código y en la base de datos. No documenta tarifas, contratos, márgenes ni condiciones comerciales.

## Índice

1. [Ficha del documento](#1-ficha-del-documento)
2. [Visión general y modelo de negocio](#2-visión-general-y-modelo-de-negocio)
3. [Arquitectura del sistema](#3-arquitectura-del-sistema)
4. [Stack tecnológico y librerías](#4-stack-tecnológico-y-librerías)
5. [Estructura del repositorio](#5-estructura-del-repositorio)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Backend y API](#7-backend-y-api)
8. [Frontend](#8-frontend)
9. [Flujos y máquinas de estado](#9-flujos-y-máquinas-de-estado)
10. [Validaciones y reglas de negocio](#10-validaciones-y-reglas-de-negocio)
11. [Seguridad, privacidad y auditoría](#11-seguridad-privacidad-y-auditoría)
12. [Operación y despliegue](#12-operación-y-despliegue)
13. [Pruebas](#13-pruebas)
14. [Mantenimiento, limitaciones y apéndices](#14-mantenimiento-limitaciones-y-apéndices)

---

## 1. Ficha del documento

### 1.1 Propósito

Este documento permite a una persona nueva en el proyecto:

- Entender qué problema resuelve PARAUTOS y cómo se organiza el negocio que modela.
- Ubicar rápidamente cada responsabilidad en el repositorio.
- Comprender el recorrido completo de una orden, desde la recepción hasta la entrega.
- Consultar el contrato de la API, los roles, las validaciones y los estados.
- Operar, desplegar y mantener la aplicación sin depender del conocimiento tácito de una sola persona.

### 1.2 Alcance

Incluye:

- Arquitectura lógica y de despliegue.
- Módulos del backend y del frontend.
- Catálogo completo de endpoints bajo `/api/v1`.
- Matriz de permisos por rol.
- Máquinas de estado interna, pública, de cotización, repuestos y control final.
- Validaciones de entrada y reglas de negocio.
- Seguridad, auditoría, demo y operación.
- Pruebas y criterios de mantenimiento.

No incluye:

- El detalle columna a columna de cada tabla. Para eso existe [DICCIONARIO_BASE_DE_DATOS.md](./DICCIONARIO_BASE_DE_DATOS.md).
- Procedimientos comerciales, precios, contratos, seguros, acuerdos con aseguradoras o márgenes.
- Manuales paso a paso para el usuario final.
- Infraestructura específica de Hostinger más allá de lo que el repositorio configura.

### 1.3 Documentos relacionados

| Documento | Uso |
|---|---|
| [DICCIONARIO_BASE_DE_DATOS.md](./DICCIONARIO_BASE_DE_DATOS.md) | Diccionario de las 31 tablas, columnas, índices y relaciones. |
| [CARGA_Y_CONTROL_DE_CASOS.md](./CARGA_Y_CONTROL_DE_CASOS.md) | Carga de 1,000 casos demo, paginación, filtros y operación del lote. |
| [PAGINACION.md](./PAGINACION.md) | Detalle del modelo de paginación y filtros. |
| [auditoria/INFORME.md](./auditoria/INFORME.md) | Informe de auditoría técnica y hallazgos resueltos. |
| [auditoria/LIBRERIAS_Y_SEGURIDAD.md](./auditoria/LIBRERIAS_Y_SEGURIDAD.md) | Análisis de librerías, eficiencia y protección de información. |
| [../README.md](../README.md) | Requisitos, desarrollo local, roles y despliegue. |

### 1.4 Convenciones

- **SA**: `SUPERADMINISTRADOR`.
- **ADM**: `ADMINISTRADOR`.
- **ASE**: `ASESOR`.
- **Operación**: cualquiera de los tres roles anteriores.
- **Admin**: SA o ADM.
- **Super**: únicamente SA.
- Las rutas de código se muestran como rutas relativas a la raíz del repositorio.
- Los estados se muestran con su código interno real, por ejemplo `ESPERA_REPUESTOS`.
- Los importes se describen como datos de cotización; no se incluyen valores concretos.
- “Orden” equivale a “caso de servicio” u “orden de servicio”.

---

## 2. Visión general y modelo de negocio

### 2.1 Qué es PARAUTOS

PARAUTOS es un sistema de gestión operativa para un taller de reparación automotriz. Su unidad central es la **orden de servicio**: un vehículo ingresa al taller, se documenta su estado, se diagnostica, se cotiza, se aprueba, se gestionan repuestos, se repara, se controla y se entrega.

La aplicación cubre el ciclo completo del caso y conserva evidencia de cada paso. El sistema no es un ERP general ni una plataforma de venta de vehículos: está especializado en la operación de recepción, cotización, repuestos, reparación y entrega.

### 2.2 Actores

| Actor | Relación con el sistema |
|---|---|
| Cliente particular | Persona natural que entrega un vehículo sin asociarlo a una aseguradora. |
| Cliente de aseguradora | Caso vinculado a una compañía; se registra número de siniestro o se deja recordatorio pendiente. |
| Asesor de servicio | Crea la orden, documenta la recepción, cotiza, gestiona repuestos y ejecuta el control final. |
| Administrador | Opera los mismos módulos y además consulta reportes y auditoría. |
| Superadministrador | Administra usuarios, habilita el modo demo y conserva todas las capacidades del administrador. |
| Cliente final del taller | Consulta el avance mediante placa y código de seis dígitos, sin iniciar sesión. |

No existe un portal de cliente autenticado, una cuenta de aseguradora ni un usuario de proveedor. Los proveedores de repuestos son datos de la orden, no usuarios del sistema.

### 2.3 Modalidades de atención

La modalidad se almacena en la orden y determina si el caso requiere siniestro:

- `PARTICULAR`
- `PACIFICO`
- `MAPFRE`
- `LA_POSITIVA`
- `RIMAC`
- `QUALITAS`

Las cinco últimas representan compañías de seguros y exigen **número de siniestro** o **recordatorio de siniestro pendiente**, pero nunca ambos. La modalidad particular no admite siniestro.

No existe integración con las aseguradoras. El número de siniestro se registra manualmente y puede completarse después de la recepción mediante una acción específica.

### 2.4 Cadena de valor operativa

```text
Recepción y evidencia
        |
        v
Diagnóstico y cotización
        |
        v
Aprobación del cliente
        |
        +---- sin repuestos ----+
        |                       |
        +---- con repuestos ----+--> Gestión y recepción de repuestos
                                        |
                                        v
                                  Reparación
                                        |
                                        v
                                  Control final
                                        |
                                        v
                             Publicación de "lista para entrega"
                                        |
                                        v
                                   Entrega
```

Cada etapa deja rastro en la orden, en el historial de auditoría y, cuando corresponde, en documentos PDF generados desde el navegador.

### 2.5 Capacidades funcionales observables

- Registro de clientes y vehículos con reutilización por documento y placa.
- Recepción con checklist de 44 ítems, consideraciones, daños marcados sobre diagramas, evidencias fotográficas y firma del cliente.
- Consulta de datos locales y consulta externa opcional de DNI, RUC y placa.
- Cotizaciones versionadas, con moneda PEN/USD, partidas de mano de obra por categoría y repuestos.
- Aprobación de cotización y creación automática de repuestos.
- Gestión de proveedores, calidad, código de repuesto, fecha estimada, recepción y logística.
- Control final con verificación de toda la mano de obra y de todos los repuestos.
- Publicación de “lista para entrega”, entrega con conformidad y reapertura del control.
- Seguimiento público por placa y código de seis dígitos.
- Reportes operativos, embudo de cotizaciones, antigüedad, carga por asesor y exportaciones.
- Auditoría de acciones y administración de usuarios.
- Edición de cuentas, cambio de contraseña propio y restablecimiento por superadministrador.
- Modo demostración aislado con base de datos y almacenamiento propios.

### 2.6 Qué no modela el sistema

No se observan en el código:

- Cobros, pasarelas de pago o conciliación financiera.
- Facturación electrónica o comprobantes tributarios.
- Inventario maestro, stock, compras o almacenes.
- Contabilidad, centros de costo o presupuestos.
- Integración directa con aseguradoras, RENIEC, SUNAT o Factiliza como dependencia obligatoria.
- Notificaciones automáticas por correo, SMS o WhatsApp.
- Firma digital certificada; la firma es una imagen PNG.
- Sucursales múltiples o aislamiento de datos por taller.
- Portal de proveedores.

Los campos de logística de repuestos (`freightRequested`, `freightAmount`, `freightPayment`) describen coordinación operativa; no constituyen un módulo de pagos.

### 2.7 Principios de diseño observables

1. **Monolito modular**: una sola aplicación Express sirve la API y el build de React.
2. **Servidor como fuente de verdad**: la base de datos y las reglas del backend prevalecen sobre el estado del navegador.
3. **Contratos compartidos**: los esquemas Zod y los tipos viven en `shared` para reducir divergencias entre cliente y servidor.
4. **Trazabilidad**: las operaciones relevantes escriben en `audit_events` y conservan snapshots.
5. **Inmutabilidad de la recepción**: la evidencia original no se reescribe; las correcciones operativas se registran aparte.
6. **Aislamiento demo**: el modo demo usa una base y una carpeta de archivos distintas, sin mezclar datos reales.
7. **Operación síncrona**: no hay colas, workers ni procesos en segundo plano para el flujo normal.

---

## 3. Arquitectura del sistema

### 3.1 Estilo arquitectónico

La aplicación es un **monolito modular** con tres artefactos principales:

- `client`: aplicación React que compila a archivos estáticos.
- `server`: API REST en Express y, en producción, servidor de los archivos estáticos del cliente.
- `shared`: contratos Zod, tipos TypeScript y funciones de normalización usadas por ambos.

En producción, cliente y API comparten el mismo origen. En desarrollo, Vite sirve el cliente en `http://localhost:5173` y redirige `/api` al servidor Express en `http://127.0.0.1:3000`.

### 3.2 Vista de tiempo de ejecución

```text
+---------------------------+
| Navegador                 |
| React + TanStack Query    |
| PDF/Excel en el cliente   |
+-------------+-------------+
              | HTTPS, cookie parautos_session
              v
+---------------------------+
| Hostinger / reverse proxy |
+-------------+-------------+
              |
              v
+---------------------------+
| Node.js 22 + Express 5    |
| - API /api/v1             |
| - estáticos client/dist   |
| - cookie y RBAC           |
+------+------+------+------+
       |      |      |
       |      |      +----------------------+
       |      |                             |
       v      v                             v
+-----------+  +-------------------+  +------------------+
| MariaDB   |  | MariaDB demo      |  | Archivos         |
| producción|  | parautos_demo     |  | local privado    |
|           |  |                   |  | o S3/R2          |
+-----------+  +-------------------+  +------------------+
       |
       +------------------> Factiliza (opcional, consulta externa)
```

No hay caché distribuida, bus de eventos, WebSocket ni cola de trabajos. Las consultas se resuelven contra MariaDB en cada solicitud; el cliente mantiene una caché en memoria mediante TanStack Query.

### 3.3 Pipeline de una solicitud

```text
HTTP request
   |
   v
trust proxy 1
   |
helmet (cabeceras de seguridad)
   |
cors (APP_ORIGIN, credenciales)
   |
requestId (UUID + X-Request-Id)
   |
request log (método, estado, duración)
   |
express.json (límite 1 MB)
   |
demoContext (si aplica)
   |
requireAuthentication
   |
requireRoles
   |
validación Zod / parámetros
   |
servicio de dominio
   |
repositorio
   |
pool MariaDB activo (producción o demo)
   |
respuesta JSON o 204
   |
errorHandler (formato uniforme)
```

Los endpoints públicos (`setup`, `auth`, `tracking`, `health`) no pasan por autenticación. `demoContext` se aplica a los módulos operativos para decidir si la solicitud usa la base demo.

### 3.4 Topología de despliegue

```text
Build de despliegue
   |
   +--> shared/dist
   +--> server/dist
   +--> client/dist
   |
   v
Hostinger publica una nueva versión
   |
   +--> npm run build
   |      |
   |      +--> build:app (shared + server + client)
   |      +--> migrate (si DEPLOY_RUN_MIGRATIONS=true)
   |      +--> migrate demo (si DEMO_MODE_ENABLED=true)
   |      +--> seed demo base
   |      +--> purga/recarga demo (según variables)
   |
   v
Express sirve client/dist y /api/v1
```

El servidor no ejecuta migraciones al arrancar. Las migraciones se aplican durante el build de despliegue, antes de publicar la nueva versión. Si el build falla, Hostinger conserva la versión anterior; las migraciones ya aplicadas no se revierten automáticamente.

### 3.5 Decisiones arquitectónicas

| Decisión | Consecuencia |
|---|---|
| Un solo origen para UI y API | Cookies `SameSite=Lax`, CORS simple y despliegue único. |
| Sin ORM | SQL explícito y parametrizado; mayor control y mayor responsabilidad de mantenimiento. |
| Zod en `shared` | Mismos contratos en cliente y servidor; los errores de validación se unifican en la API. |
| MariaDB separada para demo | Los datos ficticios no contaminan producción. |
| `AsyncLocalStorage` para el ámbito demo | Los repositorios resuelven el pool correcto sin pasar el ámbito por cada función. |
| Snapshots de recepción y cotización | La evidencia histórica no depende de cambios posteriores en maestros. |
| PDF y Excel en el navegador | El servidor no almacena documentos generados ni depende de librerías nativas. |
| Sin React Router | Navegación interna por estado; solo `/seguimiento` tiene una ruta directa. |
| Sin polling | Actualización por foco de ventana, invalidación tras mutaciones y `staleTime` de 15 segundos. |

### 3.6 Aislamiento del modo demo

```text
Sesión de producción
   |
   v
Cookie parautos_session válida
   |
   +--> ¿Cookie demo activa y usuario SUPERADMINISTRADOR?
          |
          +-- no --> pool producción
          |
          +-- sí --> runWithDatabaseScope("demo")
                       |
                       +--> pool parautos_demo
                       +--> carpeta demo de uploads
                       +--> superadministrador replicado en demo
```

Las sesiones siguen viviendo en la base de producción. El superadministrador se replica en la base demo para satisfacer claves foráneas. La cookie demo dura 8 horas y no concede permisos por sí sola: el middleware exige una sesión válida de superadministrador.

### 3.7 Características no funcionales observables

- **Sincronía**: las mutaciones esperan la confirmación de MariaDB.
- **Consistencia**: las operaciones críticas usan transacciones y bloqueos `FOR UPDATE`.
- **Idempotencia parcial**: los upserts de cliente, vehículo, vínculo y logística evitan duplicados; la creación de órdenes no es idempotente.
- **Escalabilidad**: pensada para un solo taller y un solo nodo de aplicación; no hay coordinación distribuida.
- **Disponibilidad**: depende de MariaDB, del proxy y del almacenamiento de archivos.
- **Trazabilidad**: request ID por solicitud y auditoría de negocio.

---

## 4. Stack tecnológico y librerías

### 4.1 Plataforma

| Componente | Requisito o versión observada |
|---|---|
| Node.js | 22.12 o superior. |
| MariaDB | 11.8.9 o compatible. |
| Workspaces | npm workspaces (`shared`, `server`, `client`). |
| Lenguaje | TypeScript 5.7–7.0 según workspace. |
| Módulos | ESM (`"type": "module"`). |
| Sistema operativo | Desarrollo en Windows/macOS/Linux; despliegue Linux en Hostinger. |

### 4.2 Librerías del backend

| Librería | Uso |
|---|---|
| `express` 5.x | Servidor HTTP, router, middleware y archivos estáticos. |
| `zod` 4.x | Validación de cuerpos, parámetros y entorno. |
| `mariadb` 3.x | Pool y consultas a MariaDB. |
| `argon2` | Hash de contraseñas con Argon2id. |
| `helmet` 8.x | Cabeceras HTTP de seguridad. |
| `cors` 2.8.x | CORS restringido a `APP_ORIGIN`. |
| `multer` 2.x | Carga multipart en memoria, máximo una imagen por solicitud. |
| `@aws-sdk/client-s3` 3.x | Almacenamiento S3 o compatible con R2. |
| `pino` 10.x | Logs técnicos estructurados. |
| `dotenv` | Carga de `.env` en desarrollo y scripts. |

### 4.3 Librerías del frontend

| Librería | Uso |
|---|---|
| `react` 19.x / `react-dom` 19.x | Interfaz. |
| `@tanstack/react-query` 5.x | Caché de consultas, invalidación y estados de carga. |
| `exceljs` 4.x | Exportación XLSX de cotizaciones. |
| `jspdf` 4.x | Generación de PDF en el navegador. |
| `jspdf-autotable` 5.x | Tablas en PDF. |
| `svg2pdf.js` 2.x | Conversión de diagramas SVG a PDF. |
| `vite` 8.x | Servidor de desarrollo y build. |
| `vitest` 5.x | Pruebas unitarias y de componentes. |

### 4.4 Tecnologías ausentes deliberadamente

- No hay ORM (Prisma, TypeORM, Sequelize).
- No hay React Router.
- No hay framework de UI (Material UI, Ant Design, Tailwind).
- No hay Redux ni Zustand.
- No hay WebSocket ni Server-Sent Events.
- No hay Redis, RabbitMQ, BullMQ ni workers.
- No hay servicio de correo o SMS.
- No hay generación de PDF en el servidor.
- No hay pipeline CI versionado en `.github`.

### 4.5 Notas de compatibilidad

- `shared` debe compilarse antes de que el servidor o el cliente lo consuman; el script raíz lo hace en `predev` y `build`.
- El cliente usa el proxy de Vite para `/api` en desarrollo.
- El servidor usa `timezone: "Z"` y `bigIntAsNumber: true` en el pool MariaDB.
- Las fechas de negocio se manejan en UTC en la base y se formatean en la zona del navegador.
- Los documentos PDF dependen de recursos del navegador; no se generan durante el build ni en el servidor.

---

## 5. Estructura del repositorio

### 5.1 Árbol resumido

```text
app-final/
├─ client/                      Aplicación React y hojas de estilo
│  ├─ src/
│  │  ├─ app.tsx                Shell, login, panel, órdenes, cotizaciones y repuestos globales
│  │  ├─ full-new-order.tsx     Wizard de recepción y creación de orden
│  │  ├─ order-detail.tsx       Detalle de orden por pestañas
│  │  ├─ quote-editor.tsx       Borrador, versiones y acciones de cotización
│  │  ├─ parts-order-workbench.tsx
│  │  ├─ final-control.tsx
│  │  ├─ reports-view.tsx
│  │  ├─ report-lists.tsx
│  │  ├─ audit-view.tsx
│  │  ├─ users-view.tsx
│  │  ├─ public-tracking.tsx
│  │  ├─ reception-print.ts
│  │  ├─ quote-export-toolbar.tsx
│  │  ├─ api.ts
│  │  ├─ query-client.ts
│  │  ├─ scoped-query.tsx
│  │  ├─ styles.css             Estilos importados por main.tsx
│  │  └─ styles.less            Hoja LESS de organización (no importada por main.tsx)
│  └─ dist/                     Build de producción
├─ server/
│  ├─ src/
│  │  ├─ app.ts                 Composición de middleware y rutas
│  │  ├─ server.ts              Arranque del proceso
│  │  ├─ config/env.ts          Validación de variables de entorno
│  │  ├─ db/                    Pool, migraciones y seeds
│  │  ├─ middleware/            Auth, demo, request ID, logs, errores
│  │  └─ modules/               Módulos de dominio
│  └─ dist/                     Build del servidor
├─ shared/
│  └─ src/index.ts              Esquemas Zod, normalizaciones y tipos
├─ database/
│  └─ migrations/               25 migraciones SQL
├─ scripts/
│  ├─ run-deploy-migrations.mjs
│  └─ audit-local.mjs
├─ docs/
├─ data/                        Uploads locales de desarrollo
├─ .env.example
└─ package.json
```

### 5.2 Responsabilidad de cada workspace

| Workspace | Responsabilidad | No debe contener |
|---|---|---|
| `shared` | Contratos de entrada, tipos, normalización de placa, nombre, documento y correo. | Acceso a base de datos, componentes React, secretos. |
| `server` | Reglas de negocio, persistencia, autenticación, archivos, auditoría, migraciones y seeds. | Lógica de presentación. |
| `client` | Presentación, navegación, caché de consultas, generación de documentos y captura de evidencia. | Reglas críticas que deban sobrevivir a un cliente malicioso. |

### 5.3 Módulos del backend

```text
server/src/modules/
├─ setup/        Configuración inicial y creación del primer superadministrador
├─ auth/         Login, sesión, cookie, rate limit y verificación de contraseña
├─ demo/         Entrada, salida y estado del modo demo
├─ tracking/     Consulta pública por placa y código
├─ lookups/      Consulta local y Factiliza de cliente/vehículo
├─ orders/       Recepción, cotización, repuestos, control final y entrega
├─ attachments/  Carga, lectura y almacenamiento de imágenes
├─ reports/      Reportes operativos y exportación de filas
├─ audit/        Consulta de eventos
└─ users/        Cuentas, edición, contraseña y retención
```

`orders` es el módulo más grande y concentra el flujo principal. Está dividido en servicios y repositorios especializados para evitar un único archivo monolítico.

### 5.4 Artefactos de build

| Artefacto | Script | Salida |
|---|---|---|
| Contratos compartidos | `npm run build --workspace @parautos/shared` | `shared/dist` |
| Servidor | `npm run build --workspace @parautos/server` | `server/dist` |
| Cliente | `npm run build --workspace @parautos/client` | `client/dist` |
| Build completo | `npm run build:app` | Los tres anteriores |
| Build de despliegue | `npm run build` | Build completo + migraciones y demo según variables |

### 5.5 Criterios de organización

- Cada módulo expone rutas, servicio y repositorio.
- Los repositorios contienen SQL y transacciones; los servicios contienen reglas y orquestación.
- Las rutas validan forma y permisos, y delegan el negocio.
- Los errores de negocio usan `AppError` con código estable.
- Las pruebas viven junto al módulo o en archivos `*.test.ts` / `*.test.tsx`.
- La documentación de datos vive en `docs`, no en comentarios dispersos.

---

## 6. Modelo de datos

### 6.1 Motor y convenciones

- Motor: MariaDB 11.8.9 o compatible.
- Esquema: InnoDB, `utf8mb4`.
- Fechas técnicas: UTC; el pool usa `timezone: "Z"`.
- Identificadores: enteros sin signo autoincrementales.
- Importes: `DECIMAL`; la API los convierte a número.
- Tablas: 31, incluida `schema_migrations`.
- Vistas SQL: ninguna.
- Migraciones: 25 archivos en `database/migrations`.
- Triggers: 3 (dos de validación de estados de orden y uno de protección de roles).
- Borrado de órdenes: no existe endpoint; los casos se conservan.

El detalle de columnas, tipos, índices y claves está en [DICCIONARIO_BASE_DE_DATOS.md](./DICCIONARIO_BASE_DE_DATOS.md). Aquí se explica el modelo conceptual y las relaciones que gobiernan la operación.

### 6.2 Agrupación conceptual

| Grupo | Tablas | Función |
|---|---|---|
| Seguridad y configuración | `roles`, `users`, `sessions`, `api_rate_limits`, `app_settings` | Roles, cuentas, sesiones, límites y ajustes. |
| Catálogos | `body_types`, `checklist_categories`, `checklist_items`, `parts_providers` | Carrocerías, checklist y proveedores. |
| Cliente y vehículo | `clients`, `vehicles`, `client_vehicles` | Maestros reutilizables y vínculo cliente-vehículo. |
| Caso y recepción | `service_orders`, `receptions`, `reception_snapshots`, `reception_drafts`, `order_operational_data`, `order_status_transitions` | Orden, recepción, snapshot, borrador, correcciones y transiciones válidas. |
| Checklist y daños | `checklist_answers`, `damage_marks` | Respuestas y marcas sobre diagramas. |
| Cotización | `quote_versions`, `quote_lines`, `quote_drafts`, `quote_draft_lines` | Versiones, partidas y borrador editable. |
| Repuestos | `order_parts`, `order_parts_logistics` | Repuestos por orden y logística. |
| Control final | `order_labor_verifications`, `order_final_controls` | Verificación de mano de obra y cierre/entrega. |
| Evidencias | `attachments` | Metadatos y ubicación de archivos. |
| Auditoría | `audit_events` | Trazabilidad de acciones. |
| Migraciones | `schema_migrations` | Versiones aplicadas. |

### 6.3 Relaciones principales

```text
clients 1 ----- N client_vehicles N ----- 1 vehicles
                         |
                         | 1
                         v
                    service_orders
                    /      |       \
                  1/      1|       1\
                 v         v         v
          receptions   order_parts  order_final_controls
             |  \          |
             |   \         +-- order_parts_logistics
             |    \
             |     +--> checklist_answers
             |     +--> damage_marks
             |     +--> attachments
             |
             +--> reception_snapshots

service_orders 1 ----- N quote_versions 1 ----- N quote_lines
service_orders 1 ----- 1 quote_drafts 1 ----- N quote_draft_lines
service_orders 1 ----- N order_labor_verifications
service_orders 1 ----- N audit_events (por entidad y record_id)
```

### 6.4 Entidades centrales

**`service_orders`** es el eje. Guarda número de orden, código público, vínculo cliente-vehículo, asesor, modalidad, siniestro y los dos estados:

- `internal_status`: estado operativo interno.
- `public_status`: estado visible en el seguimiento público.

Ambos estados se validan con triggers contra `order_status_transitions`.

**`receptions`** conserva los datos de recepción: kilometraje, combustible, consideraciones, diagnóstico, legibilidad, revisión y aceptación de términos.

**`reception_snapshots`** conserva una copia de la identidad del cliente y del vehículo al momento de la recepción. Su origen puede ser `RECEPTION` o `LEGACY_BASELINE`. Las consultas de listados y detalle priorizan el snapshot sobre los maestros mutables, de modo que un cambio posterior en `clients` o `vehicles` no altera el caso histórico.

**`quote_versions`** contiene versiones numeradas. Cada versión puede estar `PENDIENTE`, `ENVIADA`, `APROBADA` o `REEMPLAZADA`. Las versiones enviadas y aprobadas guardan un snapshot JSON con líneas, moneda, total e IGV.

**`order_parts`** nace al aprobar una cotización con repuestos. Copia la descripción y cantidad de la línea de cotización y conserva datos de proveedor, costo operativo, estado de gestión y recepción.

**`order_final_controls`** registra cuándo se completó el control, cuándo se publicó y cuándo se entregó, además de la conformidad del cliente.

### 6.5 Integridad y transacciones

- Las operaciones críticas abren transacción y usan `SELECT ... FOR UPDATE`.
- La creación de orden, la creación/transición de cotización, la recepción de repuestos, el control final y la entrega son transaccionales.
- La auditoría de negocio se escribe, en la mayoría de los casos, dentro de la misma transacción.
- Los triggers de estado rechazan transiciones no registradas en `order_status_transitions`.
- El trigger de roles impide borrar un rol en uso.
- Los archivos se guardan antes de confirmar la transacción; si la transacción falla, se intenta borrar el archivo almacenado.
- La creación de la orden almacena la firma como adjunto y, si la transacción falla, elimina el archivo.

### 6.6 Snapshots e historia

Se conservan snapshots en tres lugares:

1. **Recepción**: identidad del cliente, vehículo, modalidad, siniestro y asesor.
2. **Cotización enviada**: líneas, moneda, total, IGV y número de versión.
3. **Cotización aprobada**: mismo contenido, en el momento de la aprobación.

Esto permite reconstruir qué se recibió y qué se cotizó aunque luego cambien los maestros o se cree una nueva versión. La recepción original no se edita; las correcciones de teléfono, correo, modalidad o siniestro se guardan en `order_operational_data` y en la orden, con motivo y auditoría.

### 6.7 Búsqueda y paginación

- Los listados usan `LIKE ?` por columna, con el término envuelto en `%...%`; no hay índice de texto completo.
- Órdenes y cotizaciones buscan en orden, placa, cliente, marca y modelo. Repuestos añaden descripción, código, siniestro y proveedor.
- El comodín inicial de `LIKE` puede impedir el uso de índices ordinarios; la base demo permite validar el volumen.
- La paginación se resuelve con `COUNT(*)` y `LIMIT/OFFSET`.
- El tamaño de página permitido es 10, 20 o 30.
- Si la página solicitada excede el total, el servidor la ajusta a la última página.
- Los conteos del dashboard son globales; el total paginado responde a los filtros.
- Las exportaciones de reportes ejecutan una sola consulta sin paginación sobre el conjunto filtrado.

### 6.8 Decimales y compatibilidad

- MariaDB devuelve `DECIMAL` como cadena; los servicios convierten cantidades, precios y totales a número.
- `price` y `unit_price` usan dos decimales; las cantidades de cotización se redondean a tres decimales en el cliente.
- `service_orders.version` existe, pero no participa en la lógica actual de bloqueo optimista.
- `order_parts.partial_received` es legado; la API expone `partialReceived` y `partiallyReceived` en `false`. La recepción parcial se determina comparando `receivedQuantity` con `quantity`.

### 6.9 Datos demo

La base demo replica el esquema de producción y se llena con:

- Cuatro casos base `DEM-101`, `DEM-202`, `DEM-303` y `DEM-404`.
- Un lote opcional de 1,000 órdenes con placas `DM-####`.
- Personas, vehículos, cotizaciones y fechas deterministas para pruebas de carga.

La purga automática solo considera placas que cumplen `^DM[0-9]+$`; los casos `DEM-*` quedan intactos.

---

## 7. Backend y API

### 7.1 Composición del servidor

`server/src/app.ts` compone la aplicación en este orden:

1. `trust proxy` en 1 salto.
2. `helmet`.
3. `cors` con `APP_ORIGIN` y credenciales.
4. Generación de `requestId` y cabecera `X-Request-Id`.
5. Log técnico al finalizar la respuesta.
6. `express.json` con límite de 1 MB.
7. Rutas públicas: `/api/v1/health`, `/setup`, `/auth`, `/demo`, `/tracking`.
8. Rutas operativas con `demoContext`: `/lookups`, `/orders`, `/audit`, `/reports`, `/attachments`, `/users`.
9. Servido de `client/dist` y fallback a `index.html` para rutas que no empiezan por `/api/`.
10. `errorHandler` uniforme.

No hay manejador específico para rutas API desconocidas; una ruta `/api` no registrada termina en la respuesta 404 estándar de Express.

### 7.2 Capas y funciones relevantes

| Capa | Archivo | Función |
|---|---|---|
| Composición | `server/src/app.ts` | Middleware, routers, estáticos y errores. |
| Entorno | `server/src/config/env.ts` | Validación y carga única de variables. |
| Pool | `server/src/db/pool.ts` | Pools producción/demo y `AsyncLocalStorage`. |
| Migraciones | `server/src/db/migrate.ts` | Aplicación ordenada de SQL y registro en `schema_migrations`. |
| Autenticación | `server/src/modules/auth/service.ts` | Login, sesión actual y logout. |
| Seguridad de login | `server/src/modules/auth/security.ts` | Políticas de rate limit y retardo progresivo. |
| Setup | `server/src/modules/setup/service.ts` | Estado y creación del primer superadministrador. |
| Usuarios | `server/src/modules/users/service.ts` | Listado, creación, edición, contraseña, activación y retención/anonimización. |
| Órdenes | `server/src/modules/orders/orders-service.ts` | Creación, detalle, borradores, correcciones y notificaciones. |
| Listados | `server/src/modules/orders/paginated-lists.ts` | Filtros, conteos, paginación y exportación de filas. |
| Cotizaciones | `quote-creation-repository.ts`, `quote-transition-repository.ts`, `quote-mutation-repository.ts`, `quote-draft-repository.ts` | Versiones, totales, envío, aprobación, edición y borrador. |
| Repuestos | `parts-mutation-repository.ts`, `parts-query-repository.ts` | Actualización, logística, inicio de reparación y consultas. |
| Control final | `final-control-*.ts`, `labor-verification-repository.ts` | Verificación, cierre, reapertura, publicación y entrega. |
| Adjuntos | `attachments/*` | Validación, almacenamiento, lectura y metadatos. |
| Reportes | `server/src/modules/reports/*` | Indicadores, listas y exportación de filas. |
| Auditoría | `server/src/modules/audit/*` | Consulta de eventos y filtros. |
| Tracking | `server/src/modules/tracking/*` | Consulta pública y rate limit. |
| Lookups | `server/src/modules/lookups/*` | Consulta local y Factiliza. |

### 7.3 Convenciones HTTP

- Base: `/api/v1`.
- Transporte: JSON, excepto la carga de adjuntos que usa `multipart/form-data`.
- Autenticación: cookie `parautos_session`.
- Respuestas exitosas: objeto con nombre de recurso (`{ order }`, `{ quotes }`, `{ parts }`, etc.).
- Muchas mutaciones responden `204 No Content`.
- Creaciones responden `201`.
- Errores: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- El servidor no devuelve el detalle campo a campo de un error Zod; lo colapsa en `VALIDATION_ERROR`.
- Los identificadores de ruta deben ser enteros positivos y seguros; si no, se responde `400`.
- Los filtros de listado usan query string y valores controlados.

### 7.4 Índice completo de endpoints (60 endpoints)

Leyenda de roles: **Público** no requiere sesión; **Autenticado** requiere sesión; **Operación** = SA/ADM/ASE; **Admin** = SA/ADM; **Super** = SA.

| # | Módulo | Método y ruta | Rol | Propósito |
|---:|---|---|---|---|
| 1 | Health | `GET /api/v1/health` | Público | Comprobar que el proceso responde. No consulta la base. |
| 2 | Setup | `GET /api/v1/setup/status` | Público | Indicar si existe al menos un usuario activo. |
| 3 | Setup | `POST /api/v1/setup/initial` | Público | Crear el primer superadministrador con token y correo configurados. |
| 4 | Auth | `POST /api/v1/auth/login` | Público | Validar credenciales y crear cookie de sesión. |
| 5 | Auth | `POST /api/v1/auth/logout` | Autenticado | Revocar la sesión y limpiar la cookie. |
| 6 | Auth | `GET /api/v1/auth/me` | Autenticado | Devolver el usuario de la sesión. |
| 7 | Demo | `GET /api/v1/demo/status` | Super | Indicar si demo está habilitado y si la cookie demo está activa. |
| 8 | Demo | `POST /api/v1/demo/enter` | Super | Activar la cookie demo por 8 horas. |
| 9 | Demo | `POST /api/v1/demo/exit` | Super | Limpiar la cookie demo. |
| 10 | Tracking | `GET /api/v1/tracking?plate=&code=` | Público | Consultar estado público por placa y código de 6 dígitos. |
| 11 | Lookups | `GET /api/v1/lookups/local/client/:document` | Operación | Buscar cliente local por DNI/RUC. |
| 12 | Lookups | `GET /api/v1/lookups/local/vehicle/:plate` | Operación | Buscar vehículo local por placa. |
| 13 | Lookups | `GET /api/v1/lookups/factiliza/client/:document` | Operación | Consultar DNI/RUC en Factiliza. |
| 14 | Lookups | `GET /api/v1/lookups/factiliza/vehicle/:plate` | Operación | Consultar placa en Factiliza. |
| 15 | Orders | `GET /api/v1/orders/reception-catalog` | Operación | Catálogo de carrocerías y checklist activo. |
| 16 | Orders | `GET /api/v1/orders/navigation-summary` | Operación | Conteo de siniestros pendientes. |
| 17 | Orders | `GET /api/v1/orders/pending-notifications` | Operación | Diagnósticos y cotizaciones pendientes. |
| 18 | Orders | `GET /api/v1/orders/reception-draft` | Operación | Obtener el borrador de recepción del usuario. |
| 19 | Orders | `PUT /api/v1/orders/reception-draft` | Operación | Guardar borrador con control de revisión. |
| 20 | Orders | `DELETE /api/v1/orders/reception-draft` | Operación | Eliminar el borrador del usuario. |
| 21 | Orders | `GET /api/v1/orders/recent` | Operación | Últimas 5 órdenes y resumen global. |
| 22 | Orders | `GET /api/v1/orders` | Operación | Listado paginado con filtros y conteos globales. |
| 23 | Orders | `POST /api/v1/orders` | Operación | Crear orden y recepción completa. |
| 24 | Orders | `GET /api/v1/orders/:orderId` | Operación | Detalle completo de la orden. |
| 25 | Orders | `PATCH /api/v1/orders/:orderId/claim` | Operación | Registrar un siniestro pendiente. |
| 26 | Orders | `PATCH /api/v1/orders/:orderId/operational-data` | Operación | Corregir modalidad, contacto o siniestro con motivo. |
| 27 | Orders | `GET /api/v1/orders/:orderId/quote-draft` | Operación | Obtener el borrador de cotización. |
| 28 | Orders | `PUT /api/v1/orders/:orderId/quote-draft` | Operación | Guardar borrador manualmente. |
| 29 | Orders | `POST /api/v1/orders/:orderId/quotes/from-draft` | Operación | Crear una versión a partir del borrador. |
| 30 | Orders | `GET /api/v1/orders/:orderId/quotes` | Operación | Listar versiones de cotización. |
| 31 | Orders | `POST /api/v1/orders/:orderId/quotes` | Operación | Crear una versión directamente. |
| 32 | Orders | `PUT /api/v1/orders/:orderId/quotes/:quoteId` | Operación | Editar una versión pendiente. |
| 33 | Orders | `DELETE /api/v1/orders/:orderId/quotes/:quoteId` | Operación | Eliminar una versión pendiente. |
| 34 | Orders | `POST /api/v1/orders/:orderId/quotes/:quoteId/send` | Operación | Marcar cotización como enviada. |
| 35 | Orders | `POST /api/v1/orders/:orderId/quotes/:quoteId/approve` | Operación | Aprobar cotización y generar repuestos. |
| 36 | Orders | `GET /api/v1/orders/parts/workbench` | Operación | Bandeja global de repuestos con métricas y proveedores. |
| 37 | Orders | `GET /api/v1/orders/:orderId/parts` | Operación | Repuestos y logística de una orden. |
| 38 | Orders | `PATCH /api/v1/orders/parts/:partId` | Operación | Actualizar gestión y recepción de un repuesto. |
| 39 | Orders | `PUT /api/v1/orders/:orderId/parts/logistics` | Operación | Guardar logística de repuestos de la orden. |
| 40 | Orders | `POST /api/v1/orders/:orderId/start-repair` | Operación | Iniciar reparación con cotización aprobada y repuestos completos. |
| 41 | Orders | `GET /api/v1/orders/:orderId/final-control` | Operación | Estado, mano de obra, repuestos pendientes y registro de control. |
| 42 | Orders | `PUT /api/v1/orders/:orderId/final-control/labor/:quoteLineId` | Operación | Verificar o retirar una partida de mano de obra. |
| 43 | Orders | `PUT /api/v1/orders/:orderId/final-control/labor` | Operación | Verificar o retirar todas las partidas. |
| 44 | Orders | `POST /api/v1/orders/:orderId/final-control/complete` | Operación | Completar control final y pasar a lista para entrega. |
| 45 | Orders | `POST /api/v1/orders/:orderId/final-control/reopen` | Operación | Reabrir control con motivo. |
| 46 | Orders | `POST /api/v1/orders/:orderId/final-control/publish` | Operación | Publicar lista para entrega. |
| 47 | Orders | `POST /api/v1/orders/:orderId/final-control/deliver` | Operación | Registrar entrega con conformidad. |
| 48 | Audit | `GET /api/v1/audit/events` | Admin | Consultar hasta 200 eventos con filtros. |
| 49 | Reports | `GET /api/v1/reports/operational` | Admin | Dashboard operativo agregado. |
| 50 | Reports | `GET /api/v1/reports/list/:kind` | Admin | Lista paginada de cotizaciones o repuestos pendientes. |
| 51 | Reports | `GET /api/v1/reports/export/:kind` | Admin | Devolver todas las filas filtradas, sin paginar, para exportación. |
| 52 | Attachments | `GET /api/v1/attachments/orders/:orderId` | Operación | Listar adjuntos de una orden. |
| 53 | Attachments | `GET /api/v1/attachments/:attachmentId/content` | Autenticado | Servir el archivo inline. |
| 54 | Attachments | `POST /api/v1/attachments/orders/:orderId` | Operación | Subir una imagen. |
| 55 | Users | `PUT /api/v1/users/me/password` | Autenticado | Cambiar la contraseña propia verificando la actual. |
| 56 | Users | `GET /api/v1/users` | Super | Listar cuentas administrables. |
| 57 | Users | `POST /api/v1/users` | Super | Crear administrador o asesor. |
| 58 | Users | `PUT /api/v1/users/:userId` | Super | Editar datos, rol, estado o contraseña de una cuenta. |
| 59 | Users | `PATCH /api/v1/users/:userId/active` | Super | Activar o desactivar una cuenta. |
| 60 | Users | `DELETE /api/v1/users/:userId` | Super | Eliminar o anonimizar según historial y retención. |

### 7.5 Detalle por módulo

#### 7.5.1 Health, setup, autenticación y demo

**`GET /health`**

Respuesta:

```json
{ "status": "ok" }
```

No comprueba MariaDB, almacenamiento ni Factiliza. Un `200` solo confirma que Express está vivo.

**`GET /setup/status`**

Devuelve `{ configured: boolean }`. Se considera configurado si existe al menos un usuario con `active = 1`.

**`POST /setup/initial`**

Cuerpo:

```json
{
  "token": "token-de-bootstrap",
  "email": "admin@dominio",
  "username": "admin.parautos",
  "names": "Nombre completo",
  "password": "contraseña-de-12-a-128"
}
```

Condiciones:

- `BOOTSTRAP_ADMIN_TOKEN` debe existir.
- El token debe coincidir.
- El correo debe coincidir con `BOOTSTRAP_ADMIN_EMAIL`.
- No debe existir ningún usuario, ni activo ni inactivo.
- El rol `SUPERADMINISTRADOR` debe existir y estar activo.
- La contraseña se almacena con Argon2id.
- Se registra `bootstrap_completed_at` y el evento `BOOTSTRAP_ADMIN_CREATED`.

Particularidad: `/setup/status` mira usuarios activos, mientras que `/setup/initial` exige cero usuarios totales. Si todas las cuentas estuvieran inactivas y el token se hubiera retirado, el estado podría indicar “no configurado” sin permitir el bootstrap.

**`POST /auth/login`**

Cuerpo:

```json
{ "identifier": "usuario-o-correo", "password": "..." }
```

- Rate limit por IP: 20 intentos por minuto.
- Rate limit por identificador: 5 intentos por minuto.
- Retardo progresivo según intentos, hasta 1500 ms.
- Crea token aleatorio de 32 bytes.
- Guarda solo el hash SHA-256 del token en `sessions`.
- Cookie `parautos_session`: `HttpOnly`, `SameSite=Lax`, `Secure` en producción, TTL configurable de 1 a 24 horas.
- Al autenticar correctamente, limpia el límite del identificador.
- Devuelve `{ user }`, sin hash de contraseña.

**`POST /auth/logout`**

Requiere sesión, marca la sesión como revocada y limpia la cookie.

**`GET /auth/me`**

Devuelve `{ user }` si la sesión sigue vigente. La consulta valida sesión no revocada, no expirada, usuario activo y rol activo.

**Demo**

- `GET /demo/status`: `{ enabled, active }`. `active` refleja la presencia de la cookie demo; el acceso efectivo exige además sesión de superadministrador.
- `POST /demo/enter`: falla con 404 si demo está deshabilitado; si está habilitado, crea cookie demo por 8 horas.
- `POST /demo/exit`: elimina la cookie demo.
- Entrar o salir recarga la aplicación en el cliente.

El cambio de contraseña propio se realiza con `PUT /users/me/password`; no existe recuperación automática por correo ni por pregunta de seguridad.

#### 7.5.2 Tracking y lookups

**`GET /tracking`**

Query:

```text
?plate=ABC-123&code=123456
```

- `code` debe tener exactamente 6 dígitos.
- La placa se normaliza a mayúsculas y se eliminan separadores.
- Rate limit: 10 consultas por minuto por IP.
- Respuesta: `{ tracking: { orderNumber, plate, brand, model, publicStatus } }`.
- No devuelve cliente, teléfono, correo, dirección ni importes.
- Si no hay coincidencia: `404 TRACKING_NOT_FOUND`.

**Lookups**

- `local/client/:document`: acepta 8 dígitos (DNI) u 11 (RUC); devuelve `{ client }` o `{ client: null }`.
- `local/vehicle/:plate`: normaliza la placa; devuelve `{ vehicle }` o `{ vehicle: null }`.
- `factiliza/client/:document`: consulta DNI o RUC; requiere token configurado.
- `factiliza/vehicle/:plate`: consulta datos de placa.
- La consulta externa tiene timeout configurable entre 1 y 60 segundos.
- Errores externos: `503 FACTILIZA_NOT_CONFIGURED`, `502 FACTILIZA_UNAVAILABLE`, `504 FACTILIZA_TIMEOUT`, `404 FACTILIZA_NOT_FOUND`.
- La UI consulta primero lo local y ofrece la consulta externa como acción explícita.

#### 7.5.3 Órdenes y recepción

**`GET /orders/reception-catalog`**

Devuelve:

```json
{
  "bodyTypes": [],
  "checklist": []
}
```

El checklist incluye el catálogo activo. La recepción actual tiene 44 ítems activos en 4 categorías.

**`GET /orders/navigation-summary`**

Devuelve `{ pendingClaims }`: órdenes con `claim_pending_reminder = 1` y estado distinto de `ENTREGADA` o `CANCELADA`.

**`GET /orders/pending-notifications`**

Devuelve:

```json
{
  "total": 0,
  "diagnosisCount": 0,
  "quoteCount": 0,
  "diagnosisPending": [],
  "quotePending": []
}
```

- Diagnóstico pendiente: `diagnosis_pending_reminder = 1` y orden no terminal.
- Cotización pendiente: orden en `COTIZACION_PENDIENTE`, sin diagnóstico pendiente y sin versiones de cotización.
- `quotePending` se recorta para que el panel no muestre más de 8 elementos combinados; los conteos reflejan el total.

**`GET /orders/recent`**

Devuelve las últimas 5 órdenes y el resumen global de conteos.

**`GET /orders`**

Parámetros principales:

| Parámetro | Uso |
|---|---|
| `page` | Página, mínimo 1. |
| `pageSize` | 10, 20 o 30. |
| `search` | Orden, placa, cliente, marca o modelo. |
| `status` | Estado interno o `ALL`. |
| `modality` | Modalidad o `ALL`. |
| `age` | `RECENT` (0-2 días), `ATTENTION` (3-5), `OVERDUE` (>5) para órdenes. |
| `from`, `to` | Rango de fecha de creación. |
| `advisor` | Filtro de reportes por asesor. |
| `pendingClaim` | `true` o `false`. |
| `view` | `quotes` limita a `COTIZACION_PENDIENTE` y `ESPERA_APROBACION`. |

Respuesta:

```json
{
  "orders": [],
  "pagination": { "page": 1, "pageSize": 10, "total": 0, "pages": 1 },
  "counts": {},
  "total": 0,
  "overdue": 0
}
```

`counts`, `total` y `overdue` son globales; el `pagination.total` corresponde al filtro aplicado.

**`POST /orders`**

Crea en una transacción:

1. Cliente por documento, con actualización de nombre, teléfono y correo.
2. Vehículo por placa, con actualización de marca, modelo, año, VIN, color y carrocería.
3. Vínculo cliente-vehículo.
4. Código público de 6 dígitos, único por vehículo, con hasta 10 intentos.
5. Orden en `COTIZACION_PENDIENTE`.
6. Recepción con kilometraje, combustible, consideraciones y diagnóstico.
7. Snapshot de identidad.
8. Firma PNG como adjunto `OTRO`.
9. Respuestas del checklist.
10. Marcas de daño.
11. Evento `CREATED`.

Cuerpo mínimo relevante:

```json
{
  "client": {
    "documentType": "DNI",
    "documentNumber": "12345678",
    "fullName": "Nombre",
    "phone": "999888777",
    "email": "correo@dominio"
  },
  "vehicle": {
    "plate": "ABC-123",
    "brand": "TOYOTA",
    "model": "COROLLA",
    "year": 2020,
    "vin": "17CARACTERES",
    "color": "Blanco",
    "colorType": "CATALOGO",
    "bodyTypeId": 1
  },
  "modality": "PARTICULAR",
  "claimNumber": null,
  "claimPendingReminder": false,
  "diagnosisPendingReminder": false,
  "mileage": 50000,
  "fuelLevel": 50,
  "considerations": [],
  "damages": [],
  "diagnosisLegibility": "PENDIENTE",
  "diagnosisReviewState": "PENDIENTE_REVISION",
  "checklistReviewed": true,
  "signature": "data:image/png;base64,...",
  "checklist": [],
  "acceptedTerms": true
}
```

Respuesta `201`:

```json
{ "order": { "id": 1, "orderNumber": "OS-2026-00001", "publicCode": "123456" } }
```

Reglas críticas:

- Todos los ítems activos del checklist deben estar respondidos exactamente una vez.
- La firma debe ser un data URL PNG.
- `checklistReviewed` y `acceptedTerms` deben ser `true`.
- Una orden particular no puede tener siniestro.
- Una orden de aseguradora debe tener número o recordatorio pendiente, no ambos.
- El número de orden se forma como `OS-<año UTC>-<id con 5 dígitos>`.
- El código público puede repetirse entre vehículos distintos, pero no dentro del mismo vehículo.

**`GET /orders/:orderId`**

Devuelve la orden, recepción, checklist, daños, adjuntos, historial de auditoría de la orden y snapshot. El historial de la orden no está paginado.

**`PATCH /orders/:orderId/claim`**

Cuerpo: `{ "claimNumber": "..." }`.

- Rechaza órdenes particulares.
- Rechaza si ya existe número de siniestro.
- Limpia el recordatorio pendiente.
- Registra `CLAIM_COMPLETED`.

**`PATCH /orders/:orderId/operational-data`**

Cuerpo:

```json
{
  "phoneOverride": "999888777",
  "emailOverride": "operaciones@dominio",
  "modality": "MAPFRE",
  "claimNumber": "SIN-2026-001",
  "claimPendingReminder": false,
  "reason": "Corrección solicitada por el cliente"
}
```

- La recepción original no se modifica.
- Exige un motivo de 1 a 500 caracteres.
- Exige al menos un cambio real.
- Rechaza órdenes `ENTREGADA` o `CANCELADA`.
- Valida la invariante de siniestro.
- Registra antes/después y motivo en `OPERATIONAL_DATA_CORRECTED`.

**Borradores de recepción**

- `GET /orders/reception-draft` devuelve el borrador del usuario autenticado.
- `PUT` recibe `revision`, `currentStep` entre 0 y 6 y un `payload` JSON.
- El servidor incrementa la revisión y rechaza conflictos con `409 RECEPTION_DRAFT_CONFLICT`.
- `DELETE` borra el borrador remoto.
- Los archivos de evidencia y el archivo de diagnóstico se conservan en IndexedDB del navegador; el borrador remoto guarda el estado del formulario, no los binarios.
- Al crear la orden y subir todos los archivos, el cliente elimina el borrador remoto, el borrador local y los medios locales.

#### 7.5.4 Cotizaciones

**`GET /orders/:orderId/quotes`**

Devuelve versiones ordenadas, con líneas, total sin IGV e `igv: 0`. Los estados posibles son `PENDIENTE`, `ENVIADA`, `APROBADA` y `REEMPLAZADA`.

**`GET / PUT /orders/:orderId/quote-draft`**

- Un borrador por orden.
- Moneda `PEN` o `USD`.
- `noParts` booleano.
- Al menos una línea.
- Una línea es `MANO_OBRA` o `REPUESTO`.
- La categoría `PLANCHADO`, `PINTURA` o `MECANICA` solo se admite en mano de obra.
- Si `noParts` es verdadero, no puede haber líneas de repuesto.
- El guardado es manual; no hay autosave de cotización.
- Guardar el borrador registra auditoría.

**`POST /orders/:orderId/quotes/from-draft`**

- Exige un borrador con al menos una línea.
- Cuerpo opcional: `{ "adjustmentReason": "..." }`.
- Llama al mismo flujo de creación de versión.
- No elimina automáticamente el borrador.

**`POST /orders/:orderId/quotes`**

Cuerpo:

```json
{
  "currency": "PEN",
  "noParts": false,
  "adjustmentReason": "Motivo si no es V1",
  "lines": [
    {
      "type": "MANO_OBRA",
      "category": "PLANCHADO",
      "description": "Descripción",
      "quantity": 1,
      "unitPrice": 0
    }
  ]
}
```

Reglas:

- La primera versión no requiere motivo; desde la segunda sí.
- No se puede crear una versión si la última está `APROBADA`.
- La versión anterior pasa a `REEMPLAZADA`.
- El total se calcula como suma de `cantidad × precio unitario`.
- `igv` siempre es 0.
- La creación registra `QUOTE_CREATED`.

**`PUT /orders/:orderId/quotes/:quoteId`**

- Solo si la versión está `PENDIENTE`.
- Reemplaza moneda, `noParts` y líneas.
- No acepta motivo de ajuste en este endpoint.
- Registra `QUOTE_UPDATED`.

**`DELETE /orders/:orderId/quotes/:quoteId`**

- Solo si la versión está `PENDIENTE`.
- Borra líneas y versión.
- Si existe una versión anterior, la restaura a `ENVIADA` o `PENDIENTE` según su `sent_at` y ajusta el estado de la orden.
- Si no existe anterior, devuelve la orden a `COTIZACION_PENDIENTE`.
- Registra `QUOTE_DELETED`.

**`POST /orders/:orderId/quotes/:quoteId/send`**

- Requiere versión `PENDIENTE`.
- Exige al menos una línea.
- Guarda `sent_snapshot`.
- Pasa cotización a `ENVIADA`.
- Pasa orden interna y pública a `ESPERA_APROBACION`.
- No envía correo ni mensaje: “enviada” es un cambio de estado.
- Registra `QUOTE_SENT`.

**`POST /orders/:orderId/quotes/:quoteId/approve`**

- Requiere versión `ENVIADA`.
- Exige al menos una línea.
- Guarda `approved_snapshot`.
- Pasa cotización a `APROBADA`.
- Crea una fila en `order_parts` por cada línea de repuesto.
- Si hay repuestos, orden interna y pública pasan a `ESPERA_REPUESTOS`.
- Si no hay repuestos, orden interna y pública pasan a `EN_REPARACION`.
- No existe estado de cotización “rechazada”.
- Registra `QUOTE_APPROVED`.

#### 7.5.5 Repuestos

**`GET /orders/parts/workbench`**

Devuelve repuestos paginados, métricas, opciones de proveedor y filtros disponibles. Los estados visibles son:

- `POR_GESTIONAR`
- `PEDIDO`
- `EN_TALLER`
- `RECIBIDO` (derivado cuando `receivedQuantity >= quantity`)

Filtros habituales: búsqueda por orden/placa/siniestro/código/proveedor/repuesto, estado, urgencia, proveedor y calidad. La urgencia usa la fecha estimada:

- `OVERDUE`: fecha anterior a hoy y recepción incompleta.
- `NEXT_3`: desde hoy hasta los próximos 3 días.
- `NO_DATE`: sin fecha estimada.

**`GET /orders/:orderId/parts`**

Devuelve `{ parts, logistics }`.

**`PATCH /orders/parts/:partId`**

Cuerpo:

```json
{
  "receivedQuantity": 1,
  "managementStatus": "PEDIDO",
  "quality": "ORIGINAL",
  "partCode": "CODIGO",
  "expectedDate": "2026-11-01",
  "providerId": 1,
  "notes": "Observación"
}
```

- `receivedQuantity` no puede superar la cantidad solicitada.
- Si se envía proveedor, debe existir y estar activo.
- Si la recepción es completa, el estado de gestión se fuerza a `EN_TALLER`.
- Registra `PART_UPDATED`.

**`PUT /orders/:orderId/parts/logistics`**

Cuerpo:

```json
{
  "freightRequested": false,
  "freightAmount": null,
  "freightPayment": "PENDIENTE",
  "expansionRequired": false,
  "owner": "Responsable",
  "notes": "Observación"
}
```

- Upsert por orden.
- Registra `PARTS_LOGISTICS_UPDATED`.

**`POST /orders/:orderId/start-repair`**

Condiciones:

- Orden en `ESPERA_REPUESTOS` o `EN_REPARACION`.
- Cotización aprobada.
- Ningún repuesto con `received_quantity < quantity`.
- Pasa orden interna y pública a `EN_REPARACION`.
- Registra `REPAIR_STARTED`.

#### 7.5.6 Control final y entrega

**`GET /orders/:orderId/final-control`**

Devuelve:

```json
{
  "control": {
    "internalStatus": "EN_REPARACION",
    "publicStatus": "EN_REPARACION",
    "labor": [],
    "pendingParts": [],
    "record": null
  }
}
```

**`PUT /orders/:orderId/final-control/labor/:quoteLineId`**

Cuerpo: `{ "verified": true }`.

- La partida debe pertenecer a la cotización aprobada y ser `MANO_OBRA`.
- No se puede modificar si la orden ya fue entregada.
- No se puede modificar si el control está completo; primero debe reabrirse.
- Registra `LABOR_VERIFIED` o `LABOR_VERIFICATION_REMOVED`.

**`PUT /orders/:orderId/final-control/labor`**

Cuerpo: `{ "verified": true }`.

- Verifica o retira todas las partidas de mano de obra.
- Registra `ALL_LABOR_VERIFIED` o `ALL_LABOR_VERIFICATIONS_REMOVED`.

**`POST /orders/:orderId/final-control/complete`**

Condiciones:

- Orden no terminal.
- Orden distinta de `LISTA_PARA_ENTREGA`.
- Cotización aprobada.
- Ningún repuesto pendiente.
- Al menos una partida de mano de obra.
- Todas las partidas verificadas.
- Guarda `completed_at`.
- Orden interna `LISTA_PARA_ENTREGA`; pública `EN_REPARACION`.
- Limpia cualquier publicación previa.
- Registra `FINAL_CONTROL_COMPLETED`.

**`POST /orders/:orderId/final-control/reopen`**

Cuerpo: `{ "reason": "Motivo de 1 a 1000 caracteres" }`.

- Exige control registrado.
- Rechaza una orden entregada.
- Limpia `completed_at`, `published_at` y datos de publicación.
- Orden interna y pública pasan a `EN_REPARACION`.
- Registra `FINAL_CONTROL_REOPENED`.

**`POST /orders/:orderId/final-control/publish`**

Cuerpo opcional:

```json
{ "channel": "WhatsApp o llamada", "note": "Observación" }
```

- Exige control completado y orden interna `LISTA_PARA_ENTREGA`.
- Rechaza orden ya entregada.
- Guarda `published_at`, usuario, canal y nota.
- Estado público `LISTA_PARA_ENTREGA`.
- No envía un mensaje real; solo registra la publicación.
- Registra `READY_FOR_PICKUP_PUBLISHED`.

**`POST /orders/:orderId/final-control/deliver`**

Cuerpo obligatorio: `{ "conformityAcknowledged": true }`.

- Exige orden interna y pública `LISTA_PARA_ENTREGA`.
- Exige que el control exista y no esté entregado.
- Guarda `delivered_at`, usuario y `conformity_acknowledged_at`.
- Orden interna y pública pasan a `ENTREGADA`.
- Registra `ORDER_DELIVERED`.

#### 7.5.7 Adjuntos

**`GET /attachments/orders/:orderId`**

Lista metadatos: id, categoría, nombre original, MIME, tamaño y fecha. No incluye el binario.

**`GET /attachments/:attachmentId/content`**

- Requiere sesión.
- Sirve el archivo con el MIME almacenado y `Content-Disposition: inline`.
- No usa URLs firmadas; el servidor hace de proxy del almacenamiento.
- No hay endpoint de borrado de adjuntos.

**`POST /attachments/orders/:orderId`**

- `multipart/form-data`.
- Campo `file`.
- Campo `category`.
- Una sola imagen por solicitud.
- Categorías: `RECEPCION`, `DANIO`, `EVALUACION_MANUSCRITA`, `OTRO`.
- JPEG, PNG o WEBP.
- Máximo 5 MB.
- Valida MIME declarado y bytes mágicos.
- Calcula SHA-256 y tamaño.
- Si la categoría es `EVALUACION_MANUSCRITA`, limpia el recordatorio de diagnóstico y registra `DIAGNOSIS_UPLOADED`.

#### 7.5.8 Reportes, auditoría y usuarios

**`GET /reports/operational`**

Devuelve, entre otros:

- Conteos por estado y modalidad.
- Cotizaciones y repuestos pendientes.
- Actividad por asesor de los últimos 90 días.
- Actividad semanal de las últimas 8 semanas.
- Carga actual por asesor.
- Antigüedad de cotizaciones y repuestos.
- Embudo de cotizaciones: creadas, enviadas y aprobadas.

**`GET /reports/list/:kind`**

- `kind`: `quotes` o `parts`.
- Lista paginada de cotizaciones en `PENDIENTE`/`ENVIADA` o repuestos con recepción incompleta.
- Incluye `options` para filtros de asesor, modalidad, estado o proveedor.
- Otro `kind` responde 404.

**`GET /reports/export/:kind`**

- Devuelve `{ rows: [...] }` con todas las filas filtradas, sin paginar.
- No genera el archivo.
- El cliente transforma las filas a CSV o PDF.
- Otro `kind` responde 404.

**`GET /audit/events`**

Filtros:

- `text`: acción, entidad, ID de registro o nombre de usuario.
- `userId`.
- `action`.
- `from` / `to`: fechas ISO.
- Orden descendente por fecha e ID.
- Límite fijo de 200 eventos.
- Devuelve también acciones distintas y usuarios disponibles.

**Usuarios**

- `PUT /users/me/password`: cualquier usuario autenticado. Cuerpo `{ currentPassword, newPassword }`; la nueva contraseña debe tener 12 a 128 caracteres. Una contraseña actual incorrecta responde `401 INVALID_PASSWORD`. Registra `PASSWORD_CHANGED` y responde `204`.
- `GET /users`: lista cuentas con rol, estado, fechas e historial. Solo superadministrador.
- `POST /users`: crea solo `ADMINISTRADOR` o `ASESOR`; no permite crear superadministradores desde este endpoint.
- `PUT /users/:userId`: edición parcial por superadministrador. Acepta `names`, `email`, `username`, `role`, `newPassword` y `active`; exige al menos un campo. `newPassword`, si se envía, debe tener 12 a 128 caracteres. El rol puede ser `ADMINISTRADOR`, `ASESOR` o `SUPERADMINISTRADOR`. Registra `USER_UPDATED` con datos previos y nuevos.
  - Una cuenta anonimizada no se puede modificar.
  - Usuario o correo duplicado responde `409`.
  - No permite autodesactivarse.
  - No hay una guarda específica que impida que un superadministrador se cambie el rol a sí mismo; la interfaz no ofrece esa opción.
- `PATCH /users/:userId/active`: activa o desactiva; no permite autodesactivarse.
- `DELETE /users/:userId`: no permite autodestruirse.
  - Sin historial y con menos de 7 días de antigüedad: elimina físicamente.
  - Con historial: anonimiza nombre, usuario, correo y contraseña, conserva referencias y borra sesiones.
  - Con cuenta antigua o historial: exige 30 días de inactividad.
  - No permite eliminar al último superadministrador activo.
- Ni el cambio propio ni el restablecimiento por superadministrador revocan las sesiones abiertas; la interfaz recomienda volver a iniciar sesión después del cambio propio.

### 7.6 Formato y catálogo de errores

Formato uniforme:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "La orden no existe.",
    "requestId": "uuid"
  }
}
```

Los errores de Zod no exponen el detalle de campos; se responden como:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revise los datos ingresados.",
    "requestId": "uuid"
  }
}
```

Códigos de negocio agrupados por dominio:

| Dominio | Códigos | Estados HTTP habituales |
|---|---|---|
| Autenticación y sesión | `AUTHENTICATION_REQUIRED`, `AUTHORIZATION_REQUIRED`, `INVALID_CREDENTIALS`, `LOGIN_RATE_LIMITED`, `SESSION_INVALID` | 401, 403, 429 |
| Configuración inicial | `BOOTSTRAP_RATE_LIMITED`, `INVALID_BOOTSTRAP_EMAIL`, `INVALID_BOOTSTRAP_TOKEN`, `SETUP_ALREADY_COMPLETED`, `SETUP_DISABLED`, `SUPERADMIN_ROLE_MISSING` | 403, 409, 429, 500 |
| Usuarios | `EMAIL_ALREADY_EXISTS`, `INVALID_PASSWORD`, `INVALID_USER`, `LAST_SUPERADMIN`, `RETENTION_REQUIRED`, `ROLE_NOT_FOUND`, `SELF_DEACTIVATION`, `SELF_DELETION`, `USER_ALREADY_EXISTS`, `USER_ANONYMIZED`, `USER_NOT_FOUND`, `USERNAME_ALREADY_EXISTS` | 400, 401, 404, 409 |
| Órdenes y recepción | `CHECKLIST_INCOMPLETE`, `CLAIM_ALREADY_RECORDED`, `CLAIM_CONFLICT`, `CLAIM_INVARIANT`, `CLAIM_NOT_ALLOWED`, `CLAIM_REQUIRED`, `INVALID_ORDER`, `NO_MEANINGFUL_CHANGE`, `ORDER_ALREADY_DELIVERED`, `ORDER_NOT_FOUND`, `ORDER_NOT_PUBLISHED`, `ORDER_NOT_READY`, `ORDER_TERMINAL`, `PERSISTENCE_ERROR`, `PUBLIC_CODE_GENERATION_FAILED`, `RECEPTION_CONFIRMATION_REQUIRED`, `RECEPTION_DRAFT_CONFLICT` | 400, 404, 409, 500 |
| Cotizaciones | `ADJUSTMENT_REASON_REQUIRED`, `INVALID_QUOTE`, `INVALID_QUOTE_TRANSITION`, `QUOTE_ALREADY_APPROVED`, `QUOTE_CANNOT_BE_DELETED`, `QUOTE_DRAFT_REQUIRED`, `QUOTE_EMPTY`, `QUOTE_NOT_APPROVED`, `QUOTE_NOT_EDITABLE`, `QUOTE_NOT_FOUND` | 400, 404, 409 |
| Repuestos | `INVALID_PART`, `INVALID_RECEIVED_QUANTITY`, `INVALID_REPAIR_TRANSITION`, `PART_NOT_FOUND`, `PARTS_PENDING`, `PROVIDER_NOT_FOUND` | 400, 404, 409 |
| Control final | `FINAL_CONTROL_NOT_COMPLETED`, `FINAL_CONTROL_REOPEN_REQUIRED`, `INVALID_LABOR_LINE`, `LABOR_LINE_NOT_APPROVED`, `LABOR_NOT_VERIFIED`, `LABOR_REQUIRED`, `ORDER_ALREADY_DELIVERED` | 400, 409 |
| Adjuntos | `ATTACHMENT_NOT_FOUND`, `INVALID_ATTACHMENT`, `INVALID_ATTACHMENT_CATEGORY`, `INVALID_FILE`, `INVALID_IMAGE_CONTENT` | 400, 404 |
| Consultas externas | `INVALID_PLATE`, `FACTILIZA_NOT_CONFIGURED`, `FACTILIZA_NOT_FOUND`, `FACTILIZA_TIMEOUT`, `FACTILIZA_UNAVAILABLE` | 400, 404, 502, 503, 504 |
| Tracking público | `INVALID_TRACKING_LOOKUP`, `TRACKING_NOT_FOUND`, `TRACKING_RATE_LIMITED` | 400, 404, 429 |
| Genéricos | `VALIDATION_ERROR`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE`, `ORDER_STATUS_TRANSITION_INVALID`, `INTERNAL_ERROR` | 400, 409, 413, 500 |

Los códigos de estado de orden se mapean así:

- Error de trigger MariaDB con `errno` 30001 → `409 ORDER_STATUS_TRANSITION_INVALID`.
- Error inesperado → `500 INTERNAL_ERROR` con request ID; no se expone el stack.
- JSON inválido → `400 INVALID_JSON`.
- Cuerpo JSON mayor a 1 MB → `413 PAYLOAD_TOO_LARGE`.
- Archivo mayor a 5 MB → `413 FILE_TOO_LARGE`.

### 7.7 Códigos HTTP observados

| Código | Uso |
|---|---|
| 200 | Lectura, actualización o acción completada. |
| 201 | Orden, versión de cotización, adjunto o usuario creado. |
| 204 | Acción completada sin cuerpo. |
| 400 | Validación, identificador inválido o regla de negocio. |
| 401 | Falta de sesión o credenciales inválidas. |
| 403 | Sesión válida sin permiso. |
| 404 | Recurso inexistente o no encontrado. |
| 409 | Conflicto de estado, transición, duplicado o retención. |
| 413 | Cuerpo o archivo demasiado grande. |
| 429 | Rate limit. |
| 500 | Error interno o fallo de persistencia. |
| 502 | Servicio externo no disponible. |
| 503 | Servicio externo no configurado. |
| 504 | Timeout externo. |

---

## 8. Frontend

### 8.1 Arranque y navegación

`client/src/main.tsx` decide entre dos aplicaciones según la ruta del navegador:

```text
window.location.pathname === "/seguimiento"
        |
        +-- sí --> PublicTracking
        |
        +-- no --> App
```

`App` consulta en paralelo:

- `GET /setup/status`
- `GET /auth/me`

Estados:

| Resultado | Pantalla |
|---|---|
| Sesión válida | Dashboard interno. |
| Sin sesión y configuración completa | Login. |
| Sin sesión y sin usuarios activos | Formulario de configuración inicial. |
| Error de consulta | Login, como fallback. |

No se usa React Router. La navegación interna es un estado `route`:

```text
dashboard -> new -> orders -> orderDetail
     |          |        |
     |          |        +--> cotizaciones del caso
     |          |        +--> repuestos del caso
     |          |        +--> control final
     |          |        +--> historial
     |          +--> wizard de recepción
     +--> quotes / parts / reports / audit / users
```

Consecuencias:

- Recargar la página vuelve al panel principal.
- No existen URLs profundas para una orden, cotización o reporte.
- La única ruta directa es `/seguimiento`, que además admite `?plate=...&code=...`.
- Los reportes, el detalle de orden, auditoría y usuarios se cargan de forma diferida con `React.lazy` y `Suspense`.

### 8.2 Mapa de componentes

| Archivo | Responsabilidad |
|---|---|
| `client/src/app.tsx` | Shell, login, setup, panel, listados globales, navegación y perfil. |
| `client/src/full-new-order.tsx` | Wizard de recepción, autoguardado y creación. |
| `client/src/new-order-data-step.tsx` | Cliente, vehículo, modalidad, siniestro y consultas. |
| `client/src/new-order-checklist-steps.tsx` | Checklist, consideraciones y banderas. |
| `client/src/new-order-damage-step.tsx` | Diagramas y marcado de daños. |
| `client/src/new-order-media-steps.tsx` | Evidencias, cámara y evaluación manuscrita. |
| `client/src/new-order-summary-step.tsx` | Revisión, términos y firma. |
| `client/src/order-detail.tsx` | Detalle por pestañas y corrección operativa. |
| `client/src/reception-detail.tsx` | Evidencia de recepción, diagnóstico y PDF. |
| `client/src/quote-editor.tsx` | Borrador, versiones y acciones de cotización. |
| `client/src/quote-export-toolbar.tsx` | PDF/Excel de cotización y PDF de orden de trabajo. |
| `client/src/parts-order-workbench.tsx` | Repuestos y logística de una orden. |
| `client/src/final-control.tsx` | Verificación, cierre, publicación, entrega y acta. |
| `client/src/reports-view.tsx` | Dashboard de reportes y exportación. |
| `client/src/report-lists.tsx` | Listas paginadas de cotizaciones/repuestos. |
| `client/src/audit-view.tsx` | Consulta de eventos. |
| `client/src/users-view.tsx` | Administración, edición y restablecimiento de cuentas. |
| `client/src/public-tracking.tsx` | Consulta pública. |
| `client/src/api.ts` | Cliente HTTP y apertura de adjuntos. |
| `client/src/query-client.ts` | Configuración de TanStack Query e invalidación. |
| `client/src/scoped-query.tsx` | Consultas con clave de usuario y modo. |
| `client/src/pagination.tsx` | Estado y controles de paginación. |
| `client/src/reception-draft-storage.ts` | IndexedDB para borrador y medios. |
| `client/src/pdf-library.ts` | Carga diferida de jsPDF y autotable. |
| `client/src/camera-stream.ts` | Captura con cámara trasera cuando el navegador lo permite. |

### 8.3 Shell interno

- Barra lateral con logo, navegación y selector de tamaño amplio/compacto.
- El tamaño se guarda en `localStorage` con la clave `parautos-sidebar-mode`.
- En móvil hay navegación inferior y la barra se oculta al hacer scroll.
- Cabecera con título, estado de sincronización, botón demo (solo superadministrador), campana de pendientes y perfil.
- El perfil muestra nombre, rol, correo, cambio de contraseña y cierre de sesión.
- La campana muestra hasta 99+ pendientes y un panel con los primeros elementos.
- Al iniciar sesión o cambiar de modo, se muestra una vez por sesión un recordatorio de pendientes operativos.
- El botón de demo entra o sale y recarga la página.
- Los elementos de navegación se filtran por rol, pero el backend vuelve a validar permisos.

### 8.4 Panel principal

El panel usa:

- `GET /orders/recent` para las últimas 5 órdenes y los conteos por estado.
- `GET /orders/navigation-summary` para siniestros pendientes.
- `GET /orders/pending-notifications` para diagnósticos y cotizaciones pendientes.

Muestra:

- Cuatro indicadores clicables: cotizaciones pendientes, espera de aprobación, espera de repuestos y en reparación.
- Alerta de siniestros pendientes.
- Bloque de pendientes operativos con acceso directo a la pestaña de recepción o cotización.
- Prioridades del taller.
- Distribución por estado.

El panel no muestra `ENTREGADA` ni `CANCELADA` como indicadores principales; esas órdenes aparecen en listados y detalles.

### 8.5 Órdenes y cotizaciones globales

**Órdenes**

Filtros visibles:

- Búsqueda libre por cliente, placa, marca, modelo u orden.
- Estado.
- Modalidad.
- Casilla “Siniestro pendiente”.

La tabla muestra placa, vehículo, orden, cliente, modalidad, estado, antigüedad y acceso al detalle.

**Cotizaciones**

Vista de órdenes en etapas de cotización, con filtros:

- Etapa: por cotizar o enviada/espera aprobación.
- Modalidad.
- Antigüedad.
- Desde / hasta.
- Búsqueda.

Cada tarjeta abre directamente la pestaña de cotización del caso.

### 8.6 Wizard de recepción

El wizard tiene seis pasos:

1. **Datos**
2. **Checklist**
3. **Consideraciones**
4. **Daños**
5. **Evidencias**
6. **Resumen**

#### Paso 1: Datos

- Documento DNI (8) o RUC (11).
- Nombre o razón social.
- Teléfono y correo opcionales.
- Placa, marca, modelo, año, VIN, color, tipo de color y carrocería.
- Modalidad.
- Número de siniestro o recordatorio pendiente.
- Kilometraje y combustible.
- Diagnóstico pendiente.

La consulta local se dispara al salir del documento o de la placa. La consulta externa Factiliza se ofrece como botón explícito. Los datos recuperados se muestran para revisión y pueden corregirse.

El formato de placa se valida contra patrones peruanos conocidos; si no coincide pero tiene longitud suficiente, se pide confirmación al usuario. Esto es una advertencia del cliente, no un rechazo del backend.

#### Paso 2: Checklist

- Cuatro categorías.
- 44 ítems activos.
- Cada ítem se responde `SI` o `NO`.
- Se puede agregar una observación por ítem.
- Se puede marcar una categoría completa como conforme.
- Hay deshacer por categoría.
- No se avanza si falta algún ítem.

#### Paso 3: Consideraciones

- Banderas predefinidas.
- Consideración adicional libre.
- Se eliminan duplicados antes de enviar.

#### Paso 4: Daños

- Cuatro variantes de carrocería (`V1` a `V4`).
- Cinco vistas por variante (`01` a `05`).
- Trazos libres sobre el diagrama.
- Cada trazo se guarda como una lista de puntos normalizados `u`, `v` entre 0 y 1.
- Se pueden deshacer trazos.
- Se admite una descripción por daño.
- Máximo 100 daños en el contrato.

#### Paso 5: Evidencias

- Hasta 15 fotografías.
- JPEG, PNG o WEBP.
- Máximo 5 MB por archivo.
- Cámara trasera si el navegador lo permite.
- Una evaluación manuscrita adicional.
- Vistas previas antes de subir.
- La evaluación manuscrita se guarda como categoría `EVALUACION_MANUSCRITA`; las evidencias normales como `RECEPCION` o `DANIO` según el flujo.

#### Paso 6: Resumen

- Revisión del checklist.
- Aceptación de términos.
- Firma del cliente en canvas.
- La firma se convierte a PNG data URL.
- Se muestra el resumen de la orden.
- Se confirma la creación.

#### Autoguardado y recuperación

```text
Cambio de estado
   |
   +--> IndexedDB local inmediato (texto + medios)
   |
   +--> espera 900 ms
          |
          +--> PUT /orders/reception-draft
                 |
                 +--> guardado OK -> revisión actualizada
                 +--> 409 -> estado "conflicto"
                 +--> error/offline -> estado "offline"
```

Detalles:

- El borrador remoto es por usuario, no por orden, porque la orden aún no existe.
- El borrador local se separa por usuario y modo (`producción` o `demo`).
- El borrador remoto conserva el formulario; los archivos y medios viven en IndexedDB.
- Al restaurar, el borrador remoto tiene prioridad; si falla la consulta, se usa el local.
- Una revisión distinta en el servidor produce `RECEPTION_DRAFT_CONFLICT`.
- Al crear la orden y subir todos los archivos, se eliminan borrador remoto, local y medios.
- Si la orden se crea pero fallan las cargas, la orden ya existe y el wizard permite “Reintentar cargas”. No se crea una segunda orden.

#### Creación y cargas

1. `POST /orders` crea la orden y la recepción.
2. Se suben las evidencias pendientes, una por solicitud.
3. Se sube la evaluación manuscrita si existe.
4. Se elimina el borrador.
5. Se navega al listado de órdenes.

La firma se guarda dentro de la creación de la orden, no como una carga separada.

### 8.7 Detalle de orden

Pestañas:

| Pestaña | Contenido |
|---|---|
| Resumen | Identidad, vehículo, modalidad, siniestro, asesor, estado y datos operativos. |
| Recepción | Checklist, consideraciones, daños, evidencias, diagnóstico, PDF de recepción. |
| Cotización | Editor, historial de versiones y exportaciones. |
| Repuestos | Repuestos del caso, proveedor, recepción y logística. |
| Control final | Verificación, cierre, publicación y entrega. |
| Historial | Eventos de auditoría de la orden. |

Acciones del resumen:

- Corregir datos operativos con motivo.
- Registrar siniestro pendiente.
- Abrir adjuntos.
- Descargar documentos.
- Ver la orden completa.

La corrección operativa está deshabilitada en órdenes entregadas o canceladas. La recepción y su PDF son inmutables.

### 8.8 Editor de cotización

- Borrador separado del historial de versiones.
- Guardado manual; no hay autosave.
- Aviso del navegador si hay cambios sin guardar.
- Partidas iniciales: planchado, pintura, mecánica y repuesto.
- Cantidad y precio se normalizan al salir del campo: tres decimales para cantidad, dos para precio.
- Total sin IGV calculado en pantalla.
- Botón “Guardar borrador” y “Crear versión Vn”.
- Desde la segunda versión se exige motivo.
- Historial con estado, moneda, total, fechas y motivo.
- Acciones disponibles: marcar enviada, aprobar, eliminar pendiente.
- Visor flotante del diagnóstico manuscrito, con zoom, paneo y cambio de página.
- Exportación PDF, Excel y orden de trabajo cuando corresponde.

No hay acción de “rechazar cotización”. La aprobación es un cambio de estado interno; no hay firma del cliente en la cotización.

### 8.9 Repuestos

**Bandeja global**

- Métricas: vencidos, pedidos, sin proveedor, recibidos.
- Filtros: búsqueda, estado, urgencia, proveedor, calidad.
- Tabla en escritorio y tarjetas en móvil.
- Acción “Gestionar” abre la pestaña de repuestos de la orden.

**Bandeja por orden**

- Lista de repuestos generados por la cotización aprobada.
- Proveedor, contacto, calidad, código, fecha estimada y notas.
- Recepción por cantidad.
- Estado derivado “Recibido” cuando la cantidad recibida alcanza la solicitada.
- Logística de flete, expansión, responsable y observaciones.
- Botón para iniciar reparación cuando las condiciones están completas.

### 8.10 Control final

- Agrupa la mano de obra por categoría.
- Permite verificar una partida o todas.
- Muestra bloqueos: sin mano de obra, repuestos pendientes, partidas sin verificar.
- “Registrar control final” se habilita cuando no hay bloqueos.
- Tras completar, permite reabrir con motivo.
- Una vez completado, permite publicar “lista para entrega” con canal y nota.
- Tras publicar, muestra la confirmación de conformidad y el botón de entrega.
- Tras entregar, muestra el resumen y permite descargar el acta.
- El acta de conformidad se genera en el navegador.

### 8.11 Reportes, auditoría y usuarios

**Reportes**

- Resumen ejecutivo operativo.
- Actividad por asesor.
- Carga por asesor.
- Antigüedad.
- Actividad semanal.
- Embudo de cotizaciones.
- Listas de cotizaciones y repuestos pendientes.
- Exportación CSV y PDF de todas las filas filtradas.

Solo visible y accesible para SA y ADM.

**Auditoría**

- Filtros por texto, usuario, acción y rango de fechas.
- Muestra fecha, actor, acción, entidad, registro, request ID, IP, user agent y datos antes/después.
- Los datos JSON se presentan de forma legible.
- Límite de 200 eventos, sin paginación.
- Solo SA y ADM.

**Usuarios**

- Lista de cuentas.
- Creación de administrador o asesor.
- Edición de datos, rol, estado y, para otras cuentas, restablecimiento de contraseña mediante un modal.
- El propio usuario puede editar sus datos desde Usuarios y cambiar su contraseña desde el perfil; la interfaz no le ofrece cambiar su rol ni desactivarse.
- Activación y desactivación.
- Eliminación con indicaciones de retención.
- El superadministrador no se crea desde el formulario de alta; puede promoverse una cuenta existente desde la edición.
- Solo SA.

### 8.12 Seguimiento público

Ruta: `/seguimiento`.

- Formulario con placa y código de 6 dígitos.
- Acepta parámetros `?plate=` y `?code=`.
- Normaliza placa y código en el navegador.
- Timeout de 8 segundos.
- En desarrollo con acceso por red, intenta el backend local si el proxy falla.
- Barra de avance por etapas:
  - `COTIZACION_PENDIENTE` y `ESPERA_APROBACION` → “En taller”, 25%.
  - `ESPERA_REPUESTOS` → “Espera de repuestos”, 50%.
  - `EN_REPARACION` → “En reparación”, 75%.
  - `LISTA_PARA_ENTREGA` → “Listo para entregar”, 100%.
- `ENTREGADA` y `CANCELADA` muestran un mensaje terminal.
- La propia interfaz aclara que la barra representa la etapa alcanzada, no el porcentaje físico de reparación.

### 8.13 Documentos generados en el navegador

| Documento | Contenido | Formato |
|---|---|---|
| Recepción | Datos, checklist, consideraciones, daños, evidencias y firma. | PDF A4 |
| Cotización | Membrete, cliente, vehículo, partidas, total sin IGV y moneda. | PDF |
| Cotización | Mismas partidas para análisis. | XLSX |
| Orden de trabajo | Datos del caso y partidas aprobadas. | PDF |
| Acta de conformidad | Datos del servicio y conformidad. | PDF |
| Reportes | Filas filtradas. | CSV/PDF |

Características:

- Se generan con jsPDF, autotable, svg2pdf y ExcelJS.
- No se guardan en el servidor.
- No se pueden recuperar desde la API.
- El membrete corporativo es fijo en el código.
- La descarga depende de que el navegador permita crear el archivo.
- No se documentan precios concretos ni condiciones comerciales.

### 8.14 Caché, estado y sincronización

Configuración de TanStack Query:

- `staleTime`: 15 segundos.
- `gcTime`: 5 minutos.
- Reintento: una vez para errores de red o 5xx; no para 4xx.
- Mutaciones: sin reintento.
- `refetchOnWindowFocus`: activo.
- No hay polling ni intervalos.

Claves:

```text
["session", userId, mode, resource, path]
```

- `mode` es `production` o `demo`.
- Las consultas de una sesión no se mezclan con otra.
- Los cambios de orden invalidan `orders`, `reports`, `navigation-summary` y `pending-notifications`.
- Login, logout y cambio de demo limpian toda la caché.
- Los borradores (`reception-draft`, `quote-draft`) no se invalidan como listados.

Almacenamiento local:

- `localStorage`: tamaño de barra lateral.
- `sessionStorage`: recordatorio de pendientes ya mostrado.
- IndexedDB: borrador de recepción y archivos multimedia.
- No se guardan tokens en JavaScript; la sesión es una cookie `HttpOnly`.

### 8.15 Accesibilidad y adaptación

- Formularios con etiquetas asociadas.
- Botones con texto o `aria-label`.
- Diálogos y paneles con foco inicial y cierre con `Escape`.
- Mensajes de error con `role="alert"` en los flujos principales.
- Navegación móvil inferior y tablas convertidas en tarjetas.
- Estados de carga y vacío visibles.
- No se declara una certificación WCAG formal.

### 8.16 Limitaciones de la interfaz

- No hay URLs para compartir una orden o un reporte.
- Recargar vuelve al panel.
- No hay edición de la recepción original.
- Hay cambio de contraseña propio y restablecimiento por superadministrador, pero no recuperación automática.
- No hay notificaciones push, correo o SMS.
- La cotización no tiene autosave.
- La bandeja de auditoría no pagina.
- Los documentos no quedan archivados en el servidor.

---

## 9. Flujos y máquinas de estado

### 9.1 Estados internos de la orden

| Estado | Significado operativo |
|---|---|
| `COTIZACION_PENDIENTE` | Orden recibida; falta crear/enviar cotización. |
| `ESPERA_APROBACION` | Cotización enviada; se espera decisión del cliente. |
| `ESPERA_REPUESTOS` | Cotización aprobada con repuestos; falta recibirlos. |
| `EN_REPARACION` | Trabajo de reparación en curso o habilitado. |
| `LISTA_PARA_ENTREGA` | Control final completado. |
| `ENTREGADA` | Vehículo entregado; caso cerrado. |
| `CANCELADA` | Caso cancelado; sin flujo operativo posterior. |

### 9.2 Transiciones válidas

La tabla `order_status_transitions` define exactamente:

| Origen | Destino | Disparador en la API |
|---|---|---|
| `COTIZACION_PENDIENTE` | `ESPERA_APROBACION` | Enviar cotización. |
| `COTIZACION_PENDIENTE` | `CANCELADA` | Sin endpoint; solo transición declarada. |
| `ESPERA_APROBACION` | `ESPERA_REPUESTOS` | Aprobar cotización con repuestos. |
| `ESPERA_APROBACION` | `EN_REPARACION` | Aprobar cotización sin repuestos. |
| `ESPERA_APROBACION` | `CANCELADA` | Sin endpoint. |
| `ESPERA_REPUESTOS` | `EN_REPARACION` | Iniciar reparación con repuestos completos. |
| `ESPERA_REPUESTOS` | `CANCELADA` | Sin endpoint. |
| `EN_REPARACION` | `LISTA_PARA_ENTREGA` | Completar control final. |
| `EN_REPARACION` | `CANCELADA` | Sin endpoint. |
| `LISTA_PARA_ENTREGA` | `ENTREGADA` | Registrar entrega. |
| `LISTA_PARA_ENTREGA` | `EN_REPARACION` | Reabrir control final. |
| `LISTA_PARA_ENTREGA` | `CANCELADA` | Sin endpoint. |

No hay transición desde `ENTREGADA` ni desde `CANCELADA`.

### 9.3 Diagrama interno

```text
                    +------------------------+
                    | COTIZACION_PENDIENTE   |
                    +-----------+------------+
                                |
                        enviar cotización
                                |
                                v
                    +------------------------+
                    | ESPERA_APROBACION      |
                    +------+----------+------+
                           |          |
             aprobar con   |          |   aprobar sin
             repuestos     |          |   repuestos
                           v          v
             +------------------+  +------------------+
             | ESPERA_REPUESTOS |  | EN_REPARACION    |
             +--------+---------+  +--------+---------+
                      |                     ^
        repuestos     |                     |
        completos     +---------------------+
        + iniciar reparación
                      |
                      v
             +------------------+
             | EN_REPARACION    |
             +--------+---------+
                      |
             completar control final
                      |
                      v
             +------------------+
             | LISTA_PARA_ENTREGA |
             +---+----------+---+
                 |          |
        reabrir  |          |  entregar
                 v          v
          EN_REPARACION   ENTREGADA

CANCELADA: estado declarado, sin endpoint de cancelación.
```

### 9.4 Estado público

El estado público es independiente del interno, aunque se actualiza en los mismos flujos:

| Acción | Estado interno | Estado público |
|---|---|---|
| Crear orden | `COTIZACION_PENDIENTE` | `COTIZACION_PENDIENTE` |
| Enviar cotización | `ESPERA_APROBACION` | `ESPERA_APROBACION` |
| Aprobar con repuestos | `ESPERA_REPUESTOS` | `ESPERA_REPUESTOS` |
| Aprobar sin repuestos | `EN_REPARACION` | `EN_REPARACION` |
| Iniciar reparación | `EN_REPARACION` | `EN_REPARACION` |
| Completar control final | `LISTA_PARA_ENTREGA` | `EN_REPARACION` |
| Publicar listo | `LISTA_PARA_ENTREGA` | `LISTA_PARA_ENTREGA` |
| Reabrir control | `EN_REPARACION` | `EN_REPARACION` |
| Entregar | `ENTREGADA` | `ENTREGADA` |

Esto explica por qué completar el control final no cambia el seguimiento público hasta que se publica explícitamente.

### 9.5 Máquina de cotización

```text
PENDIENTE --enviar--> ENVIADA --aprobar--> APROBADA
    |                    |
    | nueva versión      | nueva versión
    v                    v
REEMPLAZADA          REEMPLAZADA
```

Reglas:

- La primera versión nace `PENDIENTE`.
- Una versión `PENDIENTE` puede editarse o eliminarse.
- Una versión `ENVIADA` no se edita ni se elimina.
- Una versión `APROBADA` no se edita, elimina ni reemplaza.
- Crear una nueva versión marca la anterior como `REEMPLAZADA`; desde la segunda se exige motivo.
- Solo puede existir una versión vigente en la práctica; el historial conserva las anteriores.
- No existe estado `RECHAZADA`.
- El total no incluye IGV y se guarda en el snapshot.
- Las líneas de repuesto se convierten en `order_parts` al aprobar.

### 9.6 Máquina de repuestos

```text
POR_GESTIONAR --actualizar--> PEDIDO --recibir--> EN_TALLER
       |                         |                 |
       +-------------------------+-----------------+
                     recepción completa
                            |
                            v
                     estado visible RECIBIDO
                     (derivado, no almacenado)
```

- `RECIBIDO` no es un valor de `management_status`; se calcula cuando `receivedQuantity >= quantity`.
- La recepción puede ser parcial; no existe bandera de recepción parcial operativa.
- La recepción completa fuerza `EN_TALLER`.
- La cantidad recibida no puede superar la solicitada.
- Iniciar reparación exige que no quede ningún repuesto pendiente.
- No hay inventario ni descuento de stock.

### 9.7 Máquina de control final

```text
Sin control
    |
    | verificar toda la mano de obra
    | y recibir todos los repuestos
    v
Control completado (completed_at)
    |
    | publicar
    v
Publicado (published_at, public_status = LISTA)
    |
    | entrega con conformidad
    v
Entregado (delivered_at)

Control completado
    |
    | reabrir con motivo
    v
Sin control (completed_at y published_at limpios)
```

Condiciones:

- Completar exige cotización aprobada, cero repuestos pendientes, al menos una partida de mano de obra y todas verificadas.
- La transición interna a `LISTA_PARA_ENTREGA` solo es legal desde `EN_REPARACION`; el trigger impide saltar desde `ESPERA_REPUESTOS`.
- Publicar exige control completado.
- Entregar exige publicación previa y conformidad literal.
- No se reabre una orden entregada.
- No se modifica la verificación si el control está completo; primero se reabre.

### 9.8 Recepción, borrador y creación

```text
Formulario
   |
   +--> borrador local inmediato
   |
   +--> borrador remoto con debounce
   |
   +--> validación de pasos
   |
   +--> POST /orders
          |
          +--> orden + recepción + snapshot + firma
          |
          +--> subida de evidencias
                 |
                 +--> éxito -> limpiar borradores -> listado
                 |
                 +--> fallo -> orden creada; reintentar cargas
```

- El borrador remoto se guarda por usuario.
- La revisión detecta edición concurrente.
- La orden no se puede crear si falta un ítem del checklist, la revisión, la aceptación o la firma.
- La firma y la recepción se guardan en la misma transacción de creación.
- Las evidencias se suben después; si fallan, la orden ya existe y no se debe volver a crear.

### 9.9 Cancelación

`CANCELADA` está declarada en las transiciones y la UI la muestra como estado de solo lectura. No existe endpoint, botón ni servicio que cancele una orden. Por tanto:

- No se puede cancelar desde la aplicación.
- Una orden cancelada solo podría aparecer por intervención directa en base de datos o por datos históricos.
- No se define reapertura desde `CANCELADA`.

### 9.10 Estados terminales y guardas

| Operación | Guarda principal |
|---|---|
| Crear cotización | Orden no terminal. |
| Editar/eliminar cotización | Orden no terminal; versión `PENDIENTE`. |
| Enviar/aprobar | Orden no terminal; estado de cotización correcto. |
| Actualizar repuesto | No vuelve a comprobar el estado terminal de la orden. |
| Actualizar logística | No vuelve a comprobar el estado terminal de la orden. |
| Iniciar reparación | Orden en espera de repuestos o en reparación. |
| Verificar mano de obra | No entregada; control no completado sin reapertura. |
| Completar control | Orden no terminal y distinta de lista. |
| Publicar | Control completo y orden lista. |
| Entregar | Orden lista y pública lista. |
| Corregir datos | Orden no terminal. |

La actualización de repuestos y logística depende de la interfaz para no ofrecerse en órdenes cerradas; la API no repite esa validación. Es una de las deudas técnicas identificadas en la sección 14.

---

## 10. Validaciones y reglas de negocio

### 10.1 Capas de validación

```text
Navegador
  - HTML required/min/max/pattern
  - Validación de pasos del wizard
  - Confirmación de placa no reconocida
  - Límites de archivos y cantidad
        |
        v
API - Zod
  - Forma, tipos, longitudes, enums
  - Normalización compartida
        |
        v
Servicios y repositorios
  - Invariantes de negocio
  - Estado, permisos, versiones, cantidades
        |
        v
MariaDB
  - Claves foráneas, únicas
  - Triggers de estado y roles
```

Los errores de Zod se reducen a `VALIDATION_ERROR`. Las reglas de negocio tienen códigos específicos.

### 10.2 Matriz de recepción

| Campo o regla | Backend | Cliente |
|---|---|---|
| Tipo de documento | `DNI` o `RUC`. | Selector. |
| DNI | Exactamente 8 dígitos. | Máscara numérica y longitud. |
| RUC | Exactamente 11 dígitos. | Máscara numérica y longitud. |
| Nombre / razón social | 3 a 160; normalización de espacios y título. | Requerido. |
| Teléfono | Si existe, 7 a 15 dígitos. | Requerido según flujo; longitud. |
| Correo | Si existe, formato lineal: un `@`, sin espacios, dominio con punto. | Tipo email. |
| Placa | Normaliza; 5 a 9 caracteres. | Reconoce formatos peruanos y advierte si no coincide. |
| Marca / modelo | 1 a 80; mayúsculas. | Requeridos. |
| Color | 2 a 60. | Requerido. |
| Tipo de color | `CATALOGO` o `PERSONALIZADO`. | Selector. |
| Año | 1900 a 2099. | Numérico. |
| VIN | Si existe, 17 caracteres en el contrato; se normaliza a alfanumérico mayúsculas. | Campo de 17. |
| Kilometraje | 0 a 9,999,999. | Numérico. |
| Combustible | 0, 25, 50, 75 o 100. | Selector. |
| Consideraciones | Máximo 30, cada una de 1 a 300. | Banderas y texto libre. |
| Daños | Máximo 100; cuerpo V1-V4; vista 01-05; trazo mínimo 1 punto. | Canvas. |
| Diagnóstico | Máximo 10,000 caracteres. | Texto. |
| Legibilidad | `PENDIENTE`, `LEGIBLE`, `ILEGIBLE`. | Selector. |
| Revisión | `PENDIENTE_REVISION`, `REVISADA`. | Selector. |
| Checklist | Debe contener exactamente todos los ítems activos. | No permite avanzar si falta uno. |
| Firma | Data URL PNG. | Canvas obligatorio. |
| Revisión del checklist | Literal `true`. | Checkbox. |
| Términos | Literal `true`. | Checkbox. |
| Siniestro particular | Prohibido. | Se limpia al elegir particular. |
| Siniestro aseguradora | Número o pendiente, nunca ambos. | Valida en UI. |
| Diagnóstico pendiente | Booleano. | Checkbox. |

Nota: la API no aplica `isRecognizedPlate` al crear la orden. Una placa normalizada de 5 a 9 caracteres puede aceptarse aunque no coincida con un patrón peruano; la advertencia vive en el wizard.

### 10.3 Matriz de cotización

| Regla | Comportamiento |
|---|---|
| Moneda | Solo `PEN` o `USD`. |
| Líneas | Mínimo 1. |
| Tipo de línea | `MANO_OBRA` o `REPUESTO`. |
| Categoría | Solo para mano de obra: `PLANCHADO`, `PINTURA`, `MECANICA`. |
| Descripción | 1 a 500. |
| Cantidad | Mayor que cero. |
| Precio unitario | Mayor o igual a cero. |
| `noParts` | Prohíbe líneas de repuesto. |
| IGV | Siempre 0. |
| Total | Suma de cantidad por precio. |
| Versión 1 | Sin motivo. |
| Versión 2 o superior | Motivo obligatorio, máximo 500. |
| Última versión aprobada | No se puede reemplazar. |
| Edición | Solo `PENDIENTE`. |
| Eliminación | Solo `PENDIENTE`. |
| Envío | Solo `PENDIENTE`. |
| Aprobación | Solo `ENVIADA`. |
| Repuestos | Se generan al aprobar, una fila por línea. |
| Rechazo | No existe. |

### 10.4 Matriz de repuestos

| Regla | Comportamiento |
|---|---|
| Cantidad recibida | Entre 0 y la cantidad solicitada. |
| Proveedor | Debe existir y estar activo si se informa. |
| Estado de gestión | `POR_GESTIONAR`, `PEDIDO`, `EN_TALLER`. |
| Calidad | `ORIGINAL` o `ALTERNATIVO`. |
| Fecha estimada | Fecha ISO o vacía. |
| Notas | Máximo 4,000. |
| Recepción completa | Fuerza `EN_TALLER`. |
| Estado visible recibido | Derivado, no almacenado. |
| Inicio de reparación | Requiere cotización aprobada y cero pendientes. |
| Stock | No se descuenta. |

### 10.5 Matriz de control final

| Regla | Comportamiento |
|---|---|
| Cotización aprobada | Obligatoria. |
| Repuestos | Todos recibidos. |
| Mano de obra | Al menos una partida. |
| Verificación | Todas las partidas de mano de obra. |
| Partida ajena | Rechazada. |
| Control completo | No se modifica sin reapertura. |
| Reapertura | Motivo de 1 a 1,000; no entregada. |
| Publicación | Requiere control completo. |
| Entrega | Requiere publicación y `conformityAcknowledged: true`. |
| Reapertura tras entrega | Prohibida. |

### 10.6 Matriz de usuarios y setup

| Regla | Comportamiento |
|---|---|
| Bootstrap | Token, correo, cero usuarios, rol superadministrador. |
| Contraseña bootstrap | 12 a 128. |
| Contraseña de usuario | 12 a 128. |
| Cambio propio | Exige contraseña actual y nueva; la nueva debe tener 12 a 128. |
| Restablecimiento por SA | Nueva contraseña de 12 a 128; no exige la anterior. |
| Usuario | 3 a 80; letras, números, punto, guion y guion bajo. |
| Nombre | 3 a 120. |
| Correo de usuario | Formato email, máximo 150. |
| Rol en creación | Solo `ADMINISTRADOR` o `ASESOR`. |
| Rol en edición | `ADMINISTRADOR`, `ASESOR` o `SUPERADMINISTRADOR`. |
| Rol propio | La interfaz lo oculta; la API no impone una guarda específica. |
| Duplicados | Usuario o correo existente. |
| Autodesactivación | Prohibida. |
| Autodestrucción | Prohibida. |
| Último superadministrador | No se elimina. |
| Retención | 30 días si hay historial o cuenta antigua. |
| Anonimización | Conserva referencias, elimina acceso. |
| Sesiones tras contraseña | No se revocan automáticamente. |

### 10.7 Matriz de archivos

| Regla | Comportamiento |
|---|---|
| Formatos | JPEG, PNG, WEBP. |
| Tamaño | Máximo 5 MB. |
| Cantidad | Una imagen por solicitud. |
| Evidencias del wizard | Máximo 15 en la interfaz. |
| MIME | Debe coincidir con los bytes mágicos. |
| Categoría | `RECEPCION`, `DANIO`, `EVALUACION_MANUSCRITA`, `OTRO`. |
| Almacenamiento | Local privado o S3/R2. |
| SHA-256 | Se calcula y guarda. |
| Antivirus | No implementado. |
| Reprocesamiento | No implementado. |
| Borrado | No hay endpoint. |

### 10.8 Matriz de listados y reportes

| Regla | Comportamiento |
|---|---|
| Página | Entero positivo. |
| Tamaño | 10, 20 o 30. |
| Búsqueda | Hasta 200 caracteres. |
| Fechas | ISO; `from` inclusivo y `to` inclusivo por día. |
| Antigüedad de órdenes | 0-2, 3-5, más de 5 días. |
| Antigüedad de repuestos | Vencido, próximos 3 días, sin fecha. |
| Estado de repuesto | Derivado `RECIBIDO` cuando corresponde. |
| Exportación | Todas las filas del filtro, sin paginar. |
| Reportes | Solo SA/ADM. |
| Auditoría | Máximo 200 eventos. |

### 10.9 Normalizaciones compartidas

`shared/src/index.ts` implementa:

- `collapseWhitespace`: colapsa espacios.
- `toTitleCase`: normaliza nombres con locale `es-PE`.
- `normalizePlate`: elimina separadores, convierte a mayúsculas y aplica formatos.
- `isRecognizedPlate`: reconoce patrones peruanos.
- `isReceptionEmail`: validación lineal de correo.
- Conversión de documentos a dígitos.
- Conversión de año y kilometraje a número.

Formatos de placa reconocidos por el cliente:

```text
EPA-123
E ABC-123 o E AB-123
CD-0123 o CC-0123
PR-123
AB-1234 o AB-12345
A1B-123 o A1B-1234
ABC-123 o ABC-1234
```

La normalización del backend es más permisiva: elimina separadores y exige 5 a 9 caracteres.

### 10.10 Reglas transversales

- Toda orden nace en `COTIZACION_PENDIENTE`.
- Toda cotización nace `PENDIENTE`.
- Toda aprobación con repuestos crea las filas de repuesto.
- Todo repuesto nace `POR_GESTIONAR`.
- Toda entrega exige publicación y conformidad.
- Ninguna operación de negocio elimina una orden.
- Ninguna recepción se reescribe.
- Ningún cambio de estado puede saltarse la tabla de transiciones.
- Los errores de validación no revelan el esquema completo al cliente.
- Las operaciones que cambian estado registran auditoría.

---

## 11. Seguridad, privacidad y auditoría

### 11.1 Autenticación

- Login por usuario o correo.
- Contraseña verificada con Argon2id.
- Token de sesión aleatorio de 32 bytes.
- En base de datos solo se guarda el hash SHA-256 del token.
- Cookie `parautos_session` con `HttpOnly`, `SameSite=Lax`, `Secure` en producción y TTL configurable.
- La sesión se valida contra usuario activo y rol activo.
- El logout revoca la sesión.
- El cambio de contraseña propio exige la contraseña actual y una nueva de 12 a 128 caracteres.
- El superadministrador puede restablecer la contraseña de otra cuenta sin conocer la anterior.
- No hay MFA ni recuperación automática por correo.
- Cambiar o restablecer la contraseña no revoca las sesiones abiertas.
- No hay bloqueo permanente de cuenta; se aplica rate limit y retardo progresivo.

La sesión se toca en cada lectura (`last_seen_at`), pero el vencimiento es absoluto según `expires_at`; no se extiende indefinidamente.

### 11.2 Autorización y matriz RBAC

| Capacidad | SA | ADM | ASE |
|---|:---:|:---:|:---:|
| Panel principal | Sí | Sí | Sí |
| Crear orden y recepción | Sí | Sí | Sí |
| Ver todas las órdenes | Sí | Sí | Sí |
| Corregir datos operativos | Sí | Sí | Sí |
| Crear/enviar/aprobar cotizaciones | Sí | Sí | Sí |
| Gestionar repuestos y logística | Sí | Sí | Sí |
| Iniciar reparación | Sí | Sí | Sí |
| Control final, publicación y entrega | Sí | Sí | Sí |
| Subir y ver adjuntos | Sí | Sí | Sí |
| Reportes operativos | Sí | Sí | No |
| Auditoría | Sí | Sí | No |
| Cambiar la contraseña propia | Sí | Sí | Sí |
| Administrar, editar y restablecer cuentas | Sí | No | No |
| Modo demo | Sí | No | No |
| Configuración inicial | Solo con token y sin usuarios | No | No |

Puntos importantes:

- No hay aislamiento por asesor: cualquier usuario operativo puede ver y operar cualquier orden.
- No hay separación de funciones entre quien cotiza, aprueba, controla y entrega.
- El frontend oculta opciones, pero la API es la que aplica `requireRoles`.
- El superadministrador no se crea con `POST /users`; el bootstrap crea el primero y un SA puede promover una cuenta existente con `PUT /users/:userId`.
- La API permite que un SA se cambie el rol a sí mismo; la interfaz no muestra esa opción.

### 11.3 CSRF, CORS y origen

- No hay token CSRF explícito.
- La cookie usa `SameSite=Lax`, lo que reduce envíos cross-site en navegadores modernos.
- CORS se restringe a `APP_ORIGIN` y permite credenciales.
- Los cuerpos de la API son JSON, excepto la carga multipart de adjuntos.
- La aplicación se sirve en el mismo origen que la API.
- `trust proxy` está fijado en 1; el despliegue debe tener exactamente un proxy delante para que la IP usada por rate limit sea confiable.

Riesgo residual: una integración futura que requiera POST cross-site o un despliegue con un proxy mal configurado podría debilitar estas mitigaciones.

### 11.4 Inyección SQL

- Las consultas usan parámetros `?`.
- Los fragmentos dinámicos se limitan a listas blancas de columnas, tipos de listado y nombres de tabla internos.
- No se interpola entrada de usuario en SQL.
- No hay ORM que oculte la construcción de consultas.
- La auditoría guarda JSON, no SQL ejecutado.

### 11.5 XSS y contenido

- React escapa el contenido por defecto.
- No se usa `dangerouslySetInnerHTML` ni `innerHTML` en el código revisado.
- Helmet aplica cabeceras de seguridad, incluida su política CSP por defecto.
- Los documentos PDF se generan con APIs de jsPDF, no con HTML del usuario.
- Los nombres de archivo se sirven con `Content-Disposition` manejado por Express.
- Las imágenes se validan por MIME y bytes mágicos, pero no se reprocesan.

### 11.6 Carga de archivos

Controles:

- Memoria, no disco temporal de Multer.
- Una sola imagen por solicitud.
- Límite de 5 MB.
- Formatos permitidos.
- Validación de MIME declarado y firma binaria.
- Nombre de objeto generado con fecha y UUID.
- SHA-256 y tamaño guardados.
- Almacenamiento privado; la lectura pasa por la API autenticada.
- La firma se guarda como PNG.

Ausencias:

- Sin antivirus.
- Sin análisis de contenido.
- Sin recompresión.
- Sin límite de resolución o dimensiones.
- Sin borrado de adjuntos desde la API.
- Sin URLs firmadas de corta duración.

### 11.7 Datos personales

Datos tratados:

- Documento de identidad.
- Nombre o razón social.
- Teléfono y correo.
- Placa, VIN, marca, modelo, color y año.
- Siniestro.
- Evidencias fotográficas.
- Firma del cliente.
- Observaciones y diagnóstico.
- Datos de usuario del sistema.

Controles:

- Acceso interno autenticado.
- Roles para reportes, auditoría y usuarios.
- Tracking público limitado a orden, vehículo y estado.
- Logs técnicos sin cuerpos ni datos personales.
- Auditoría con antes/después y acceso restringido.
- Almacenamiento privado de archivos.

Riesgos:

- La auditoría puede contener teléfono, correo o siniestro en JSON.
- No hay cifrado de aplicación sobre columnas sensibles.
- No hay política automática de retención de datos de negocio.
- Las sesiones expiradas no se purgan automáticamente.
- La base y los archivos dependen de las copias de seguridad de la infraestructura.

### 11.8 Auditoría

Eventos funcionales observados:

- `CREATED`
- `CLAIM_COMPLETED`
- `DIAGNOSIS_UPLOADED`
- `OPERATIONAL_DATA_CORRECTED`
- `QUOTE_CREATED`
- `QUOTE_UPDATED`
- `QUOTE_DELETED`
- `QUOTE_SENT`
- `QUOTE_APPROVED`
- `PART_UPDATED`
- `PARTS_LOGISTICS_UPDATED`
- `REPAIR_STARTED`
- `LABOR_VERIFIED`
- `LABOR_VERIFICATION_REMOVED`
- `ALL_LABOR_VERIFIED`
- `ALL_LABOR_VERIFICATIONS_REMOVED`
- `FINAL_CONTROL_COMPLETED`
- `FINAL_CONTROL_REOPENED`
- `READY_FOR_PICKUP_PUBLISHED`
- `ORDER_DELIVERED`

Eventos administrativos y de seguridad:

- `BOOTSTRAP_ADMIN_CREATED`
- `USER_CREATED`
- `USER_UPDATED`
- `PASSWORD_CHANGED`
- `USER_ACTIVATED`
- `USER_DEACTIVATED`
- `USER_ANONYMIZED`
- `USER_DELETED`
- Eventos de rate limit.

Cada evento guarda, según el caso:

- Actor.
- Entidad y ID de registro.
- Acción.
- Datos previos y nuevos.
- Request ID.
- IP.
- User agent.
- Fecha UTC.

La consulta de auditoría devuelve como máximo 200 eventos y no tiene paginación ni exportación.

### 11.9 Logs técnicos

- Logger Pino.
- Se registra método, ruta, estado y duración.
- Se registra el request ID.
- Los fallos internos se registran con detalle técnico del lado servidor.
- La respuesta al cliente no expone stack ni SQL.
- No se registran contraseñas, tokens ni cuerpos completos.
- Los logs van a la salida estándar; la plataforma decide su retención.

### 11.10 Rate limits

| Ámbito | Límite |
|---|---|
| Login por IP | 20 por minuto. |
| Login por identificador | 5 por minuto. |
| Bootstrap por IP | 5 por minuto. |
| Bootstrap por correo | 3 por minuto. |
| Tracking público por IP | 10 por minuto. |

- Los intentos se guardan en `api_rate_limits`.
- La clave del cliente se almacena como hash SHA-256.
- Se aplica retardo progresivo en login y bootstrap, hasta 1500 ms.
- Los registros antiguos se podan periódicamente.
- Un login exitoso limpia el límite del identificador, no el de la IP.

### 11.11 Seguridad del modo demo

- Solo un superadministrador puede activarlo.
- Requiere `DEMO_MODE_ENABLED=true`.
- Usa `DEMO_DB_NAME` distinta de `DB_NAME`.
- Usa carpeta de uploads distinta.
- La cookie demo dura 8 horas.
- La sesión sigue viviendo en producción.
- El superadministrador se replica en demo para claves foráneas.
- La purga solo borra placas `DM####`.
- La purga exige conexión activa exactamente igual a `DEMO_DB_NAME`.
- Sin `DEMO_PURGE_CONFIRM=PURGE`, la purga es simulación.

### 11.12 Riesgos residuales

1. No hay token CSRF explícito.
2. No hay antivirus ni recompresión de imágenes.
3. No hay MFA ni recuperación automática de contraseña.
4. Cambiar o restablecer la contraseña no revoca las sesiones existentes.
5. No hay cifrado de aplicación para datos personales.
6. No hay aislamiento por asesor ni separación de funciones.
7. La API de repuestos/logística no repite la guarda de orden terminal.
8. El rate limit depende de una configuración correcta de proxy.
9. El código público de 6 dígitos es una credencial de posesión, no una autenticación fuerte.
10. Las sesiones expiradas no se eliminan automáticamente.
11. El health check no verifica dependencias.
12. La auditoría tiene un límite fijo y no es exportable.
13. La política de retención de datos de negocio no está automatizada.

---

## 12. Operación y despliegue

### 12.1 Requisitos

| Elemento | Requisito |
|---|---|
| Node.js | 22.12 o superior. |
| MariaDB | 11.8.9 o compatible. |
| Almacenamiento | Carpeta privada persistente o bucket S3/R2. |
| Red | HTTPS en producción; salida a Factiliza solo si se usa la consulta externa. |
| Proxy | Un salto delante de Express para que `trust proxy 1` y la IP de rate limit sean correctas. |
| Navegador | Navegador moderno con soporte para canvas, IndexedDB, `fetch` y descargas. |

El servidor no requiere compiladores en tiempo de ejecución salvo la dependencia nativa `argon2`, que debe poder instalarse durante `npm install`. En Hostinger conviene validar que el entorno permita binarios/prebuilds compatibles con su versión de Node.

### 12.2 Puesta en marcha local

```bash
# 1. Dependencias
npm install

# 2. Configuración
# Copiar .env.example a .env y completar DB_*, BOOTSTRAP_ADMIN_EMAIL y
# BOOTSTRAP_ADMIN_TOKEN.

# 3. Esquema
npm run migrate

# 4. Desarrollo
npm run dev
```

Resultado:

- Cliente Vite: `http://localhost:5173`.
- API: `http://127.0.0.1:3000`.
- Proxy `/api` del cliente hacia la API.
- `predev` compila `shared` antes de arrancar.

La primera cuenta se crea desde la pantalla de configuración o con:

```bash
curl -X POST http://127.0.0.1:3000/api/v1/setup/initial \
  -H "Content-Type: application/json" \
  -d '{
    "token": "TOKEN_DE_BOOTSTRAP",
    "email": "admin@parautos.pe",
    "username": "admin.parautos",
    "names": "Administrador General",
    "password": "una-contraseña-larga"
  }'
```

Después del bootstrap:

1. Retirar `BOOTSTRAP_ADMIN_TOKEN` del entorno.
2. Mantener `BOOTSTRAP_ADMIN_EMAIL` porque el esquema de entorno lo exige.
3. Verificar que `/setup/status` devuelva `configured: true`.
4. Iniciar sesión y crear los usuarios operativos desde Usuarios.

### 12.3 Variables de entorno

#### Núcleo

| Variable | Obligatoria | Valor o rango | Uso |
|---|:---:|---|---|
| `NODE_ENV` | No | `development`, `test`, `production`; por defecto `development`. | Modo de ejecución y cookie segura. |
| `LOG_LEVEL` | No | `fatal` a `trace`, o `silent`; por defecto `info`. | Nivel de Pino. |
| `PORT` | No | 1 a 65535; por defecto 3000. | Puerto HTTP. |
| `APP_ORIGIN` | No | URL; por defecto `http://localhost:5173`. | Origen permitido por CORS. |
| `SESSION_TTL_HOURS` | No | 1 a 24; por defecto 8. | Duración absoluta de sesión. |

#### Base de datos principal

| Variable | Obligatoria | Valor o rango | Uso |
|---|:---:|---|---|
| `DB_HOST` | Sí | Texto. | Host MariaDB. |
| `DB_PORT` | No | 1 a 65535; por defecto 3306. | Puerto. |
| `DB_NAME` | Sí | Texto. | Base principal. |
| `DB_USER` | Sí | Texto. | Usuario. |
| `DB_PASSWORD` | Sí | Texto no vacío. | Contraseña. |
| `DB_CONNECTION_LIMIT` | No | 1 a 20; por defecto 5. | Conexiones del pool. |

#### Demo

| Variable | Obligatoria | Valor o rango | Uso |
|---|:---:|---|---|
| `DEMO_MODE_ENABLED` | No | `true` o `false`; por defecto `false`. | Habilita el modo demo. |
| `DEMO_DB_HOST` | Si demo activo | Texto. | Host de la base demo. |
| `DEMO_DB_PORT` | Si demo activo | 1 a 65535. | Puerto demo. |
| `DEMO_DB_NAME` | Si demo activo | Texto distinto de `DB_NAME`. | Base demo. |
| `DEMO_DB_USER` | Si demo activo | Texto. | Usuario demo. |
| `DEMO_DB_PASSWORD` | Si demo activo | Texto. | Contraseña demo. |
| `DEMO_LOCAL_UPLOAD_BASE` | Si demo activo | `project` o `home`. | Base de uploads demo. |
| `DEMO_LOCAL_UPLOAD_DIR` | Si demo activo | Ruta relativa. | Carpeta demo. |
| `DEMO_SEED_1000` | No | `false` omite la carga. | Carga masiva en despliegue. |
| `DEMO_PURGE_CONFIRM` | No | Vacío o `PURGE`. | Purga previa; vacío simula. |
| `DEMO_SEED_COUNT` | No | Entero; por defecto 1000. | Tamaño del lote de carga. |
| `DEMO_SEED_START` | No | Entero; por defecto 0. | Índice inicial para reanudar. |

`DEMO_LOCAL_UPLOAD_BASE` y `DEMO_LOCAL_UPLOAD_DIR` se exigen aunque el almacenamiento sea S3, porque el esquema de entorno las valida cuando demo está activo.

#### Almacenamiento

| Variable | Obligatoria | Valor o rango | Uso |
|---|:---:|---|---|
| `STORAGE_PROVIDER` | No | `local` o `s3`; por defecto `local`. | Proveedor. |
| `LOCAL_UPLOAD_BASE` | No | `project` o `home`; por defecto `project`. | Raíz de uploads. |
| `LOCAL_UPLOAD_DIR` | No | Ruta relativa sin `..`; por defecto `data/uploads`. | Carpeta de archivos. |
| `S3_ENDPOINT` | No | URL. | AWS S3, R2 u otro compatible. |
| `S3_REGION` | No | Texto; por defecto `auto`. | Región. |
| `S3_BUCKET` | Si S3 | Texto. | Bucket. |
| `S3_ACCESS_KEY_ID` | Si S3 | Texto. | Credencial. |
| `S3_SECRET_ACCESS_KEY` | Si S3 | Texto. | Credencial. |
| `S3_PREFIX` | No | Texto; por defecto `parautos`. | Prefijo de objetos. |
| `S3_FORCE_PATH_STYLE` | No | `true` o `false`; por defecto `false`. | Compatibilidad con algunos proveedores. |

#### Consulta externa y bootstrap

| Variable | Obligatoria | Valor o rango | Uso |
|---|:---:|---|---|
| `FACTILIZA_API_BASE_URL` | No | URL; por defecto `https://api.factiliza.com/v1`. | Base de Factiliza. |
| `FACTILIZA_API_TOKEN` | No | Texto. | Sin token, la consulta externa responde 503. |
| `FACTILIZA_API_TIMEOUT_MS` | No | 1,000 a 60,000; por defecto 15,000. | Timeout. |
| `BOOTSTRAP_ADMIN_EMAIL` | Sí | Email. | Correo autorizado para el bootstrap. |
| `BOOTSTRAP_ADMIN_TOKEN` | No | 32 a 512 caracteres. | Token de bootstrap; retirar tras usarlo. |

#### Despliegue y pruebas

| Variable | Obligatoria | Valor o rango | Uso |
|---|:---:|---|---|
| `DEPLOY_RUN_MIGRATIONS` | No | `true` para ejecutar migraciones en build. | Debe estar ausente en local. |
| `MIGRATION_TEST_DB_HOST` | Si pruebas de integración | Host local recomendado. | Cuenta de prueba. |
| `MIGRATION_TEST_DB_PORT` | Si pruebas de integración | Puerto. | Cuenta de prueba. |
| `MIGRATION_TEST_DB_USER` | Si pruebas de integración | Usuario con CREATE/DROP DATABASE. | Cuenta de prueba. |
| `MIGRATION_TEST_DB_PASSWORD` | Si pruebas de integración | Texto. | Cuenta de prueba. |

Nunca se deben usar credenciales de producción para `MIGRATION_TEST_DB_*`.

### 12.4 Build y artefactos

| Comando | Efecto |
|---|---|
| `npm run build:app` | Compila `shared`, `server` y `client`; no migra. |
| `npm run build` | Ejecuta `build:app` y luego `scripts/run-deploy-migrations.mjs`. |
| `npm run migrate` | Aplica migraciones a la base principal con `tsx`. |
| `npm run seed:demo` | Carga los cuatro casos demo base en la base principal. |
| `npm run seed:demo:1000` | Carga el lote `DM####`. |
| `npm run verify:demo:1000` | Verifica el lote sin modificarlo. |
| `npm run purge:demo:1000` | Purga el lote; sin confirmación solo simula. |
| `npm run seed:reports` | Carga datos para reportes. |
| `npm test` | Compila `shared`, ejecuta pruebas de servidor y cliente. |

Artefactos publicados:

- `shared/dist`: contratos compilados.
- `server/dist`: API compilada.
- `client/dist`: React compilado y assets.

El servidor compilado sirve `client/dist` desde una ruta relativa a `server/dist`. No se debe publicar solo una parte del build.

### 12.5 Migraciones

- Ubicación: `database/migrations`.
- Orden: nombre ordinal, no locale.
- Registro: `schema_migrations (version, applied_at)`.
- Aplicación: una por una; se omite la ya registrada.
- División de sentencias: el migrador conserva bloques `CREATE TRIGGER ... BEGIN ... END` como una sola sentencia.
- No hay migraciones “down”.
- No se edita una migración ya aplicada.
- Los cambios de esquema se hacen con un archivo nuevo.
- La base demo recibe las mismas migraciones cuando demo está activo.

Advertencia de atomicidad: el código abre transacción por archivo, pero MariaDB no hace transaccionales todas las operaciones DDL. Si una migración falla a mitad, pueden quedar cambios parciales aunque no se registre la versión. Antes de reintentar, revisar el esquema y restaurar una copia si es necesario.

### 12.6 Despliegue en Hostinger

Secuencia recomendada:

1. **Respaldar** MariaDB y la carpeta/bucket de archivos.
2. **Verificar** que el repositorio esté en el commit deseado.
3. **Configurar** las variables de producción, incluida `DEPLOY_RUN_MIGRATIONS=true`.
4. **Mantener** el comando de build `npm run build`.
5. **Iniciar** el proceso con `node server/dist/server.js` o `npm start --workspace @parautos/server`.
6. **Confirmar** que el proxy apunte al puerto de `PORT`.
7. **Verificar** health, login, una lectura y una escritura controlada.

Qué hace el build de despliegue:

```text
npm run build
  |
  +--> build:app
  |      +--> shared/dist
  |      +--> server/dist
  |      +--> client/dist
  |
  +--> run-deploy-migrations.mjs
         |
         +--> ¿DEPLOY_RUN_MIGRATIONS=true?
                |
                +-- no --> fin, solo compiló
                |
                +-- sí --> migrate principal
                           |
                           +--> ¿DEMO_MODE_ENABLED=true?
                                  |
                                  +-- no --> fin
                                  |
                                  +-- sí --> migrate demo
                                             seed demo base
                                             ¿DEMO_SEED_1000=false?
                                                |
                                                +-- sí --> fin
                                                |
                                                +-- no --> ¿DEMO_PURGE_CONFIRM=PURGE?
                                                             |
                                                             +-- sí --> purgar DM####
                                                             +--> cargar 1,000 casos
```

Reglas de despliegue:

- `DEPLOY_RUN_MIGRATIONS=true` solo en el entorno de despliegue.
- Las migraciones se aplican **antes** de publicar la nueva versión.
- La aplicación anterior puede seguir sirviendo mientras se aplican; por eso los cambios de esquema deben ser compatibles hacia atrás.
- Si el build falla, el proveedor debe conservar la versión anterior. Las migraciones ya aplicadas no se revierten solas.
- La carga demo añade varios minutos al build; en el entorno documentado se observaron aproximadamente 3 a 5 minutos.
- Si se deja `DEMO_PURGE_CONFIRM=PURGE`, **cada despliegue** purga y recarga el lote ficticio.
- Si no se define, la carga es idempotente por placa y no refresca nombres ni fechas.
- Si `DEMO_SEED_1000=false`, no se purga ni se carga el lote.

### 12.7 Almacenamiento de archivos

#### Local

```text
LOCAL_UPLOAD_BASE=project
LOCAL_UPLOAD_DIR=data/uploads
        |
        v
<cwd>/data/uploads/<fecha>/<uuid>.<ext>
```

- `project` resuelve desde `process.cwd()`.
- `home` resuelve desde `$HOME`.
- La ruta debe ser relativa y sin `..`.
- En Hostinger se recomienda `LOCAL_UPLOAD_BASE=home` y una carpeta privada fuera de `public_html`.
- La carpeta debe persistir entre despliegues.
- Debe estar incluida en las copias de seguridad.

#### S3/R2

- `STORAGE_PROVIDER=s3`.
- `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` obligatorios.
- `S3_ENDPOINT` para R2 u otro compatible; opcional para AWS.
- `S3_REGION=auto` para R2.
- `S3_PREFIX` separa los objetos.
- La credencial debe limitarse a `PutObject`, `GetObject` y `DeleteObject` sobre el prefijo.
- El bucket no debe ser público.

#### Ciclo de un archivo

```text
Multipart
  |
  +--> validación de tipo, tamaño y bytes
  +--> SHA-256
  +--> almacenamiento
  +--> INSERT attachments
  |
  +--> lectura: GET /attachments/:id/content
  +--> borrado: solo procesos internos o purga demo
```

No existe un endpoint de borrado de adjuntos. La purga demo elimina archivos de las órdenes `DM####`.

### 12.8 Ciclo de vida del modo demo

#### Habilitación

1. Crear una base distinta de la principal.
2. Definir todas las variables `DEMO_DB_*`.
3. Definir `DEMO_LOCAL_UPLOAD_BASE` y `DEMO_LOCAL_UPLOAD_DIR`.
4. Poner `DEMO_MODE_ENABLED=true`.
5. Aplicar migraciones a la base demo.
6. Cargar el seed base.
7. Opcionalmente cargar el lote de 1,000.

Comandos locales, usando los scripts compilados o `tsx`:

```bash
node --import tsx server/src/db/migrate-demo.ts
node --import tsx server/src/db/seed-demo-environment.ts
npm run seed:demo:1000
```

#### Uso

- Solo un superadministrador puede entrar.
- La cookie demo dura 8 horas.
- El ámbito demo cambia el pool y la carpeta de uploads.
- La sesión sigue en producción.
- El superadministrador se replica en demo para las claves foráneas.
- Salir elimina la cookie y recarga la aplicación.

#### Purga

```bash
# Simulación
npm run purge:demo:1000

# Ejecución en PowerShell
$env:DEMO_PURGE_CONFIRM="PURGE"; npm run purge:demo:1000; Remove-Item Env:DEMO_PURGE_CONFIRM
```

Salvaguardas obligatorias:

1. `DEMO_MODE_ENABLED=true`.
2. `DEMO_DB_NAME` distinto de `DB_NAME`.
3. La conexión activa debe ser exactamente `DEMO_DB_NAME`.
4. `DEMO_PURGE_CONFIRM=PURGE` para ejecutar.
5. Solo placas `^DM[0-9]+$`.

La purga no toca `DEM-101`, `DEM-202`, `DEM-303` ni `DEM-404`.

### 12.9 Health checks y observabilidad

`GET /api/v1/health` devuelve `{ "status": "ok" }` si el proceso responde. No comprueba:

- MariaDB.
- Espacio en disco.
- Bucket S3/R2.
- Factiliza.
- Migraciones pendientes.

Por eso se recomienda un chequeo sintético externo que, además del health, valide:

1. Una consulta de lectura autenticada o pública controlada.
2. Que el proceso pueda abrir conexión a MariaDB.
3. Que exista espacio suficiente para uploads.
4. Que el certificado HTTPS sea válido.
5. Que el login no esté bloqueado por rate limit.

Herramientas disponibles:

- Logs JSON de Pino en stdout.
- `X-Request-Id` en cada respuesta.
- Auditoría funcional en `audit_events`.
- Reportes de antigüedad y carga.

No hay métricas Prometheus, trazas distribuidas ni panel de errores integrado. La retención de logs depende del hosting.

### 12.10 Copias de seguridad y restauración

Deben respaldarse juntos:

1. MariaDB principal.
2. Carpeta local de uploads o bucket S3/R2.
3. Variables de entorno y secretos, en un almacén seguro separado.
4. Configuración del proxy y del proceso.

Recomendaciones:

- Frecuencia diaria como mínimo; ajustar al volumen de casos.
- Retención definida por negocio y normativa aplicable.
- Copia cifrada y acceso restringido.
- Prueba de restauración periódica, no solo verificación de que el backup existe.
- Para una restauración coherente, tomar la base y los archivos en una ventana de baja actividad o mediante snapshots del volumen.
- Conservar varias generaciones para recuperar ante corrupción lógica.

Restauración:

```text
1. Detener la aplicación.
2. Restaurar MariaDB.
3. Restaurar uploads en la misma raíz lógica.
4. Verificar variables de entorno.
5. Ejecutar migraciones pendientes si el backup es anterior.
6. Arrancar.
7. Validar login, orden, adjunto, reporte y tracking.
```

La base demo puede regenerarse; la base principal no. Nunca se debe restaurar una base demo sobre producción.

### 12.11 Runbook de incidentes

| Síntoma | Revisión inmediata | Acción |
|---|---|---|
| Health no responde | Proceso, puerto, proxy, logs. | Reiniciar el proceso; revisar build y variables. |
| 500 generalizado | Logs con `requestId`, conexión MariaDB, disco. | Restaurar dependencia; no borrar datos. |
| Login 429 | Rate limit por IP/identificador. | Esperar la ventana; revisar posibles ataques. |
| Login 401 masivo | Usuario/rol inactivo, cookie, HTTPS. | Reactivar cuenta o corregir dominio/cookie. |
| Adjuntos no cargan | Permisos de carpeta, disco, credenciales S3. | Corregir almacenamiento; no perder archivos. |
| Imágenes no se ven | `attachments` y objeto faltante. | Restaurar archivo desde backup; verificar purga. |
| Factiliza lenta | Timeout y estado externo. | La operación local sigue disponible; reintentar luego. |
| Migración falla en build | Log del script, versión aplicada, esquema. | No publicar; restaurar backup si hay cambios parciales. |
| Demo muestra datos raros | Cookie demo, base demo, lote `DM####`. | Salir de demo; verificar `DEMO_DB_NAME`; purgar y recargar. |
| Purga no borra | `DEMO_PURGE_CONFIRM`, `SELECT DATABASE()`. | Corregir salvaguarda; no forzar SQL manual. |
| Disco lleno | Uploads, logs, backups. | Liberar espacio con autorización; ampliar volumen. |
| Tracking no encuentra | Placa, código, estado público. | Verificar código en la orden y estado público. |

### 12.12 Lista de verificación de seguridad operativa

- HTTPS obligatorio en producción.
- Cookie `Secure` y proxy con un solo salto.
- `APP_ORIGIN` exacto, sin comodín.
- `BOOTSTRAP_ADMIN_TOKEN` retirado después del bootstrap.
- Contraseñas de base distintas entre producción y demo.
- Usuario de base con permisos mínimos.
- Bucket privado y credencial limitada al prefijo.
- Carpeta de uploads fuera de `public_html`.
- Backups cifrados y con prueba de restauración.
- `DEPLOY_RUN_MIGRATIONS` solo en despliegue.
- `DEMO_PURGE_CONFIRM=PURGE` solo si se desea refrescar el lote en cada build.
- Revisar auditoría de accesos y cambios de usuarios.
- Revisar dependencias y Quality Gate de SonarCloud.

### 12.13 Lista previa al despliegue

- [ ] `npm test` ejecutado en el commit a desplegar.
- [ ] `npm run build:app` compila sin errores.
- [ ] Migraciones nuevas revisadas y respaldadas.
- [ ] Variables de producción revisadas.
- [ ] Backup de base y archivos completado.
- [ ] Espacio en disco suficiente.
- [ ] Usuarios y roles verificados.
- [ ] `BOOTSTRAP_ADMIN_TOKEN` retirado si ya existe superadministrador.
- [ ] Configuración demo decidida: activa o desactivada, con o sin purga.
- [ ] Ventana de despliegue comunicada.

### 12.14 Lista posterior al despliegue

- [ ] `GET /api/v1/health` responde 200.
- [ ] Login de un administrador y un asesor.
- [ ] Panel y listado de órdenes cargan.
- [ ] Una orden existente abre detalle.
- [ ] Un adjunto existente se puede leer.
- [ ] Una carga de imagen de prueba funciona o se valida el error esperado.
- [ ] Reportes y auditoría abren con un administrador.
- [ ] Usuarios abre solo con superadministrador.
- [ ] Tracking público responde con un caso válido.
- [ ] Logs sin errores repetidos.
- [ ] Demo entra y sale correctamente, si está habilitado.
- [ ] Se confirma que no se purgaron datos reales.

### 12.15 Rollback

- El código puede volver al commit anterior.
- Las migraciones no tienen “down”; la base no se revierte automáticamente.
- Si la nueva versión requiere columnas o triggers nuevos, la versión anterior podría no funcionar correctamente tras una migración.
- Ante un fallo grave: restaurar backup de base y archivos, y desplegar el código anterior.
- No ejecutar SQL manual de reversión sin revisar dependencias y auditoría.
- La base demo se puede regenerar; la principal exige restore.

### 12.16 Capacidad y mantenimiento

- Un solo nodo de aplicación; no hay escalado horizontal coordinado.
- Pool por defecto de 5 conexiones, máximo configurable 20.
- La carga demo de 1,000 casos sirve para validar paginación y volumen.
- Cada recepción puede tener hasta 15 evidencias de 5 MB, más una evaluación manuscrita y una firma; dimensionar disco/bucket en consecuencia.
- La auditoría crece con cada acción y no se purga automáticamente.
- Las sesiones expiradas no se eliminan automáticamente.
- No hay tareas programadas en la aplicación.
- El mantenimiento de índices, estadísticas y backups corresponde a la operación de MariaDB.

---

## 13. Pruebas

### 13.1 Comando principal

```bash
npm test
```

Secuencia:

1. Compila `shared`.
2. Ejecuta Vitest en `server`.
3. Ejecuta Vitest en `client`.

No hay un script de cobertura en `package.json`, aunque `@vitest/coverage-v8` está disponible como dependencia de desarrollo. Si se necesita cobertura, debe invocarse Vitest con la opción correspondiente.

### 13.2 Inventario

| Métrica | Valor verificado |
|---|---:|
| Archivos `*.test.ts` / `*.test.tsx` | 59 |
| Declaraciones estáticas `it(...)` / `test(...)` | 136 |
| Casos reportados por Vitest | 184 (181 exitosos, 3 omitidos) |
| Archivos de prueba del servidor | 49 (48 ejecutados, 1 omitido) |
| Archivos de prueba del cliente | 10 |
| Archivos de prueba de `shared` | 0 |
| Archivos `*.integration.test.ts` | 5 |

La diferencia entre 136 declaraciones y 184 casos se explica por las pruebas parametrizadas (`it.each` y similares). La ejecución de referencia de este documento se hizo el 2026-10-28 con `npm test`.

Distribución principal del servidor:

| Área | Archivos |
|---|---:|
| Órdenes | 22 |
| Adjuntos | 6 |
| Middleware | 4 |
| Autenticación | 3 |
| Base de datos/migraciones | 3 |
| Tracking | 3 |
| Usuarios | 2 |
| Auditoría | 2 |
| Configuración | 1 |
| Raíz del servidor | 1 |
| Lookups | 1 |
| Logging | 1 |

### 13.3 Qué cubren las pruebas

**Servidor**

- Esquemas de recepción, cotización, repuestos, control final y usuarios.
- Normalización de placa, nombre, documento y correo.
- Creación de orden y snapshot.
- Transiciones de cotización.
- Repuestos y logística.
- Control final, reapertura, publicación y entrega.
- Paginación y filtros.
- Rate limit y seguridad de login.
- Manejo uniforme de errores.
- Migraciones y triggers.
- Rutas HTTP con dependencias simuladas.
- Almacenamiento local y S3.
- Validación de imágenes.
- Logs técnicos.

**Cliente**

- Funciones de numeración y redondeo de cotización.
- Generación y escapado de SVG de recepción.
- Borrador local.
- Cámara y recursos multimedia.
- Componentes de recepción.
- Manejo de errores de imagen.

**Integración**

- `migrate.integration.test.ts`: crea una base temporal, aplica las 25 migraciones, verifica triggers y que no se reapliquen.
- `auth`, `attachments`, `tracking` y `users`: rutas HTTP con servicios simulados, sin base real.

### 13.4 Pruebas reales de MariaDB

Variables:

```text
MIGRATION_TEST_DB_HOST
MIGRATION_TEST_DB_PORT
MIGRATION_TEST_DB_USER
MIGRATION_TEST_DB_PASSWORD
```

Requisitos:

- Cuenta de prueba con permiso para crear y eliminar bases temporales.
- Nunca usar credenciales de producción.
- La prueba crea una base `parautos_migration_test_<uuid>` y la elimina al finalizar.
- Si las variables no están presentes, la suite de migraciones se omite.

La prueba comprueba:

- Que se apliquen todas las migraciones una vez.
- Que `schema_migrations` coincida con los archivos.
- Que una segunda ejecución no duplique.
- Que existan las columnas y triggers esperados.

### 13.5 Verificación HTTP aislada

```bash
node --import tsx scripts/audit-local.mjs
```

Opcional:

```bash
node --import tsx scripts/audit-local.mjs --serve
```

Características:

- Exige `MIGRATION_TEST_DB_*`.
- Solo acepta hosts locales (`127.0.0.1`, `localhost`, `::1`).
- Crea dos bases temporales: principal y demo.
- Usa uploads temporales dentro de `docs/auditoria/.../tmp`.
- Crea usuarios sintéticos.
- Ejecuta un flujo HTTP completo.
- Elimina bases y archivos al terminar.
- `--serve` deja un servidor en `127.0.0.1:4180` para revisión visual.
- No importa la base `DB_NAME` de la aplicación.

No está expuesto como script npm; se ejecuta directamente con `tsx`.

### 13.6 Brechas de prueba

- No hay pruebas E2E de navegador real.
- No hay pruebas de carga o estrés versionadas.
- No hay umbral de cobertura ni reporte de cobertura en CI.
- No hay pipeline CI en `.github`.
- `shared` no tiene pruebas propias; se cubre indirectamente desde servidor y cliente.
- La suite de migraciones se omite silenciosamente si faltan variables.
- Las pruebas HTTP de rutas usan servicios simulados; no sustituyen una prueba completa contra MariaDB.
- No hay pruebas visuales de regresión.
- No hay prueba automatizada de restauración de backups.
- No hay prueba automatizada de accesibilidad.

### 13.7 Antes de desplegar

1. `npm test`.
2. `npm run build:app`.
3. Si hay cambios de esquema, `migrate.integration.test.ts` con una cuenta local.
4. Si hay cambios de flujo, `scripts/audit-local.mjs`.
5. Revisión manual de los flujos críticos en un entorno de staging o demo.

---

## 14. Mantenimiento, limitaciones y apéndices

### 14.1 Modelo de mantenimiento

El proyecto se mantiene como monolito modular. Para evitar divergencias:

- Los contratos de entrada se declaran una vez en `shared`.
- Las rutas no contienen SQL.
- Los repositorios no contienen reglas de presentación.
- Las migraciones son append-only.
- La documentación de datos se actualiza junto con el esquema.
- Los cambios de estado se reflejan en base, API, UI, reportes y pruebas.
- Las acciones relevantes se auditan.

### 14.2 Recetas de extensión

#### Agregar un campo a una entidad existente

1. Crear `database/migrations/0NN_descripcion.sql`.
2. Agregar columna, índice o constraint.
3. Actualizar el esquema Zod en `shared/src/index.ts` si el campo entra por API.
4. Actualizar servicio y repositorio.
5. Actualizar la UI.
6. Agregar o ajustar pruebas.
7. Actualizar [DICCIONARIO_BASE_DE_DATOS.md](./DICCIONARIO_BASE_DE_DATOS.md).
8. Actualizar este documento si cambia un flujo.

#### Agregar un endpoint

1. Definir método y ruta en el router del módulo.
2. Aplicar `requireAuthentication` y `requireRoles`.
3. Validar parámetros con Zod.
4. Implementar regla en el servicio.
5. Implementar SQL en el repositorio.
6. Usar transacción si hay varias escrituras.
7. Escribir auditoría si cambia negocio.
8. Agregar prueba de ruta y de servicio.
9. Agregar la fila al índice de la sección 7.4.

#### Agregar un estado de orden

1. Insertar la transición en `order_status_transitions` mediante migración.
2. Verificar que los triggers la permitan.
3. Actualizar etiquetas y colores en `client/src/app.tsx`, `order-detail.tsx` y `public-tracking.tsx`.
4. Actualizar reportes y conteos.
5. Actualizar seeds y datos demo.
6. Actualizar la sección 9 y las pruebas.
7. Evaluar impacto en `CANCELADA` y estados terminales.

#### Agregar un rol

1. Insertar el rol en `roles`.
2. Actualizar el enum de `shared`.
3. Actualizar `requireRoles` en cada módulo.
4. Actualizar el esquema de usuarios administrables si aplica.
5. Actualizar navegación y matriz RBAC.
6. Actualizar pruebas y documentación.
7. Evaluar si el bootstrap debe crear ese rol.

#### Agregar un reporte

1. Agregar la consulta en `server/src/modules/reports`.
2. Exponer ruta solo para SA/ADM.
3. Validar filtros.
4. Agregar la vista en `reports-view.tsx` o `report-lists.tsx`.
5. Definir exportación CSV/PDF si corresponde.
6. Agregar pruebas y actualizar el índice de endpoints.

#### Agregar una categoría de adjunto

1. Agregar el valor al `Set` de categorías en `attachments/routes.ts`.
2. Actualizar el tipo o enum de base si la columna lo restringe.
3. Actualizar la UI que envía la categoría.
4. Actualizar pruebas y documentación.

#### Agregar un documento PDF

1. Implementar la generación en el cliente.
2. Cargar jsPDF de forma diferida.
3. No agregar almacenamiento en servidor.
4. Añadir prueba de la función pura de composición si es posible.
5. Documentar la fuente de datos y el nombre del archivo.

### 14.3 Deuda técnica y riesgos

| Prioridad | Tema | Evidencia | Impacto | Recomendación |
|---|---|---|---|---|
| Media | Repuestos y logística sin guarda terminal en API | `PATCH /orders/parts/:partId` y `PUT /orders/:orderId/parts/logistics` no vuelven a comprobar el estado. | Una integración futura podría modificar un caso cerrado. | Replicar la guarda de orden terminal en el servicio. |
| Media | `CANCELADA` sin flujo | Está en transiciones y UI, pero no hay endpoint. | Estado mostrado pero no alcanzable desde la app. | Implementar cancelación con motivo y reglas, o retirar de la UI. |
| Media | Sin CI versionado | No hay `.github`. | Las pruebas dependen de ejecución manual. | Agregar pipeline de test, build y análisis. |
| Media | Sin recuperación automática ni MFA | Hay cambio propio y restablecimiento por SA, pero no recuperación por correo ni segundo factor. | Dependencia del administrador para recuperar el acceso. | Definir recuperación segura y evaluar MFA. |
| Media | Cambio de rol propio sin guarda de último SA | `PUT /users/:userId` permite cambiar el rol; la interfaz oculta el cambio de rol propio. | Un SA podría degradarse y dejar la instalación sin superadministrador activo. | Bloquear la degradación del último SA activo. |
| Media | Contraseña sin revocación de sesiones | Cambiar o restablecer la contraseña no borra `sessions`. | Una sesión abierta sigue válida tras el cambio. | Revocar sesiones al cambiar o restablecer la contraseña. |
| Media | Sin CSRF explícito | Cookie `SameSite=Lax`, CORS y JSON. | Riesgo si cambia el modelo de integración. | Agregar token CSRF si aparece un flujo cross-site. |
| Media | Sin antivirus ni recompresión | Validación MIME + bytes mágicos. | Archivos maliciosos o imágenes manipuladas. | Escanear y reencodificar si el riesgo lo exige. |
| Media | Health superficial | `/health` no consulta dependencias. | Un monitor puede dar “verde” con base caída. | Agregar readiness con DB y almacenamiento. |
| Baja | Mensajes fijos “44 ítems” | UI y backend. | Si cambia el catálogo, el texto queda obsoleto. | Calcular el total desde el catálogo. |
| Baja | Banderas de recepción parcial siempre falsas | API expone `partialReceived` y `partiallyReceived` en `false`. | La UI no distingue parcial por bandera. | Calcular desde cantidades o eliminar el campo legado. |
| Baja | Auditoría limitada a 200 | Sin paginación ni exportación. | Difícil investigar historiales grandes. | Paginar y exportar con permisos. |
| Baja | Conteos globales en listado | `counts`, `total` y `overdue` no responden al filtro. | Puede confundir si se espera un resumen filtrado. | Documentar o agregar conteos filtrados. |
| Baja | `service_orders.version` sin uso | No hay bloqueo optimista. | Ediciones concurrentes dependen de transacciones. | Implementar `version` o eliminar la columna. |
| Baja | Sesiones expiradas sin limpieza | No hay tarea de purga. | Crecimiento de tabla y datos obsoletos. | Programar limpieza. |
| Baja | Sin umbral de cobertura | No hay script de coverage. | La calidad no se mide en CI. | Agregar cobertura y umbral. |
| Baja | Sin E2E | No hay Playwright/Cypress. | Los flujos grandes se validan manualmente. | Agregar E2E de recepción, cotización y entrega. |
| Baja | Carga demo costosa en deploy | Purga + 1,000 casos. | Build de varios minutos. | Mantener `DEMO_PURGE_CONFIRM` fuera cuando no se necesite. |

No se identifican fallos críticos en el flujo principal documentado; las brechas anteriores son de endurecimiento, operación o mantenibilidad.

### 14.4 Glosario

| Término | Definición |
|---|---|
| **Orden de servicio** | Caso central; agrupa recepción, cotización, repuestos, reparación y entrega. |
| **Recepción** | Registro inicial del vehículo y su estado. |
| **Snapshot** | Copia inmutable de datos en un momento determinado. |
| **Cotización** | Documento con partidas de mano de obra y repuestos, sin IGV. |
| **Versión de cotización** | Instancia numerada e histórica de una cotización. |
| **Borrador de cotización** | Edición manual no versionada hasta que se crea una versión. |
| **Mano de obra** | Partida de trabajo, con categoría de planchado, pintura o mecánica. |
| **Repuesto** | Partida de material; al aprobarse se convierte en una fila de gestión. |
| **Control final** | Verificación previa a declarar el vehículo listo. |
| **Publicación** | Acción de exponer “listo para entrega” en el tracking público. |
| **Entrega** | Cierre del caso con conformidad del cliente. |
| **Conformidad** | Aceptación literal registrada al entregar. |
| **Siniestro** | Número de caso de una aseguradora. |
| **Modalidad** | Particular o compañía de seguros. |
| **Placa** | Identificador del vehículo, normalizado. |
| **VIN** | Identificación vehicular de 17 caracteres. |
| **Asesor** | Usuario que opera el caso. |
| **Ámbito demo** | Contexto que redirige a base y uploads demo. |
| **Purga demo** | Borrado acotado del lote `DM####`. |
| **RBAC** | Autorización por rol. |
| **Zod** | Librería de validación de contratos. |
| **Pool** | Conjunto reutilizable de conexiones MariaDB. |
| **AsyncLocalStorage** | Contexto asíncrono que propaga el ámbito demo. |
| **Trigger** | Regla SQL que valida estados o protege roles. |
| **Migración** | Archivo SQL versionado que evoluciona el esquema. |
| **Seed** | Carga de datos iniciales o ficticios. |
| **CSRF** | Ataque que fuerza acciones autenticadas desde otro sitio. |
| **CORS** | Política del navegador para solicitudes entre orígenes. |
| **RLS** | Seguridad a nivel de fila; no implementada. |

### 14.5 Referencias

Documentación:

- [DICCIONARIO_BASE_DE_DATOS.md](./DICCIONARIO_BASE_DE_DATOS.md)
- [CARGA_Y_CONTROL_DE_CASOS.md](./CARGA_Y_CONTROL_DE_CASOS.md)
- [PAGINACION.md](./PAGINACION.md)
- [auditoria/INFORME.md](./auditoria/INFORME.md)
- [auditoria/LIBRERIAS_Y_SEGURIDAD.md](./auditoria/LIBRERIAS_Y_SEGURIDAD.md)
- [../README.md](../README.md)

Código de referencia:

- `server/src/app.ts`: composición HTTP.
- `server/src/modules/orders/routes.ts`: endpoints del flujo principal.
- `server/src/modules/orders/orders-service.ts`: creación y detalle.
- `server/src/modules/orders/quote-transition-repository.ts`: envío y aprobación.
- `server/src/modules/orders/final-control-completion-repository.ts`: cierre.
- `server/src/modules/orders/final-control-delivery-repository.ts`: publicación y entrega.
- `server/src/modules/users/routes.ts`: endpoints de contraseña y cuentas.
- `server/src/modules/users/service.ts`: edición, reseteo, activación y retención.
- `server/src/db/pool.ts`: producción/demo.
- `server/src/config/env.ts`: variables.
- `shared/src/index.ts`: contratos.
- `scripts/run-deploy-migrations.mjs`: despliegue.
- `scripts/audit-local.mjs`: verificación aislada.
- `client/src/query-client.ts`: caché.
- `client/src/full-new-order.tsx`: recepción.
- `client/src/final-control.tsx`: cierre y entrega.
- `client/src/users-view.tsx`: edición y restablecimiento de cuentas.

### 14.6 Control de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-10-28 | Documento inicial sobre la línea base `master` / `e93584e`. |

### 14.7 Mantenimiento de este documento

Actualizar cuando cambie:

- Un endpoint, rol o permiso.
- Una tabla, migración o trigger.
- Un estado o transición.
- Una validación de negocio.
- Una variable de entorno.
- Un script de build, seed o despliegue.
- Una librería relevante.
- Un flujo del wizard o del detalle.
- Una brecha de la sección 14.3.

Revisión recomendada en cada release:

1. Contar endpoints y migraciones.
2. Verificar enlaces relativos.
3. Confirmar que el diccionario de datos siga siendo la fuente de detalle.
4. Revisar que no se hayan introducido precios o condiciones comerciales.
5. Confirmar que las rutas y nombres de archivo citados existan.

---

Fin del documento.


