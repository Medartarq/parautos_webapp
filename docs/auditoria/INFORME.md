# Auditoría integral de PARAUTOS

> **Cierre de confiabilidad del perfil ampliado:** 9 avisos corregidos automáticamente como FIXED; **0 de confiabilidad, 472 de mantenibilidad pendientes**. 151 pruebas y build aprobados. [Correcciones y evidencia](sonarqube-completo-2026-10-25/CORRECCIONES-CONFIABILIDAD.md).

> **Análisis ampliado posterior (25/10/2026):** el perfil separado Sonar way comprehensive detectó **482 avisos únicos de mantenibilidad**, incluidos **9 impactos LOW de confiabilidad**, y cero vulnerabilidades/hotspots. Pasaron 147 pruebas y el build. Ahora se dispone de cobertura medida: **24,0 % combinada en Sonar y 31,19 % de líneas en Vitest**. El primer gate del nuevo proyecto no evaluó condiciones. No se aplicaron nuevas correcciones al producto. Véase el [informe completo con inventario y prioridades](sonarqube-completo-2026-10-25/INFORME.md). Las notas siguientes describen etapas históricas y otros perfiles.

> **Correcciones verificadas con SonarQube local (25/10/2026):** los 30 impactos de confiabilidad y el aviso de seguridad del diagnóstico local quedaron cerrados automáticamente como FIXED, con cero avisos abiertos en los mismos perfiles. Pasaron **147 pruebas (130 servidor + 17 cliente)**, **67 comprobaciones HTTP** y `build:app`. El Quality Gate sigue pendiente por cobertura de código nuevo sin LCOV importado, no por hallazgos abiertos. No se añadieron dependencias ni se desplegó en Hostinger. Véase el [informe de correcciones y límites](sonarqube-local-2026-10-25/CORRECCIONES.md). Las cifras de los apartados anteriores se conservan como historial de cada etapa.

> **Actualización de librerías y seguridad (25/10/2026):** se incorporó Pino 10.4.0 y se aprovechó TanStack Query 5.104.3 ya instalada. Resultado de esta etapa: **123 pruebas aprobadas (108 servidor + 15 cliente)**, compilación aprobada y **66 comprobaciones HTTP** en bases temporales. Se verificaron panel, órdenes, cotizaciones, cambio principal/demo y logout en navegador. No se agregaron migraciones, cambios visuales de CSS, servicios externos ni módulos nativos. Las restricciones de Cloud Startup fueron aportadas por el usuario; no se desplegó esta versión en Hostinger. El [informe complementario](LIBRERIAS_Y_SEGURIDAD.md) documenta el alcance y límites. Los resultados numéricos anteriores de este documento corresponden a sus etapas históricas.

> **Rectificación tras comparar con la versión mostrada por el usuario:** la auditoría inicial partió del `master` local `4c07f7e`, que estaba diez commits por detrás de la referencia local `origin/master` (`9aa3c91`). No se había comprobado esa divergencia; por ello la preservación visual inicial sólo describía la base local antigua y no acreditaba paridad con Hostinger. Se integró ahora el delta de esos diez commits mediante combinación de tres versiones, conservando el trabajo local y las correcciones de auditoría. Se recuperaron perfil/correo/cierre de sesión, controles Amplio/Compacto, filtros del panel, accesibilidad de tarjetas, triggers de estados/roles y soporte de bloques SQL del migrador. No se ejecutó `pull`, `reset`, commit, push ni despliegue. La referencia `origin/master` es la disponible en este repositorio; no se consultó el servidor Git remoto.

> **Resultado posterior a la reconciliación:** compilación aprobada, 115 pruebas (106 servidor + 9 cliente) y 66 comprobaciones HTTP con 25 migraciones canónicas. Navegador: tarjeta del panel filtra correctamente órdenes; perfil muestra nombre/rol/correo y cierre de sesión; nueva orden y controles del menú recuperados. Evidencias: [pruebas](2026-10-25/evidencia/pruebas-reconciliacion.txt), [captura](2026-10-25/evidencia/nueva-orden-perfil-reconciliado.jpg), [migración local](2026-10-25/evidencia/migracion-reconciliacion.json). La migración de snapshots pasa a `025_reception_snapshots.sql`; las bases locales conservan el marcador histórico `023_reception_snapshots.sql` y agregan las tres versiones pendientes, sin sobrescribir snapshots (26 marcadores, 25 archivos canónicos). Los conteos 23/112 y capturas anteriores que aparecen en las secciones siguientes documentan la primera pasada. La afirmación de identidad del login inicial no implica identidad del nuevo CSS integrado. Hostinger sigue sin cambios.


**Identificación:** AUD-2026-10-25-4c07f7e-local. Fecha: 25 de octubre de 2026, America/Lima.
**Base Git:** `4c07f7e5425c1b97d45bf42818377a24a5a938b7`.
**Estado inicial:** árbol con modificaciones, eliminaciones y numerosos repositorios/pruebas sin seguimiento, anteriores a esta intervención. No se cambiaron ramas, crearon commits, publicaron versiones ni descartaron cambios del usuario.

## 1. Resumen ejecutivo

Se revisaron los módulos propios del cliente, servidor, contratos compartidos, migraciones, pruebas y configuración. Se implementaron correcciones compatibles y la protección histórica de recepciones expresamente solicitada durante la auditoría.

El resultado es **cumple parcialmente** para el sistema completo: la compilación y las comprobaciones ejecutadas son satisfactorias; no equivalen a una certificación de todos los escenarios, dispositivos o condiciones de producción. La batería final contiene **112 pruebas aprobadas: 103 del servidor y 9 del cliente**, sin omisiones con el entorno de pruebas configurado. El recorrido aislado realizó **66 comprobaciones HTTP y de consistencia** sobre MariaDB 11.8.9. No se midió un porcentaje de cobertura de líneas o ramas.

Las mejoras principales son la conservación de identidad y documento de recepción mediante snapshots, protección de transiciones de órdenes cerradas, transacciones de usuarios con auditoría, liberación de conexiones ante errores, aislamiento de borradores locales, reparación de cámara y solicitudes HTTP, mensajes de fallo visibles y eliminación de pantallas antiguas sin referencias.

Las bases **locales** principal y demo pasaron de 21 a 23 migraciones; se crearon respectivamente 15 y 5 snapshots históricos. No se modificaron los registros maestros para realizar esta conservación. Hostinger permanece sin cambios por esta intervención; su despliegue actual fue confirmado por el usuario, pero esta versión no se desplegó allí.

## 2. Ficha técnica

| Elemento | Evidencia y conclusión |
| --- | --- |
| Lenguaje | TypeScript estricto; JavaScript ESM en herramientas; SQL MariaDB. |
| Organización | Monolito modular, tres workspaces npm: `client`, `server`, `shared`. |
| Cliente | React 19, Vite 8, componentes con estado local; navegación interna mediante estado en `app.tsx`; `/seguimiento` se selecciona en `main.tsx`. No se supone uso de React Router por estar instalado. |
| Servidor | Express 5, rutas `/api/v1`, servicios y adaptadores de persistencia; activos estáticos de `client/dist` bajo el mismo proceso/origen. |
| Persistencia | MariaDB, consultas parametrizadas, pools y AsyncLocalStorage para contexto principal/demo. 23 migraciones después de esta intervención. |
| Identidad | Argon2id, tokens aleatorios de sesión cuyo hash se persiste, cookies HTTP-only, SameSite Lax y Secure según entorno; autorización por rol en servidor. |
| Adjuntos | Local por defecto, carpeta privada configurable; S3 compatible opcional y cargado de forma perezosa. No se inicializó S3 para verificar almacenamiento local. |
| Integraciones | Factiliza; PDF con jsPDF/svg2pdf/autotable; ExcelJS; navegador, cámara e IndexedDB. |
| Herramientas ejecutadas | Node 24.19.0, npm 11.17.0, Vitest 5.0.4, TypeScript y Vite instalados. MariaDB local observado: 11.8.9. |
| Runtime requerido | Manifiesto alineado con README: Node >=22.12.0. No se ejecutó esta auditoría sobre Node 22 exacto. |
| Construcción | `npm run build:app` compila sin migrar; `npm run build` conserva el paso de migraciones condicionado por `DEPLOY_RUN_MIGRATIONS`. |
| Despliegue | Hostinger según documentación y confirmación del usuario. No se inspeccionaron su proxy, permisos efectivos, variables, copias de seguridad ni Quality Gate de SonarCloud. |

## 3. Alcance y cobertura

La matriz está en [COBERTURA.md](COBERTURA.md), con inventario por archivo y por endpoint. La revisión siguió rutas, servicios, repositorios, SQL, contratos y componentes activos, además de pruebas, manifiestos y documentación relevante. Se distinguió la refactorización ya existente de las correcciones nuevas.

Los estilos se analizaron completos con PostCSS, agrupando reglas, medios, selectores de foco y repetición; se complementó con inspección visual. No se afirma una revisión manual de cada declaración CSS ni de cada píxel de todos los recursos. Los 20 PNG de carrocerías y las variantes SVG se agrupan por familia y por sus consumidores; no todos se inspeccionaron individualmente en pantalla.

Se excluyeron dependencias descargadas, Git interno, cachés, compilados, datos privados y adjuntos reales. `.env` no se copió al informe: se utilizó su configuración para identificar y verificar exclusivamente los destinos locales autorizados. La evidencia usa datos sintéticos o conteos agregados, sin credenciales, cookies ni tokens.

No se ejecutaron pruebas contra producción, Factiliza real ni un bucket S3 real. Tampoco se certificó paridad con el prototipo externo ni funcionamiento de cámara física, desconexión prolongada, todos los equipos móviles o todas las exportaciones.

## 4. Estado inicial y contratos preservados

La primera ejecución de `npm test` falló en 11 suites porque `@parautos/shared` no se resolvía; 26 suites pasaron y una quedó omitida. `build:app` compilaba shared y fallaba al compilar servidor por la misma instalación defectuosa. Los directorios de los workspaces dentro de `node_modules/@parautos` estaban vacíos. `npm install --offline --ignore-scripts` reparó los tres enlaces sin actualizar versiones. Después pasaron 86 pruebas y la compilación; dos pruebas de MariaDB seguían omitidas hasta configurar la cuenta local autorizada.

La cuenta local de aplicación no tenía permiso para crear bases temporales. Se solicitó el dato faltante y el usuario autorizó una cuenta local para estas verificaciones; los valores no se almacenaron en el proyecto. Un primer intento explícito al puerto predeterminado alcanzó otro motor compatible MySQL y falló en sintaxis de MariaDB. Se corrigió el destino usando el puerto configurado en el proyecto y se verificó la versión antes del recorrido posterior. Este incidente de selección del entorno no se atribuye al código ni demuestra una regresión.

Se preservaron las rutas, roles, formato de adjuntos, cookies, contratos de cotización sin IGV, pasos de recepción, estados internos/públicos separados y reglas de publicación/entrega. Las diferencias observables deliberadas se detallan abajo: errores ahora correctamente rechazados, nuevos mensajes de fallo y el campo adicional privado `receptionSnapshot` en el detalle.

## 5. Hallazgos y resolución

P1: riesgo alto de integridad o acceso; P2: defecto funcional/robustez; P3: mantenibilidad, operación o evolución. La certeza es alta salvo donde se declara expresamente un límite.

| ID | Prioridad | Módulo, evidencia y efecto | Resolución |
| --- | --- | --- | --- |
| H-001 | P2 | Instalación: workspaces vacíos; TS2307 y suites sin importar. | **Corregido** reparando enlaces con el bloqueo existente. |
| H-002 | P2 | Pruebas/desarrollo: shared requiere compilación y no existía ejecución del cliente en `npm test`. | **Corregido** con preparación de shared, `predev`, pruebas del cliente y dependencia de desarrollo ya presente en servidor. |
| H-003 | P1 | `startRepair`, completar control y transiciones/eliminación de cotizaciones podían cambiar una orden terminal; repetir control borraba publicación. | **Corregido** con guardas dentro de transacciones y bloqueo del estado leído; nueve regresiones específicas. |
| H-004 | P2 | Diversos `finally` liberaban la conexión después de rollback; si éste fallaba, no llegaban a `release`. Setup también podía perder la conexión si fallaba commit. | **Corregido** con liberación en `finally` anidado. La prueba reproduce rollback fallido. |
| H-005 | P1 | Usuarios: alta/activación se guardaban antes de la auditoría, fuera de una transacción común. | **Corregido**; fallo de auditoría revierte la mutación. Hash de contraseña fuera de la transacción; lectura posterior al commit libera antes la conexión. |
| H-006 | P1 | Recepción: `getOrderDetail`, listados y documentos leían maestros que una recepción posterior actualiza; modalidad/siniestro operativos también cambiaban el documento regenerado. | **Corregido**, con ampliación autorizada de esquema: migración 023 y snapshots descritos en §6. |
| H-007 | P2 | Parser JSON: exceso de tamaño producía 500; request ID se asignaba después del parser. | **Corregido**: 413 `PAYLOAD_TOO_LARGE` e identificación previa. |
| H-008 | P2 | Adjuntos: nombre Unicode o CR/LF podía producir `ERR_INVALID_CHAR` al armar Content-Disposition. | **Corregido** usando codificación de Express, conservando disposición inline y MIME. Regresión HTTP ejecutada. |
| H-009 | P1 | IndexedDB: claves `current-user` y `current-user-media` compartidas entre cuentas y contexto demo. | **Corregido** con claves por usuario/contexto; cierre de conexiones y resolución al finalizar transacción. |
| H-010 | P2 | Cámara: el vídeo no se montaba mientras se esperaba la cámara; streams resueltos tras desmontaje no se detenían. | **Corregido** con vídeo montado y ciclo de vida cancelable; tres pruebas de ciclo de stream. Cámara física no verificada. |
| H-011 | P2 | API cliente: opciones podían sustituir encabezados preparados; errores no conservaban estado HTTP. El asistente de recepción duplicaba el transporte y fallaba al interpretar 204. | **Corregido** con Headers, manejo de FormData/204, estado del error y cliente común. |
| H-012 | P2 | Órdenes, cotizaciones y reportes silenciaban errores y permanecían cargando. Cerrar sesión cambiaba la UI incluso si fallaba la revocación. | **Corregido**: fallos visibles; cierre de sesión sólo cambia de estado tras respuesta exitosa. Errores de órdenes/reportes observados en navegador con respuestas 503 sintéticas. |
| H-013 | P2 | SVG/PDF: fecha/hora de descarga en lugar de recepción; `$&` en datos se interpretaba como sustitución de marcador. | **Corregido**: fecha registrada, zona America/Lima y sustitución literal con escape XML. |
| H-014 | P2 | Checklist: conjuntos ocultaban respuestas repetidas, que alcanzaban persistencia en lugar de rechazo temprano. | **Corregido** validando cardinalidad y pertenencia antes de abrir transacción. |
| H-015 | P3 | TypeScript identificó pantallas antiguas sin referencias, exportador de impresión inactivo e imports/helpers sobrantes. | **Corregido** retirando declaraciones no usadas, sin eliminar componentes activos; controles `noUnusedLocals` y `noUnusedParameters` habilitados. |
| H-016 | P2 | Prueba de migraciones fijaba 20 pese a existir 22; dependía de HOME real en Windows y el teardown intentaba borrar una base cuya creación había fallado. | **Corregido**: inventario exacto dinámico, reintentos/idempotencia, HOME simulado y limpieza condicionada. Se añadieron pruebas de baseline histórica. |
| H-017 | P2 | UI mostraba `null km`/`null%` cuando MariaDB devolvía valores no registrados. | **Corregido**: presentación nula/ausente coherente; regresión de renderizado. |
| H-018 | P2 | Códigos públicos: generación excluía órdenes cerradas aunque el seguimiento también permite consultarlas, permitiendo reutilizar su par placa/código. | **Corregido** para nuevas altas: se comprueba todo el historial. No se alteraron códigos existentes; no se ejecutó una colisión aleatoria forzada. |
| H-019 | P3 | `listQuotes` ejecuta una consulta de versiones y una por versión; listados/reportes cargan la totalidad de filas. | **Pendiente**, mejora de escala: no se midió saturación ni incumplimiento de tiempo con el volumen local. Requiere contrato de paginación y medición representativa antes de cambiar respuestas. |
| H-020 | P3 | CSS acumula selectores repetidos; fuentes con `any`, SQL y reglas conviven en algunos repositorios/servicios. | **Pendiente**, deuda estructural. Repetición y tamaño no prueban defectos por sí solos; no se justificó una reescritura general durante esta auditoría. |
| H-021 | P2 | Infraestructura: persistencia tras redeploy, proxy real, límites de recursos y restauración de backups no comprobados en Hostinger. | **Dependiente de información/verificación del entorno**, sin modificar configuración inferida. |

Los hallazgos corregidos tienen evidencia de código y las validaciones indicadas; no se transforma una limitación de pruebas en una vulnerabilidad confirmada. `npm audit --json` consultó el registro oficial y devolvió cero avisos; no se detectó una actualización de dependencias necesaria para resolver esta intervención.

## 6. Cambios realizados

### Recepción conservada y caso corregible

`025_reception_snapshots.sql` crea una tabla con recepción y orden únicas, JSON de identidad, procedencia y fecha de captura. `captureReceptionSnapshot` inserta dentro de la misma transacción que crea la recepción: nombre/documento/contactos, vehículo, carrocería, modalidad, siniestro, asesor y fecha quedan fijados antes del commit.

Las recepciones anteriores reciben `LEGACY_BASELINE`, copiando una sola vez los valores disponibles al migrar. Las nuevas reciben `RECEPTION`. Reaplicar la migración no sustituye snapshots existentes. No se reconstruyen ni se presentan como conocidos valores anteriores que ya hubieran sido corregidos.

Las lecturas de detalle, listas, pendientes, repuestos, reportes y seguimiento utilizan columnas de identidad desde el snapshot. Los valores nulos capturados permanecen nulos, aunque posteriormente el maestro tenga un dato. Se conserva fallback para órdenes que carezcan de snapshot, por ejemplo registros sin recepción. El seguimiento público sigue devolviendo únicamente su proyección pública, sin JSON de identidad completo.

El detalle mantiene **teléfono/correo operativos, modalidad y siniestro** corregibles con motivo y evento de auditoría. Sus valores actuales se muestran en el caso, mientras `ReceptionDetail` y el PDF usan la recepción conservada. No se añadieron ediciones de documento, cliente, placa o VIN a la UI: requerirían definir reglas de corrección y vínculos adicionales. No existe endpoint de actualización o borrado de snapshots. Esta inmutabilidad es de la aplicación; no es un sello criptográfico ni una restricción frente a un administrador de base de datos.

Se añadieron `ReceptionSnapshot` y `ReceptionIdentitySnapshot` a los contratos compartidos; el detalle HTTP agrega `receptionSnapshot`. La UI identifica la baseline de recepciones históricas. No se cambiaron IDs existentes, formatos de adjuntos ni estructura del resto de respuestas.

### Integridad, errores y recursos

Se reforzaron estados terminales en repositorios de reparación, cotización y control final; se mantuvo la separación entre completar control, publicar y entregar. Usuarios ahora guarda mutación y evento juntos. Los bloques de cierre de transacciones garantizan liberar conexiones incluso con rollback fallido. No se afirma atomicidad de DDL: MariaDB puede hacer commits implícitos en migraciones.

Adjuntos usa Content-Disposition seguro; el límite JSON se devuelve como error de cliente y lleva request ID. Los errores de red del cliente se muestran y mantienen el estado HTTP necesario para conflictos de borrador.

### Cliente y mantenimiento

Los borradores locales usan claves por usuario y principal/demo. Las claves históricas sin propietario no se restauran automáticamente a otra cuenta; se conservan en IndexedDB y los borradores ya sincronizados siguen recuperándose del servidor. No se puede atribuir de forma segura un borrador local antiguo a una cuenta distinta.

El vídeo de cámara permanece montado y los streams tardíos se detienen. El generador A4 utiliza fecha de recepción y sustituciones literales escapadas. La UI distingue datos no registrados de cero. El detalle se actualiza tras cambios de cotización.

Se retiraron funciones sin uso confirmadas por TypeScript: `EvidenceUploader`, `LegacyOrderDetail`, `UnavailableTab`, tres variantes antiguas de PartsWorkbench, `LegacyNewOrder`, `WizardField`, `QuoteTab`, el antiguo `print`, `Title` y dependencias obsoletas. `FinalControlLegacy` se conservó porque sí atiende controles completados. No se modificaron CSS ni recursos gráficos; el CSS compilado mantuvo su identificador `index-DZGz3eJT.css`. También se eliminó una consulta duplicada de resumen en el shell.

**Archivos creados por esta intervención:** migración 023; `reception-snapshot.ts`; `camera-stream.ts`; cinco archivos de pruebas del cliente; pruebas de órdenes cerradas, errores HTTP y servicio de usuarios; `scripts/audit-local.mjs`; este informe, cobertura y evidencias. Los otros repositorios/puertos sin seguimiento ya existían al inicio y no se atribuyen como creación propia.

**Archivos modificados:** los consumidores de snapshots, creación de recepción, repositorios transaccionales de órdenes, servicio de usuarios/setup, rutas de adjuntos, parser/errores, API cliente, asistente/almacenamiento de recepción, documentos, pantallas de carga, manifiestos, bloqueo, tsconfig, pruebas relacionadas y documentación. El inventario permite localizar cada archivo.

**Archivos eliminados por esta intervención:** ninguno completo; se eliminaron declaraciones inactivas dentro de archivos. Las eliminaciones de `client/vite.config.js` y `.d.ts`, y los cambios de `.gitignore`, `public-tracking.tsx` y `users-view.tsx`, ya estaban presentes antes de empezar y se conservaron.

## 7. Matriz de principios

| Principio | Estado inicial → final y alcance | Evidencia y límite |
| --- | --- | --- |
| MVC | Cumple parcialmente → cumple parcialmente | React presenta; rutas validan/autorizan/coordinan. Algunas reglas siguen en repositorios. No se impuso MVC clásico a React. |
| DAO | Cumple parcialmente → cumple parcialmente | Puertos y adaptadores para sesiones, adjuntos, auditoría y órdenes; consultas directas en reportes, setup y lookups. Son repositorios/puertos, no se afirma DAO literal universal. |
| TDD, esta intervención | Cumple parcialmente | Se observaron fallos esperados antes de corregir estados, rollback, JSON, encabezados, API, borradores, fechas, cardinalidad, usuarios y nulos. Cámara se extrajo y verificó con pruebas posteriores; inspección visual y retirada de código no son TDD. |
| TDD histórico | No verificable | La existencia de pruebas previas no prueba su orden de escritura. |
| SRP | Cumple parcialmente → cumple parcialmente | Menos implementaciones inactivas y transporte HTTP común; `app.tsx`, repositorios de órdenes y reportes aún reúnen varias responsabilidades. |
| OCP | Cumple parcialmente → cumple parcialmente | Puerto de almacenamiento y S3 perezoso son puntos reales de variación; no se añadió sistema de plugins hipotético. |
| LSP, herencia de dominio | No aplica → no aplica | No existe jerarquía de entidades que requiera comprobar sustitución clásica. AppError conserva contrato de Error. |
| LSP, puertos | Cumple parcialmente → cumple parcialmente | Local y S3 exponen StoredFile/Buffer; pruebas de adaptadores y local real. S3 remoto no ejecutado. |
| ISP | Cumple parcialmente → cumple parcialmente | Interfaces pequeñas por uso; no se añadieron interfaces sólo para dividir artificialmente el código. |
| DIP | Cumple parcialmente → cumple parcialmente | Inyección manual disponible en varios casos; persisten dependencias concretas de pool y escritores predeterminados. Se conserva un límite proporcional. |

## 8. Pruebas y validación

Todas las ejecuciones se realizaron desde la raíz del proyecto salvo los comandos de Vitest dirigidos al workspace indicado. Los comandos siguientes no contienen secretos; las variables de conexión de prueba se suministraron sólo al proceso.

| Comprobación | Resultado |
| --- | --- |
| `npm install --offline --ignore-scripts` | Reparó workspaces; después sincronizó el bloqueo con scripts/devDependency del cliente sin actualización masiva. |
| `npm run build:app` | Aprobado inicialmente tras reparación y al finalizar los cambios. No ejecuta migraciones. |
| `npm test`, con `MIGRATION_TEST_DB_*` | 41 suites/103 pruebas de servidor y 5 suites/9 pruebas de cliente aprobadas; sin omitidas. [Salida final](2026-10-25/evidencia/pruebas-finales.txt). |
| `node node_modules/vitest/vitest.mjs run --root server src/modules/orders/order-creation.service.test.ts src/modules/orders/public-code.test.ts` | Cinco pruebas aprobadas después del último ajuste de generación de código. No equivale a forzar una colisión real. |
| `node --import tsx scripts/audit-local.mjs --serve` | 66 verificaciones HTTP/consistencia con dos bases nuevas y adjuntos temporales. [Registro sin secretos](2026-10-25/evidencia/integracion-local.json). |
| `tsc` cliente/servidor con controles de no usados | Aprobado; la compilación normal incorpora los controles. |
| `npm audit --json` | Cero avisos en el registro oficial. La consulta inicial bloqueada por red se repitió con permiso de ejecución. |
| `git diff --check` | Aprobado tras corregir tres líneas vacías con espacios de esta intervención. |
| Migración local guardada por host loopback | Principal 15/15 y demo 5/5 recepciones/snapshots; ambas de 21 a 23 migraciones. [Resumen](2026-10-25/evidencia/migracion-local.json). |
| PDF descargado desde la aplicación | Un A4 de una página, 595.28 × 841.89 puntos, sin marcador `__CLIENTE__` pendiente; renderizado con Poppler e inspeccionado. Emitió aviso de fuente Symbol, sin defecto visible en la página revisada. |

El recorrido real cubre bootstrap, sesión, tres roles, denegación de acceso, creación/activación/eliminación de cuentas sintéticas, recepción con 44 respuestas, archivos PNG con igualdad de bytes, consultas locales, borrador y versiones de cotización, edición/eliminación de versión pendiente, aprobación, recepción de partes, reparación, verificación de mano de obra, publicación/entrega, conflictos de borrador y separación demo. Verifica además que actualizar maestros y corregir datos operativos no altere una recepción anterior, incluyendo un contacto nulo original.

Las tres pruebas de migraciones verifican instalación completa e idempotente, promoción histórica de rol auditada una vez, y backfill de snapshot identificado que permanece idéntico tras cambios de maestros y reintento. Los 66 checks son un recorrido complementario, no 66 pruebas Vitest adicionales.

La fase roja inicial de la prueba de duplicados produjo primero un error del doble de persistencia incompleto; se corrigió el doble y se confirmó después el fallo por aceptar la entrada repetida antes de implementar la corrección. No se cuenta el fallo de configuración como demostración de TDD. Tampoco se consideran regresiones del producto los fallos por workspaces vacíos, falta de permiso CREATE DATABASE o HOME ausente en una prueba no aislada.

## 9. Preservación funcional y visual

La comparación antes/después directa disponible es el acceso a **1440×900**, mismo formulario vacío: las imágenes resultaron idénticas píxel por píxel. [Comparación](2026-10-25/evidencia/comparacion-login.json), [antes](2026-10-25/evidencia/login-antes-1440.jpg), [después](2026-10-25/evidencia/login-despues-1440.jpg).

En escritorio se inspeccionaron panel, órdenes, recepción, cotización, repuestos vacíos, control entregado, reportes, auditoría y usuarios. Se observaron también mensajes 503 sintéticos en órdenes/reportes. En **390×844** se comprobaron acceso, recepción, menú con Escape y seguimiento con validación vacía. El navegador mostró ancho de documento 375 para un viewport 390 con barra de desplazamiento, sin desbordamiento horizontal en la recepción observada.

El [checklist de prueba renderizado](2026-10-25/evidencia/checklist-prueba.png) permitió revisar encabezados, datos, las 44 casillas, carrocería, combustible, kilometraje y pie legal. Su firma de un píxel es un dato sintético del escenario; no acredita captura de firma manuscrita física.

Las restantes capturas son verificaciones visuales posteriores, no comparaciones completas antes/después. No se concluye igualdad absoluta de todas las pantallas. Las diferencias intencionales son los errores visibles, el tratamiento de nulos y la identificación de recepciones históricas; se conservan estilos, recursos e identidad visual.

No se verificaron todos los pasos interactivos del asistente en móvil, cámara física, conflicto real entre dos dispositivos, impresoras, PDFs largos, exportaciones de acta/orden de trabajo/CSV/XLSX ni todos los tipos de carrocería. Los contratos relevantes se revisaron en código y las áreas no ejecutadas quedan explícitas.

## 10. Compatibilidad de despliegue

Se conserva Express/React/MariaDB, almacenamiento local privado por HOME, proveedores de adjuntos registrados y S3 opcional. No se cambiaron versiones de librerías, bucket, secretos, rutas públicas ni comando de build de Hostinger.

Esta versión **requiere las migraciones 023–025 antes de iniciar el servidor actualizado**. El paso existente `DEPLOY_RUN_MIGRATIONS=true` ejecutará las migraciones pendientes durante `npm run build`; en la base local también estaba pendiente 022, que amplía QUALITAS y fue aplicada junto con 023. El snapshot añade lecturas JSON y un join indexado por orden; no se midió una carga de producción.

Antes de publicar debe existir una copia recuperable del esquema y datos, y comprobarse el resultado del build/migración en Hostinger, la persistencia de adjuntos tras redeploy y los permisos de la cuenta de migración. El usuario confirmó el despliegue actual, no una validación de esta nueva revisión. No se publicaron cambios, cambiaron variables remotas ni ejecutaron migraciones remotas. El nuevo script de auditoría escucha sólo en loopback y sus accesos auxiliares no se incorporan a `createApp`.

## 11. Decisiones de no intervención

| Cambio descartado o limitado | Motivo, alternativa y condición para reconsiderar |
| --- | --- |
| Reescribir todo a MVC/DAO, introducir ORM o contenedor DI | Coste y riesgo desproporcionados. Se conservaron módulos, puertos e inyección manual; extender límites donde exista una necesidad concreta. |
| Reorganizar CSS por completo | Selectores repetidos no demuestran defecto. Se preservó CSS y se dejó inventario; reorganizar con comparaciones visuales automatizadas más amplias. |
| Paginación o batching de todas las lecturas | Puede alterar contratos y filtros locales. Medir volumen/latencia y diseñar una transición explícita del cliente antes de introducirlos. |
| Actualizar masivamente dependencias | No existió aviso vigente que lo justificara; se preservó el bloqueo. ExcelJS sigue en un chunk de unos 929 kB cargado por demanda. |
| Reconstruir retrospectivamente datos originales | Es imposible recuperar con certeza correcciones previas. Se conserva baseline identificada, nunca se inventa historia. |
| Editar directamente snapshots o ampliar todos los campos corregibles | Contradiría el registro de ingreso. Se mantiene el editor operativo y auditoría existentes; nuevas correcciones de identidad requieren reglas y versionado propios. |
| Pruebas en producción o consumo real de integraciones | El entorno local permitió verificar el cambio sin tocar producción ni datos de terceros. Quedan verificaciones externas delimitadas. |

## 12. Pendientes, reversión y entrega

Los pendientes priorizados son H-021, validación operativa de la nueva versión en Hostinger; H-019, medición/paginación cuando el volumen lo requiera; H-020, tipos y separación gradual de responsabilidades. Completar cámara física, dos dispositivos sin conexión y exportaciones restantes antes de atribuirles verificación completa. El histórico previo a la baseline no puede restaurarse con certeza aunque estas comprobaciones futuras pasen.

Para revertir código, retirar sólo los incrementos descritos en §6 y los archivos creados aquí. **No utilizar un restablecimiento global del árbol:** había trabajo local ajeno, incluidos repositorios todavía sin seguimiento. El diff respecto a HEAD mezcla ese trabajo y esta auditoría; no constituye por sí solo un parche exclusivo de esta intervención.

Ante una reversión de aplicación, conservar la tabla y sus snapshots y mantener el registro de migración: el servidor anterior puede ignorar una tabla adicional. Borrarlos eliminaría la protección histórica. No se prepara una migración destructiva de rollback. La migración 022 también se conserva; reducir su enum requeriría comprobar y migrar datos existentes por separado.

Las bases y adjuntos de los recorridos son temporales y se limpian al cerrar el proceso de auditoría. Las dos primeras interrupciones del proceso hijo no ejecutaron su cierre asíncrono; se identificaron y eliminaron exclusivamente sus bases/carpetas con nombres generados por esta auditoría, con comprobación de prefijo y rutas. El cierre posterior utiliza el mecanismo auxiliar del servidor local. Las bases locales reales y sus 20 snapshots históricos permanecen intactas tras esa limpieza.

Se entregan este informe, la matriz de cobertura y evidencias bajo `docs/auditoria/2026-10-25/evidencia/`. No se elevaron los estados históricos de paridad del proyecto a “Verified” ni se atribuye despliegue o aceptación del usuario a verificaciones no realizadas.


**Limpieza posterior de dependencias sin uso — 25/10/2026**

Se retiraron `react-router-dom` y la dependencia directa `html2canvas` de `client/package.json`, y npm actualizó el bloqueo y la instalación local (cuatro paquetes retirados del árbol instalado). `react-router` y `react-router-dom` ya no figuran como entradas de paquete en el bloqueo ni están instalados. `html2canvas` permanece como dependencia opcional transitiva de jsPDF y conserva su chunk; no se modificó el código de terceros ni se excluyeron arbitrariamente sus módulos opcionales. Se conservan las referencias históricas de auditoría como documentación, no como dependencias ejecutables.

Se inspeccionaron importaciones estáticas, dinámicas y de tipos con el parser de TypeScript: las veinte declaraciones restantes de dependencias de ejecución entre los tres workspaces tienen referencias en código propio. Los tipos y herramientas de desarrollo se conservan por su uso en TypeScript, Vite, Vitest y scripts. S3 se conserva por su adaptador opcional activo. Evidencia: `2026-10-25/evidencia/dependencias-en-uso.json`.

Verificación posterior: compilación aprobada y 123 pruebas aprobadas (108 servidor + 15 cliente, incluida MariaDB temporal). Salida: `2026-10-25/evidencia/pruebas-limpieza-dependencias.txt`. CSS conserva el hash `index-hh2fvN8w.css`; no se atribuye una reducción del bundle a paquetes que ya quedaban fuera del código ejecutado. No se añadieron pruebas que sólo reflejen el manifiesto, ni se repitió la revisión visual completa por este cambio de dependencias. Hostinger permanece sin cambios.
