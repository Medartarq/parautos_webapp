# Análisis local ampliado de PARAUTOS — 25 de octubre de 2026

> **Enter en cantidad:** función implementada y verificada; **155 pruebas aprobadas**, build aprobado y gate pendiente por cobertura, **0 avisos de confiabilidad y 472 de mantenibilidad pendientes**. [Detalle](ENTER-CANTIDAD.md).

> **Corrección posterior de confiabilidad:** los nueve avisos LOW quedaron FIXED; ahora hay **0 avisos de confiabilidad y 472 de mantenibilidad pendientes**. Pasaron 151 pruebas y build:app. Véase el [detalle de correcciones](CORRECCIONES-CONFIABILIDAD.md). Los resultados siguientes son la línea base anterior.


El análisis terminó correctamente con **482 avisos únicos de mantenibilidad**. **Nueve incluyen también un impacto bajo en confiabilidad**: están incluidos en los 482, no se suman. Se registraron cero vulnerabilidades y cero hotspots. Esto no certifica ausencia de defectos o de riesgos de seguridad.

Se utilizó SonarQube Community Build 26.10.0.133078, Scanner CLI 8.1.0.6389 y perfiles **Sonar way comprehensive**, en el proyecto separado `parautos-local-completo`. El análisis anterior con perfil básico queda conservado; los avisos adicionales no equivalen a una regresión de sus 31 correcciones.

## Alcance y límites

Se indexaron 213 archivos; las métricas de producción abarcan 112 archivos y 8 999 líneas de código. Se reconocieron TypeScript, JavaScript, CSS, HTML y JSON. SQL y PowerShell se revisaron como texto/secretos, sin analizador semántico de esos lenguajes. El sensor de texto/secretos examinó 176 archivos. Se excluyeron dependencias descargadas, compilados, cobertura, documentos, datos, imágenes y archivos de entorno.

El análisis SCA de dependencias no está disponible en esta ejecución de Sonar. Como complemento independiente, `npm audit` informó cero vulnerabilidades conocidas. Ambos resultados son acotados a la ejecución y a las bases de reglas consultadas. No se hicieron pruebas de penetración ni una comprobación visual de todas las pantallas en este análisis.

El scanner advirtió falta de información de autoría Git en archivos modificados o aún no versionados. Las métricas globales son utilizables, pero no se acredita con ellas la autoría ni una comparación completa de código nuevo. Se analizó el árbol de trabajo local, no exclusivamente el contenido del commit HEAD.

### Perfiles activos relevantes

| Lenguaje | Perfil | Reglas activas |
|---|---|---|
| CSS | Sonar way comprehensive | 40 |
| JavaScript | Sonar way comprehensive | 424 |
| JSON | Sonar way comprehensive | 0 |
| Secrets | Sonar way comprehensive | 30 |
| TypeScript | Sonar way comprehensive | 439 |
| HTML | Sonar way comprehensive | 60 |

## Resultados e interpretación

| Indicador | Resultado |
|---|---|
| Avisos únicos abiertos | 482, en 35 reglas |
| Impactos de confiabilidad | 9, todos LOW, incluidos en los 482 |
| Bugs / vulnerabilidades según clasificación heredada | 0 / 0 |
| Confiabilidad según impactos de calidad | B |
| Confiabilidad según clasificación heredada | A |
| Seguridad / mantenibilidad | A / A |
| Severidad heredada | 9 CRITICAL, 329 MAJOR, 144 MINOR |
| Cobertura combinada Sonar | 24,0 % |
| Cobertura de líneas Sonar | 29,0 %: 886 de 3 051 |
| Cobertura de condiciones Sonar | 19,2 %: 601 de 3 135 |
| Duplicación detectada por CPD | 0,0 % |
| Complejidad ciclomática / cognitiva | 2 884 / 1 495 |

Las dos calificaciones de confiabilidad usan modelos diferentes: los nueve impactos LOW son CODE_SMELL en la clasificación heredada y no BUG. Los nueve CRITICAL corresponden a complejidad cognitiva, no a nueve incidentes críticos de seguridad. La ausencia de duplicación CPD no invalida los avisos sobre selectores CSS repetidos.

El Quality Gate aparece **OK**, pero `quality-gate.json` contiene **cero condiciones evaluadas**, al ser el primer análisis de este proyecto. No representa aceptación global ni cumplimiento de una meta de cobertura. Tampoco es comparable directamente con el gate anterior de otro proyecto y otra referencia de código nuevo. No se cambiaron umbrales para obtener este resultado.

## Verificación funcional y cobertura

Pasaron **147 pruebas en 54 archivos** y `npm run build:app`. Las pruebas de integración emplearon el entorno local de MariaDB con bases temporales. No se modificó la base de negocio ni se desplegó en Hostinger. Los 67 escenarios HTTP del informe anterior no se contabilizan como repetidos en esta ejecución.

V8/Vitest midió 99 archivos fuente, incluyendo archivos sin pruebas: líneas **31,19 %** (823/2 638), sentencias **23,92 %**, funciones **17,04 %** y ramas **19,17 %**. Sonar y V8 tienen denominadores y alcances distintos; el 24,0 % combinado de Sonar no debe compararse directamente con el 31,19 % de líneas de V8. Sonar incluye además otros archivos analizables fuera del conjunto instrumentado.

| Módulo | Archivos V8 | Líneas cubiertas/medibles | Líneas % | Ramas % |
|---|---|---|---|---|
| client | 30 | 172/1408 | 12.22 | 4.81 |
| server | 68 | 589/1158 | 50.86 | 41.19 |
| shared | 1 | 62/72 | 86.11 | 75.29 |

La cobertura del cliente es el principal vacío. Pasar las pruebas existentes no demuestra que todos los flujos UI estén cubiertos. El build conserva una advertencia por tamaño del bundle de ExcelJS; no bloqueó la compilación.

## Revisión contextual de los nueve impactos de confiabilidad

Se revisaron sus contextos de código. Son candidatos a mejora, no nueve fallos funcionales reproducidos. Los otros avisos se inventariaron íntegramente y se revisaron por familias y ejemplos; no se declara validación manual individual de los 482.

| Archivo:línea | Regla | Evaluación y acción propuesta |
|---|---|---|
| client/src/app.tsx:830 | typescript:S6772 | Espaciado entre texto y controles: revisar cada etiqueta y añadir separación explícita cuando corresponda; verificar diseño y nombre accesible. |
| client/src/quote-editor.tsx:24 | typescript:S6847 | Formulario de cotización: revisar Enter y preventDefault por elemento. Mantener semántica de formulario; no añadir roles artificiales para silenciar la regla. |
| server/src/server.ts:5 | typescript:S7503 | Arranque async sin await: revisar contrato de inicio y manejo de errores de escucha. La regla por sí sola no demuestra un fallo en producción. |
| server/src/modules/attachments/local-storage.ts:10 | typescript:S7781 | replace global ya reemplaza todas las barras inversas. replaceAll sería una simplificación; no hay vulnerabilidad de rutas demostrada por este aviso. |
| client/src/new-order-data-step.tsx:284 | typescript:S6772 | Espaciado entre texto y controles: revisar cada etiqueta y añadir separación explícita cuando corresponda; verificar diseño y nombre accesible. |
| client/src/new-order-media-steps.tsx:149 | typescript:S6772 | Espaciado entre texto y controles: revisar cada etiqueta y añadir separación explícita cuando corresponda; verificar diseño y nombre accesible. |
| client/src/new-order-media-steps.tsx:165 | typescript:S6772 | Espaciado entre texto y controles: revisar cada etiqueta y añadir separación explícita cuando corresponda; verificar diseño y nombre accesible. |
| client/src/new-order-summary-step.tsx:97 | typescript:S6772 | Espaciado entre texto y controles: revisar cada etiqueta y añadir separación explícita cuando corresponda; verificar diseño y nombre accesible. |
| client/src/new-order-summary-step.tsx:105 | typescript:S6772 | Espaciado entre texto y controles: revisar cada etiqueta y añadir separación explícita cuando corresponda; verificar diseño y nombre accesible. |

El manejador de Enter de cotizaciones requiere pruebas de teclado sobre entradas, selectores y botones. Los avisos de espaciado requieren comprobación visual y de accesibilidad. El arranque del servidor merece evaluar los errores asíncronos de escucha, pero este informe no afirma haber reproducido EADDRINUSE.

## Funciones con complejidad cognitiva elevada

| Archivo:línea | Diagnóstico |
|---|---|
| client/src/app.tsx:295 | Refactor this function to reduce its Cognitive Complexity from 65 to the 15 allowed. |
| client/src/app.tsx:755 | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| client/src/full-new-order.tsx:70 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| client/src/full-new-order.tsx:199 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| client/src/full-new-order.tsx:567 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| client/src/reports-view.tsx:34 | Refactor this function to reduce its Cognitive Complexity from 42 to the 15 allowed. |
| server/src/db/migrate.ts:11 | Refactor this function to reduce its Cognitive Complexity from 55 to the 15 allowed. |
| server/src/modules/orders/orders-service.ts:46 | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| client/src/final-control.tsx:30 | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |

Priorizar DashboardContent y ReportsView, seguidos del parser de migraciones y el flujo de recepción. Antes de dividir el parser deben conservarse casos de comillas, comentarios, delimitadores y triggers. Separar componentes o servicios debe preservar permisos, estados, transacciones y apariencia.

## Inventario completo por regla

| Regla | Cantidad | Ejemplo de mensaje del analizador |
|---|---|---|
| css:S4666 | 174 | Duplicate selector ".app-shell", first used at line 142 |
| typescript:S3358 | 62 | Extract this nested ternary operation into an independent statement. |
| typescript:S6759 | 43 | Mark the props of the component as read-only. |
| typescript:S2681 | 43 | This statement will not be executed conditionally; only the first statement will be. The rest will execute unconditionally. |
| typescript:S1874 | 39 | 'FormEvent' is deprecated. |
| typescript:S9382 | 28 | Unexpected `await` inside a loop. |
| typescript:S6819 | 10 | Use <details>, <fieldset>, <optgroup>, or <address> instead of the "group" role to ensure accessibility across all devices. |
| typescript:S3776 | 9 | Refactor this function to reduce its Cognitive Complexity from 65 to the 15 allowed. |
| typescript:S6582 | 8 | Prefer using an optional chain expression instead, as it's more concise and easier to read. |
| css:S7924 | 7 | Text does not meet the minimal contrast requirement with its background. |
| typescript:S6571 | 7 | 'any' overrides all other types in this union type. |
| typescript:S6772 | 6 | Ambiguous spacing after previous element input |
| typescript:S4624 | 6 | Refactor this code to not use nested template literals. |
| typescript:S7785 | 6 | Prefer top-level await over using a promise chain. |
| typescript:S6551 | 5 | 'reader.result' may use Object's default stringification format ('[object Object]') when stringified. |
| typescript:S1121 | 3 | Extract the assignment of "next[Number(id)]" from this expression. |
| typescript:S6479 | 3 | Do not use Array index in keys |
| javascript:S9382 | 3 | Unexpected `await` inside a loop. |
| typescript:S6594 | 2 | Use the "RegExp.exec()" method instead. |
| typescript:S6767 | 2 | 'advisorName' PropType is defined but prop is never used |
| typescript:S107 | 2 | Async function 'updateQuote' has too many parameters (8). Maximum allowed is 7. |
| typescript:S6481 | 1 | The object passed as the value prop to the Context provider changes every render. To fix this consider wrapping it in a useMemo hook. |
| typescript:S6754 | 1 | useState call is not destructured into value + setter pair |
| typescript:S7750 | 1 | Prefer `.findLast(…)` over `.filter(…).at(-1)`. |
| typescript:S6847 | 1 | Non-interactive elements should not be assigned mouse or keyboard event listeners. |
| typescript:S7754 | 1 | Prefer `.some(…)` over `.find(…)`. |
| typescript:S7780 | 1 | `String.raw` should be used to avoid escaping `\`. |
| typescript:S4043 | 1 | Move this array "sort" operation to a separate statement or replace it with "toSorted". |
| javascript:S4043 | 1 | Move this array "reverse" operation to a separate statement or replace it with "toReversed". |
| javascript:S1788 | 1 | Default parameters should be last. |
| typescript:S6644 | 1 | Unnecessary use of boolean literals in conditional expression. |
| typescript:S7503 | 1 | Async function 'start' has no 'await' expression. |
| javascript:S3358 | 1 | Extract this nested ternary operation into an independent statement. |
| javascript:S4624 | 1 | Refactor this code to not use nested template literals. |
| typescript:S7781 | 1 | Prefer `String#replaceAll()` over `String#replace()`. |

### Archivos con más avisos

| Archivo | Avisos |
|---|---|
| client/src/styles.css | 163 |
| client/src/app.tsx | 56 |
| client/src/full-new-order.tsx | 24 |
| client/src/quote-editor.tsx | 15 |
| client/src/reports-view.tsx | 11 |
| server/src/db/migrate.ts | 11 |
| shared/src/index.ts | 11 |
| client/src/full-new-order.css | 10 |
| client/src/reception-detail.tsx | 9 |
| client/src/users-view.tsx | 9 |
| server/src/db/seed-demo.ts | 9 |
| client/src/order-detail.tsx | 8 |
| server/src/modules/orders/labor-verification-repository.ts | 8 |
| client/src/reception.css | 8 |
| server/src/modules/orders/parts-mutation-repository.ts | 7 |

## Propuesta de corrección por etapas

1. Añadir pruebas significativas de recepción, cotización, navegación por teclado y reportes, especialmente en el cliente. Comprobar resultados y estados visibles, no solo la forma del código.
2. Resolver los nueve impactos LOW tras su validación contextual. La sustitución de replace global no es urgente; la semántica de formularios y el manejo de errores requieren más cuidado.
3. Reducir complejidad de dashboard y reportes y proteger con pruebas el parser y las operaciones transaccionales.
4. Revisar las siete advertencias de contraste con estilos calculados, tamaños y estados reales. Consolidar selectores CSS sin alterar cascada, media queries ni orden de aplicación.
5. Revisar APIs obsoletas, claves de listas y estabilidad de contextos. Preservar compatibilidad de beforeunload y contratos de validación. Tratar readonly, llaves y expresiones como mantenimiento posterior.
6. Evaluar cada await dentro de bucles. Migraciones, operaciones sobre una conexión, seeds y limpieza pueden exigir orden: no aplicar Promise.all indiscriminadamente. Usar concurrencia limitada solo cuando las operaciones sean independientes.
7. Repetir pruebas, build y análisis con el mismo perfil y conservar una carpeta por ejecución. Definir después una política explícita de cobertura y gate, sin ocultar avisos para mejorar cifras.

La deuda estimada por Sonar es 2 312 minutos (38 h 32 min); es una heurística del producto, no una estimación de esfuerzo acordada.

## Cambios realizados para este diagnóstico

Se añadió únicamente la dependencia de desarrollo `@vitest/coverage-v8` 5.0.4, la configuración de cobertura y el ejecutor/perfil de análisis ampliado. No se aplicaron nuevas correcciones al código de producto en esta ejecución. Las modificaciones previas del repositorio se conservaron. No se añadieron servicios ni dependencias de ejecución a Hostinger.

Comparación SHA-256 frente al cierre de las correcciones anteriores: 191 archivos comprobados; 0 distintos o ausentes.


## Evidencias y reproducción

- [Inventario individual de los 482 avisos](hallazgos.csv), con clave, archivo, línea, impactos y enlace al panel.
- [Cobertura por archivo](cobertura-por-archivo.csv), [métricas](metricas.json), [gate](quality-gate.json), [perfiles](perfiles.json) y [reglas](reglas.json).
- [Pruebas con cobertura](pruebas-con-cobertura.log), [compilación](compilacion.log), [npm audit](dependencias-audit.json) y [scanner](scanner.log).
- [Fuentes SHA-256](fuentes-sha256.json), [LCOV importado](lcov-importado.info) y [cobertura V8](cobertura-vitest.json).
- Panel local: http://127.0.0.1:9000/dashboard?id=parautos-local-completo
- Ejecutores y pasos: [README de herramientas](../../../tools/sonarqube-local/README.md).

Los tokens temporales se revocan al finalizar el ejecutor; las credenciales locales no se incluyen en las evidencias. El servidor solo está publicado en loopback.

Referencias de método: [perfiles de la versión 26.10](https://community.sonarsource.com/t/sonarqube-community-build-26-10-0-133078-released/189838), [importación LCOV de Sonar](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/test-coverage/javascript-typescript-test-coverage) y [cobertura Vitest](https://main.vitest.dev/guide/coverage).
