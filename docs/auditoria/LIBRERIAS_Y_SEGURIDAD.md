# Librerías, eficiencia y protección de información

Actualización del 25/10/2026 sobre el árbol local auditado y reconciliado con `origin/master`. Se conserva el trabajo previo del usuario. No se hizo commit, push ni despliegue.

## Cambios implementados

| Área | Implementación | Resultado y límite |
|---|---|---|
| Registro técnico | Pino 10.4.0 en servidor, dependencia y bloqueo versionados | JSON en stdout, sin transportes, workers adicionales, ficheros de log propios ni colector externo. No se modificó la auditoría funcional de MariaDB. |
| Privacidad del log | Lista explícita de campos admitidos y redacción defensiva | Fecha, evento, requestId, método, estado, duración, tipo de error y errno numérico. Se omiten URL/query, cuerpos, cabeceras, nombres de archivo, entorno, SQL, mensajes, stack y causas del error. No se busca filtrar texto libre: ese texto no se serializa. |
| Seguimiento de fallos | Middleware HTTP, arranque y fallos de scripts de migración/seed | Correlación con X-Request-Id sin exponer el error original al log. La menor cantidad de detalle es intencionada; para investigar se reproduce el fallo con datos de prueba. |
| Consultas | TanStack Query 5.104.3, ya instalada | Panel, listado de órdenes y bandeja de cotizaciones comparten la consulta de órdenes; notificaciones y resumen tienen claves propias. Los demás módulos mantienen sus consultas actuales. |
| Aislamiento | Claves con usuario, modo principal/demo y recurso | La interfaz espera el estado demo del superadministrador antes de montar consultas de negocio. Si no se puede verificar, ofrece reintento y no asume un modo. |
| Ciclo de sesión | Cancelación y limpieza tras login/logout/cambio demo exitosos | Las consultas reciben AbortSignal. Una respuesta tardía no restaura la caché eliminada. Si logout falla, no se simula una revocación ni se abandona la sesión. |
| Actualizaciones | Invalidación tras escrituras de órdenes y adjuntos | Se cancelan lecturas anteriores, se invalidan lista/resumen/notificaciones y se actualizan las consultas activas. El autoguardado de recepción/cotización no invalida listados. La carga de diagnóstico usa ahora el mismo cliente API. |
| Caché | Sólo memoria del navegador | Frescura 15 s, eliminación tras 5 min inactiva; actualización al montar, volver al foco o invalidar. Sin persistencia añadida en localStorage/IndexedDB, sin polling. |
| Reintentos | Máximo un reintento para lecturas recuperables | No se reintentan 4xx ni se configura repetición automática de mutaciones. Los formularios existentes siguen enviando mediante API; no se atribuye una migración completa a useMutation. |

## Compatibilidad con Hostinger Cloud Startup

El usuario indicó que la aplicación debe funcionar exclusivamente en Cloud Startup, con recursos compartidos, sin servicios independientes ni compilación nativa garantizada. Esta etapa añade una librería JavaScript de logging y aprovecha otra del navegador; mantiene Express y MariaDB, sin Redis, Docker, PM2/cluster ni nuevos procesos persistentes. Los scripts de instalación no se ejecutaron para incorporar Pino. `LOG_LEVEL` es opcional y está documentado en `.env.example`; un valor desconocido se rechaza por el esquema de entorno.

No se incorporan Sharp ni ClamAV: no se dispone de confirmación de binarios nativos compatibles ni de un servicio antivirus ejecutable en el plan. No se enviaron adjuntos a servicios públicos de análisis ni se transformaron originales. La limitación actual de validación de imágenes sigue siendo la descrita en la auditoría: tipos/tamaño y firma binaria básica, sin equivaler a un escaneo de malware o decodificación exhaustiva.

La retención, cuota y acceso a stdout deben mantenerse bajo control desde el hosting; la aplicación no añade una política de eliminación de logs de plataforma. No se midieron los límites reales de RAM/NPROC ni se validó esta versión desplegada en Hostinger. Las pruebas locales no sustituyen esa validación.

## Verificación y evidencias

- `npm run build:app`: aprobado; CSS mantiene `index-hh2fvN8w.css`. El chunk principal es aproximadamente 437.63 kB sin comprimir; el aviso existente de ExcelJS de 929.40 kB continúa y no se atribuye una reducción global del bundle.
- Suite con MariaDB local autorizada y bases temporales: **108 pruebas de servidor + 15 de cliente**, todas aprobadas. [Salida](2026-10-25/evidencia/pruebas-librerias.txt).
- Se añadieron 8 casos respecto a las 115 pruebas anteriores: 2 de logging, 3 de ciclo de caché y 3 de interacción API/caché. Las pruebas simulan valores sensibles y comprueban que no aparezcan; no utilizan secretos reales.
- Un caso comprueba que dos lecturas concurrentes y otra dentro del tiempo de frescura usan una sola ejecución del queryFn. Es evidencia de deduplicación, no un benchmark de ahorro global o de rendimiento de producción.
- Arnés aislado real: **66 comprobaciones HTTP** con 25 migraciones, incluyendo adjuntos, permisos, snapshots, cierre de órdenes y aislamiento demo. [Resultado](2026-10-25/evidencia/integracion-local.json). Las bases y carpetas temporales se limpian al finalizar.
- Navegador: filtro del panel, órdenes, cotizaciones y alternancia principal/demo. Se observaron seis órdenes en la base principal sintética y cero en demo; al salir de demo reaparecieron las seis. Logout volvió al acceso. [Principal](2026-10-25/evidencia/librerias-ordenes-principal.jpg), [demo](2026-10-25/evidencia/librerias-demo-aislado.jpg).
- Durante la revisión visual se detectó un `0` residual por el campo numérico `claimPending`; se corrigió la condición a Boolean y se comprobó de nuevo con la compilación final.
- Instalación de Pino desde npm: auditoría de instalación sin vulnerabilidades reportadas en ese momento; no representa garantía permanente de ausencia de vulnerabilidades.

## Referencias técnicas consultadas

- [Pino: redacción](https://github.com/pinojs/pino/blob/main/docs/redaction.md).
- [TanStack Query: cancelación](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
- [TanStack Query: invalidación](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation).

Los cambios no alteran esquemas ni datos existentes, contratos HTTP, permisos, documentos originales ni configuración de almacenamiento local/S3. La modificación visible prevista es únicamente el estado de verificación/reintento si no se puede determinar el modo de trabajo; no se rediseñaron pantallas.


## Limpieza de dependencias sin uso — 25/10/2026

Se retiraron `react-router-dom` y la dependencia directa `html2canvas` de `client/package.json`, y npm actualizó el bloqueo y la instalación local (cuatro paquetes retirados del árbol instalado). `react-router` y `react-router-dom` ya no figuran como entradas de paquete en el bloqueo ni están instalados. `html2canvas` permanece como dependencia opcional transitiva de jsPDF y conserva su chunk; no se modificó el código de terceros ni se excluyeron arbitrariamente sus módulos opcionales. Se conservan las referencias históricas de auditoría como documentación, no como dependencias ejecutables.

Se inspeccionaron importaciones estáticas, dinámicas y de tipos con el parser de TypeScript: las veinte declaraciones restantes de dependencias de ejecución entre los tres workspaces tienen referencias en código propio. Los tipos y herramientas de desarrollo se conservan por su uso en TypeScript, Vite, Vitest y scripts. S3 se conserva por su adaptador opcional activo. Evidencia: `2026-10-25/evidencia/dependencias-en-uso.json`.

Verificación posterior: compilación aprobada y 123 pruebas aprobadas (108 servidor + 15 cliente, incluida MariaDB temporal). Salida: `2026-10-25/evidencia/pruebas-limpieza-dependencias.txt`. CSS conserva el hash `index-hh2fvN8w.css`; no se atribuye una reducción del bundle a paquetes que ya quedaban fuera del código ejecutado. No se añadieron pruebas que sólo reflejen el manifiesto, ni se repitió la revisión visual completa por este cambio de dependencias. Hostinger permanece sin cambios.
