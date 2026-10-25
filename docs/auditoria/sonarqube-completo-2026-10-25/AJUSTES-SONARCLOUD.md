# Tres avisos señalados en SonarCloud

## Correcciones locales

| Aviso | Causa | Solución |
|---|---|---|
| PowerShell S8626 en Analizar.ps1 | El helper Api asignaba un diccionario a `$args`, una variable automática de PowerShell. | Se usa `$requestParameters` tanto al crear el diccionario como al agregar Body y pasarlo a Invoke-RestMethod. |
| PowerShell S8626 en AnalizarCompleto.ps1 | El mismo patrón estaba repetido en el ejecutor ampliado. | Se aplicó el mismo cambio de nombre conservando URL, método, cabeceras y timeout. |
| TypeScript S7503 en client/reliability-check.tsx | Una página temporal simulaba fetch con async sin await. | La página de prueba y su HTML ya están retirados del árbol local. Se conserva su eliminación pendiente en Git; no se reintroduce código temporal para resolver un aviso de un archivo que no debe distribuirse. |

## Verificación

Pasaron **14 comprobaciones locales**: sintaxis de ambos scripts, ausencia de asignaciones a la variable automática, existencia del helper, GET sin cuerpo, POST con cuerpo, POST con diccionario vacío y ausencia de los dos archivos temporales. Se extrajo y ejecutó únicamente el helper con Invoke-RestMethod simulado, sin utilizar credenciales, Docker ni red. `git diff --check` no informó errores en los dos scripts.

El análisis local anterior no disponía de analizador semántico de PowerShell; por ello sus resultados no descartaban los dos avisos S8626 mostrados por SonarCloud. Estas correcciones no cambian el código de negocio y no requieren repetir las pruebas de MariaDB ni desplegar la aplicación.

No se ejecutó commit, push ni un análisis remoto. SonarCloud debe analizar una revisión que incluya los dos scripts corregidos y la eliminación de la página temporal antes de confirmar el cierre de los tres avisos. No se han marcado como falsos positivos ni se han ocultado mediante exclusiones.
