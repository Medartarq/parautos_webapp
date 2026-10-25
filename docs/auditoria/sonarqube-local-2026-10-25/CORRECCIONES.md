# Correcciones verificadas de SonarQube local

Se aplicaron las correcciones autorizadas y SonarQube cerró automáticamente como FIXED los 31 avisos originales. No se marcaron falsos positivos, no se aceptaron riesgos para ocultar avisos y no se cambiaron reglas, perfiles o exclusiones para mejorar el contador.

## Resultado comparable

| Indicador | Diagnóstico inicial | Después |
|---|---|---|
| Impactos abiertos de confiabilidad | 30 | 0 |
| Impactos abiertos de seguridad | 1 | 0 |
| BUG en clasificación heredada | 26 | 0 |
| CODE_SMELL heredados | 4 | 0 |
| VULNERABILITY heredadas | 1 | 0 |
| Calificación de confiabilidad | D | A |
| Calificación de seguridad | B | A |
| Registros originales cerrados automáticamente | — | 31 CLOSED/FIXED |
| Avisos abiertos totales | 31 | 0 |

Se mantuvieron SonarQube Community Build 26.10.0.133078, SonarScanner 8.1.0.6389 y las mismas imágenes Docker por digest. También coinciden los perfiles Sonar way core y sus reglas activas: TS 198, JS 199 y CSS 25. El código analizado sigue siendo el árbol local de master con cambios sin commit, sobre HEAD 4c07f7e. Este resultado no demuestra coincidencia con el commit ni los 33 avisos del proyecto SonarCloud.

La API de búsqueda conserva los 31 registros históricos, ahora cerrados. No deben contarse como 31 problemas abiertos. `despues/hallazgos-abiertos.json`, las métricas y el resumen distinguen estado actual de historial. El ejecutor local se ajustó para hacer esa distinción en futuras exportaciones.

## Quality Gate pendiente por cobertura

La segunda ejecución completó el análisis y la carga del informe. El escáner devolvió código 3 porque el Quality Gate falló en **new_coverage: 0,0 %, umbral 80 %**. No se importó LCOV en ninguna de las dos ejecuciones. Esto no equivale a haber medido una cobertura real del 0 % ni a que las 147 pruebas fallen.

Las otras condiciones devolvieron OK: cero nuevas infracciones y 0,0 % de duplicación en código nuevo. El primer análisis no mostró condiciones evaluadas; el segundo ya tiene la primera versión como referencia del periodo. Por eso el primer gate aprobado y el segundo fallido no significan una regresión de confiabilidad.

No se desactivó la condición de cobertura, no se excluyó código adicional y no se fabricó un porcentaje. La medición con instrumentación e importación LCOV queda como trabajo separado. Cero avisos de este perfil no garantiza ausencia de defectos o cobertura integral del software.

## Cambios aplicados

| Regla | Ubicaciones | Corrección y criterio |
|---|---:|---|
| S9383 | 24 | Se esperan las liberaciones con releaseConnection en 16 archivos de servidor. El helper maneja errores, registra un evento técnico mínimo y descarta la conexión sin ocultar el error de negocio ni impedir la limpieza posterior de adjuntos. |
| S8786 | 3 | Los dos correos se validan con búsqueda de separadores y comprobación de espacios. El prefijo S3 se recorta mediante índices, conservando barras internas. Los recorridos tienen costo lineal. |
| S6671 | 1 | FileReader conserva su DOMException y aporta un Error alternativo si el motivo es nulo. El recurso fallido puede volver a intentarse. |
| S9011 | 1 | El botón Registrar siniestro declara type=submit. Se conserva su comportamiento de envío actual. |
| S2871 | 1 | Se añadió un comparador ordinal explícito para nombres de migración. Se mantiene la secuencia numerada sin depender de la configuración regional. No se modificó ningún SQL ni su orden efectivo. |
| S5689 | 1 | El Express auxiliar del arnés local desactiva x-powered-by antes de sus rutas. No se añade middleware ni librería a producción. |

Los errores de liberación se registran con los eventos database_connection_release_failed y database_connection_destroy_failed bajo la lista de campos permitidos de Pino. No se serializan SQL, mensajes, stack, credenciales o datos personales. Una liberación fallida tras un commit no transforma un guardado confirmado en un error HTTP que pudiera inducir un reintento duplicado. El cierre se observa y la conexión se descarta. Esta mejora no rediseña todos los flujos preexistentes de rollback ni sustituye la operación y monitorización de la base.

## Verificación

- **147 pruebas aprobadas**, sin omisiones: 130 de servidor y 17 de cliente. La integración de migraciones usó MariaDB local en 127.0.0.1:3307, con bases temporales y limpieza. MySQL en 3306 es otro servicio y no se usó como sustituto de la base de PARAUTOS.
- Se añadieron 24 casos frente a las 123 pruebas previas. Cubren liberación diferida, fallo de liberación y descarte, preservación del error y eliminación de firma, semántica de prefijos S3, validaciones de correo, orden de migraciones y recuperación de FileReader. La prueba existente de privacidad del logger también verifica los nuevos eventos.
- **67 comprobaciones HTTP** aprobadas en bases y adjuntos sintéticos aislados: las 66 del recorrido existente más una comprobación de la cabecera del Express auxiliar. Las dos bases temporales y los archivos de ensayo se limpian al finalizar.
- **97.661 entradas normalizadas de correo** comparadas con la validación anterior, sin diferencias. Se conserva la aceptación histórica, incluidos casos poco estrictos como puntos repetidos. No se presenta como una validación RFC completa ni se endurece silenciosamente el formulario.
- **npm run build:app aprobado**, sin ejecutar el script build que incluye migraciones de despliegue. Continúa la advertencia existente del tamaño de ExcelJS. El CSS conserva index-hh2fvN8w.css: no se alteraron estilos o diseños en esta corrección. No se repitió una auditoría visual completa.
- **SonarQube: cero avisos abiertos** con los mismos perfiles e imágenes. Los tokens temporales fueron revocados; la comprobación final registró cero tokens temporales activos.

Evidencias: `despues/pruebas.log`, `despues/recorrido-http.log`, `despues/http/integracion-local.json`, `despues/equivalencia-correo.json`, `despues/scanner.log`, `despues/metricas.json`, `despues/quality-gate.json`, `despues/correcciones-verificadas.csv` y `despues/validacion.json`.

## Límites y operación

No se añadieron dependencias de ejecución, módulos nativos ni servicios a la aplicación. Express y MariaDB mantienen su arquitectura para Hostinger Cloud Startup. No se desplegó esta versión ni se cambió la base local de negocio o la de Hostinger. Tampoco se hicieron commits o push.

El escáner no ofrece en esta configuración análisis semántico MariaDB, SCA de dependencias, una medición de cobertura ni pruebas de todos los dispositivos. Los avisos de blame ausente siguen correspondiendo a archivos nuevos o modificados sin commit y limitan la atribución y evaluación de código nuevo.

El diagnóstico inicial permanece intacto en INFORME.md y sus exportaciones originales. Las correcciones y su comparación están en este documento y en despues/. El panel disponible en http://127.0.0.1:9000/dashboard?id=parautos-local muestra el último análisis. Para acceder, consultar tools/sonarqube-local/README.md; no se publican credenciales.

## Archivos modificados en esta etapa

- `client/src/order-detail.tsx`
- `client/src/reception-image-errors.test.ts`
- `client/src/reception-svg.ts`
- `server/src/db/migrate.test.ts`
- `server/src/db/migrate.ts`
- `server/src/db/release-connection.test.ts`
- `server/src/db/release-connection.ts`
- `server/src/logging/technical-logger.test.ts`
- `server/src/logging/technical-logger.ts`
- `server/src/modules/attachments/attachment-repository.ts`
- `server/src/modules/attachments/s3-storage.test.ts`
- `server/src/modules/attachments/s3-storage.ts`
- `server/src/modules/orders/final-control-completion-repository.ts`
- `server/src/modules/orders/final-control-delivery-repository.ts`
- `server/src/modules/orders/final-control-reopen-repository.ts`
- `server/src/modules/orders/labor-verification-repository.ts`
- `server/src/modules/orders/order-creation.service.test.ts`
- `server/src/modules/orders/orders-service.ts`
- `server/src/modules/orders/parts-mutation-repository.ts`
- `server/src/modules/orders/pending-claim-repository.ts`
- `server/src/modules/orders/quote-creation-repository.ts`
- `server/src/modules/orders/quote-draft-repository.ts`
- `server/src/modules/orders/quote-mutation-repository.ts`
- `server/src/modules/orders/quote-transition-repository.ts`
- `server/src/modules/orders/reception-draft-repository.ts`
- `server/src/modules/orders/reception-email.test.ts`
- `server/src/modules/setup/service.ts`
- `server/src/modules/users/service.ts`
- `shared/src/index.ts`
- `scripts/audit-local.mjs`
