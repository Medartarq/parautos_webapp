# Diagnóstico local de confiabilidad de PARAUTOS

Fecha de análisis: 25 de octubre de 2026, America/Lima. Se completó un análisis estático real contra SonarQube local y una revisión contextual de los 31 avisos. No se aplicaron correcciones a la aplicación, no se ejecutaron migraciones y no se conectó este análisis a MariaDB ni a SonarCloud.

## Resultado

Se registraron **30 hallazgos con impacto en confiabilidad** y **1 con impacto en seguridad**. Son 31 avisos en total. En la clasificación heredada aparecen 26 BUG, 4 CODE_SMELL y 1 VULNERABILITY. Los cuatro CODE_SMELL también tienen impacto en confiabilidad en el modelo actual, por lo que 26 BUG no es el total de confiabilidad. No son 30 incidentes de ejecución demostrados.

La métrica de confiabilidad es 4, equivalente a D, tanto en la clasificación heredada como en la métrica software_quality_reliability_rating. El único aviso heredado CRITICAL corresponde al sort() de migraciones, cuyo orden actual es coherente con nombres numerados. Esta calificación automática debe leerse junto con la revisión contextual.

El Quality Gate devolvió OK/PASSED, con conditions=[] e ignoredConditions=false. No contiene condiciones evaluadas en esta respuesta. Por ello no certifica que el código existente esté libre de defectos ni reemplaza la revisión de los 30 avisos. No se modificaron perfiles, severidades, estados de hallazgos ni el gate para obtener ese resultado.

| Medida | Resultado |
|---|---|
| Archivos de código de producción medidos | 107 |
| Líneas de código no vacías/comentarios | 8886 |
| Archivos indexados, incluidas pruebas y otros archivos | 186 |
| TypeScript/JavaScript analizados por el sensor | 155 |
| Confiabilidad | 30 avisos, 5 reglas |
| Seguridad | 1 aviso LOW, 0 hotspots |
| Cobertura mostrada por SonarQube | 0,0 %, sin LCOV importado |

El 0,0 % de cobertura corresponde a la ausencia de un informe de cobertura en esta ejecución; no significa que el proyecto carezca de pruebas. No se volvió a ejecutar la suite ni se midió cobertura como parte de este diagnóstico. Las 123 pruebas documentadas en la auditoría previa son otra evidencia.

## Versiones y alcance

HEAD de referencia: `4c07f7e5425c1b97d45bf42818377a24a5a938b7`, rama `master`. Se analizaron los archivos locales con cambios sin commit y archivos nuevos. `contexto.json` conserva el estado observado. Los avisos de blame ausente son esperables para parte de ese trabajo y limitan la atribución a autores y la comparación de código nuevo.

SonarQube Community Build `26.10.0.133078`, SonarScanner CLI `8.1.0.6389`, analizador JavaScript/TypeScript `14.0.0.46108`, TypeScript interno `6.0.3`. Este último pertenece al analizador y no implica actualizar TypeScript del proyecto. Sonar way core: TypeScript 198 reglas, JavaScript 199 y CSS 25. Se usaron los perfiles predeterminados, sin comparación aún con el perfil real de SonarCloud.

Imagen servidor: `sonarqube@sha256:0b3408443fb6a311253de27941b10977c9b977fd53be2265947bfe14161308b8`.
Imagen escáner: `sonarsource/sonar-scanner-cli@sha256:47956b669bf486bdad919e1cbd0533223515aa0b6d1d31763e5a3754942df6d7`.

El alcance configurado incluye client/src, server/src, shared/src, scripts y database/migrations. Los tests *.test.ts y *.test.tsx se identificaron por separado. Se excluyeron node_modules, compilados y declaraciones generadas. Los lenguajes reconocidos fueron TS, JS y CSS: las migraciones SQL incluidas en el directorio no recibieron análisis semántico MariaDB. Los recursos públicos, dependencias, configuración fuera de esas rutas y datos de adjuntos no tienen cobertura integral de este escáner. El análisis de dependencias SCA se omitió.

## Revisión por regla

Las prioridades siguientes son de esta revisión, no una modificación de la severidad que SonarQube asignó. P1 prioriza el ciclo asíncrono de recursos; P2 aborda robustez y costo de validaciones; P3 incluye explicitud, excepciones contextuales y el arnés auxiliar.

### typescript:S9383 — 24 promesas de liberación sin esperar

Cantidad: 24. Prioridad de revisión: P1.

Patrón confirmado. El tipo y la implementación instalada de MariaDB devuelven Promise<void>. La devolución de la conexión puede finalizar después del caso de uso. Esto no demuestra pérdida de datos ni un rechazo reproducido.

**Propuesta:** Esperar y manejar la liberación de forma consistente, preservando el error original y la limpieza de adjuntos. No usar void solo para silenciar el aviso.

**Verificación necesaria:** Simular liberación pendiente y fallo de limpieza, comprobar orden commit/rollback/release, ausencia de rechazo sin manejar y preservación del error inicial. Revisar dobles que hoy devuelven undefined.

### typescript:S8786 — Expresiones regulares con retroceso

Cantidad: 3. Prioridad de revisión: P2.

Tres coincidencias confirmadas con el patrón señalado. Los dos correos pasan por optionalText(150), que limita longitud antes de superRefine. S3_PREFIX proviene de configuración y el adaptador S3 es opcional. No se acredita una denegación de servicio remota reproducida.

**Propuesta:** Sustituir por validaciones o recorridos de costo acotado conservando la semántica actual. Mantener límites y no cambiar arbitrariamente qué correos se aceptan.

**Verificación necesaria:** Comparar casos válidos e inválidos, longitud máxima, puntos y arrobas repetidos, y prefijos S3 vacíos o compuestos por barras.

### typescript:S6671 — Motivo de rechazo de FileReader

Cantidad: 1. Prioridad de revisión: P2.

Mejora defensiva. reader.error está tipado DOMException|null; el evento de fallo normalmente aporta DOMException. No se observó un fallo real de exportación en este diagnóstico.

**Propuesta:** Conservar DOMException válida y aportar Error alternativo si el motivo es nulo.

**Verificación necesaria:** Simular error de lectura con DOMException y con motivo nulo, comprobar recuperación y reintento de exportación.

### typescript:S2871 — Comparador del orden de migraciones

Cantidad: 1. Prioridad de revisión: P3.

Candidato a excepción contextual. Los nombres 001_... a 025_... están numerados y sort() aplica el orden ordinal esperado. No se reprodujo una secuencia incorrecta. La criticidad automática no equivale aquí a una migración defectuosa confirmada.

**Propuesta:** Mantener el orden de versiones con comparador explícito ordinal o documentar la excepción. No adoptar localeCompare sin revisar si altera puntuación o nombres futuros.

**Verificación necesaria:** Verificar igualdad de secuencia antes/después, prefijos con ceros y nombres adicionales. No ejecutar migraciones contra bases existentes para resolver este aviso.

### typescript:S9011 — Tipo explícito del botón de siniestro

Cantidad: 1. Prioridad de revisión: P3.

Explicitud. Está dentro de un form y su acción prevista es enviar. El tipo implícito submit actual coincide con esa intención.

**Propuesta:** Declarar type="submit" en este botón, sin cambiarlo a button ni duplicar el envío.

**Verificación necesaria:** Comprobar envío una sola vez, validación y acceso por teclado.

### javascript:S5689 — Divulgación de versión en arnés local

Cantidad: 1. Prioridad de revisión: P3.

Un aviso de seguridad LOW en scripts/audit-local.mjs. Su Express exterior atiende rutas auxiliares antes del createApp con Helmet y escucha solo en 127.0.0.1. No prueba una vulnerabilidad equivalente de la aplicación desplegada.

**Propuesta:** Desactivar x-powered-by también en el Express auxiliar y mantener el arnés aislado.

**Verificación necesaria:** Comprobar cabeceras de rutas auxiliares y de la aplicación principal sin exponer datos o sesiones reales.

Para S9383 se inspeccionaron las 24 ubicaciones señaladas: todas son connection.release(). El contrato instalado figura en node_modules/mariadb/types/index.d.ts:197 y pool-promise.js:100 construye una promesa. La implementación actual utiliza una devolución basada en callback, por lo que no se debe afirmar que cada llamada provoca por sí sola un rechazo o una transacción perdida. El await garantiza observar su finalización. Una corrección debe preservar el error principal y la limpieza posterior de archivos.

## Inventario individual

| ID | Prioridad | Regla | Ubicación |
|---|---|---|---|
| SQ-01 | P1 | typescript:S9383 | [server/src/db/migrate.ts:122](../../../server/src/db/migrate.ts#L122) |
| SQ-02 | P1 | typescript:S9383 | [server/src/modules/attachments/attachment-repository.ts:29](../../../server/src/modules/attachments/attachment-repository.ts#L29) |
| SQ-03 | P1 | typescript:S9383 | [server/src/modules/orders/final-control-completion-repository.ts:30](../../../server/src/modules/orders/final-control-completion-repository.ts#L30) |
| SQ-04 | P1 | typescript:S9383 | [server/src/modules/orders/final-control-delivery-repository.ts:10](../../../server/src/modules/orders/final-control-delivery-repository.ts#L10) |
| SQ-05 | P1 | typescript:S9383 | [server/src/modules/orders/final-control-delivery-repository.ts:14](../../../server/src/modules/orders/final-control-delivery-repository.ts#L14) |
| SQ-06 | P1 | typescript:S9383 | [server/src/modules/orders/final-control-reopen-repository.ts:19](../../../server/src/modules/orders/final-control-reopen-repository.ts#L19) |
| SQ-07 | P1 | typescript:S9383 | [server/src/modules/orders/labor-verification-repository.ts:11](../../../server/src/modules/orders/labor-verification-repository.ts#L11) |
| SQ-08 | P1 | typescript:S9383 | [server/src/modules/orders/labor-verification-repository.ts:15](../../../server/src/modules/orders/labor-verification-repository.ts#L15) |
| SQ-09 | P1 | typescript:S9383 | [server/src/modules/orders/orders-service.ts:251](../../../server/src/modules/orders/orders-service.ts#L251) |
| SQ-10 | P1 | typescript:S9383 | [server/src/modules/orders/orders-service.ts:346](../../../server/src/modules/orders/orders-service.ts#L346) |
| SQ-11 | P1 | typescript:S9383 | [server/src/modules/orders/parts-mutation-repository.ts:9](../../../server/src/modules/orders/parts-mutation-repository.ts#L9) |
| SQ-12 | P1 | typescript:S9383 | [server/src/modules/orders/parts-mutation-repository.ts:10](../../../server/src/modules/orders/parts-mutation-repository.ts#L10) |
| SQ-13 | P1 | typescript:S9383 | [server/src/modules/orders/parts-mutation-repository.ts:11](../../../server/src/modules/orders/parts-mutation-repository.ts#L11) |
| SQ-14 | P1 | typescript:S9383 | [server/src/modules/orders/pending-claim-repository.ts:4](../../../server/src/modules/orders/pending-claim-repository.ts#L4) |
| SQ-15 | P1 | typescript:S9383 | [server/src/modules/orders/quote-creation-repository.ts:34](../../../server/src/modules/orders/quote-creation-repository.ts#L34) |
| SQ-16 | P1 | typescript:S9383 | [server/src/modules/orders/quote-draft-repository.ts:33](../../../server/src/modules/orders/quote-draft-repository.ts#L33) |
| SQ-17 | P1 | typescript:S9383 | [server/src/modules/orders/quote-mutation-repository.ts:25](../../../server/src/modules/orders/quote-mutation-repository.ts#L25) |
| SQ-18 | P1 | typescript:S9383 | [server/src/modules/orders/quote-mutation-repository.ts:42](../../../server/src/modules/orders/quote-mutation-repository.ts#L42) |
| SQ-19 | P1 | typescript:S9383 | [server/src/modules/orders/quote-transition-repository.ts:24](../../../server/src/modules/orders/quote-transition-repository.ts#L24) |
| SQ-20 | P1 | typescript:S9383 | [server/src/modules/orders/reception-draft-repository.ts:7](../../../server/src/modules/orders/reception-draft-repository.ts#L7) |
| SQ-21 | P1 | typescript:S9383 | [server/src/modules/setup/service.ts:22](../../../server/src/modules/setup/service.ts#L22) |
| SQ-22 | P1 | typescript:S9383 | [server/src/modules/users/service.ts:43](../../../server/src/modules/users/service.ts#L43) |
| SQ-23 | P1 | typescript:S9383 | [server/src/modules/users/service.ts:59](../../../server/src/modules/users/service.ts#L59) |
| SQ-24 | P1 | typescript:S9383 | [server/src/modules/users/service.ts:90](../../../server/src/modules/users/service.ts#L90) |
| SQ-25 | P2 | typescript:S6671 | [client/src/reception-svg.ts:181](../../../client/src/reception-svg.ts#L181) |
| SQ-26 | P2 | typescript:S8786 | [server/src/modules/attachments/s3-storage.ts:18](../../../server/src/modules/attachments/s3-storage.ts#L18) |
| SQ-27 | P2 | typescript:S8786 | [shared/src/index.ts:162](../../../shared/src/index.ts#L162) |
| SQ-28 | P2 | typescript:S8786 | [shared/src/index.ts:317](../../../shared/src/index.ts#L317) |
| SQ-29 | P3 | typescript:S9011 | [client/src/order-detail.tsx:61](../../../client/src/order-detail.tsx#L61) |
| SQ-30 | P3 | javascript:S5689 | [scripts/audit-local.mjs:61](../../../scripts/audit-local.mjs#L61) |
| SQ-31 | P3 | typescript:S2871 | [server/src/db/migrate.ts:103](../../../server/src/db/migrate.ts#L103) |

El CSV hallazgos-revisados.csv añade el impacto, la evaluación contextual, la corrección y la prueba propuesta para cada ubicación. hallazgos.json conserva las respuestas originales de la API y reglas.json conserva las definiciones de regla.

## Comparación pendiente con SonarCloud

El usuario informó 33 errores de confiabilidad en SonarCloud. Aquí se encontraron 30 impactos de confiabilidad y 1 de seguridad. La diferencia no acredita que se hayan corregido tres: el código local incluye cambios sin commit y se desconocen el commit exacto, perfil, versión de analizadores, exclusiones y clasificación utilizados por Cloud. Falta contrastar la exportación de sus 33 avisos por regla, archivo y rango de líneas. No se accedió al proyecto privado remoto ni se publicaron resultados.

## Acceso y repetición

Panel local: http://127.0.0.1:9000/dashboard?id=parautos-local. El nombre interno para comunicación entre contenedores es parautos-sonarqube; en el navegador se utiliza 127.0.0.1.

La cuenta admin ya no usa la clave predeterminada. La contraseña aleatoria está cifrada mediante DPAPI para el usuario Windows actual en .env.sonar-local, ignorado por Git. No se muestra en este informe. El token temporal de análisis fue revocado: la exportación confirmó cero tokens temporales activos. El archivo cifrado no se debe compartir ni incluir en entregables.

Para consultar las instrucciones de arranque, acceso y repetición, abrir tools/sonarqube-local/README.md. El escáner monta el proyecto en solo lectura. Solo el servidor local recibe el informe. El servidor usa H2 para evaluación local, con volúmenes propios; no es una instalación de producción. El contenedor permanece disponible, sin reinicio automático configurado, y consume recursos mientras esté encendido.

## Siguiente etapa propuesta

1. Resolver el patrón asíncrono en un cambio acotado y verificar el ciclo de conexión, preservación de errores y limpieza de adjuntos.
2. Revisar las tres expresiones regulares conservando semántica y límites.
3. Incorporar mejoras explícitas de botón y errores si se aprueban, y resolver la excepción de orden de migraciones con evidencia.
4. Corregir el encabezado del arnés local como mejora de bajo impacto.
5. Ejecutar pruebas adecuadas y build:app, importar LCOV en una evaluación posterior y repetir el mismo perfil, antes de comparar tendencias.

No se aplicaron estas propuestas en esta etapa.

## Fuentes técnicas

- https://docs.sonarsource.com/sonarqube-community-build/try-out-sonarqube
- https://docs.sonarsource.com/sonarqube-community-build/server-installation/pre-installation/linux
- https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner
- Código local, contrato de MariaDB y exportaciones de esta carpeta.
