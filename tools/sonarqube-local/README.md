# SonarQube local de PARAUTOS

Instalación de evaluación en Docker Desktop con WSL 2. No forma parte de la aplicación de Hostinger, no accede a MariaDB y no requiere cambios en sus variables. SonarQube usa H2 y volúmenes separados. Se conserva sin reinicio automático para que el usuario controle el consumo de recursos.

## Estado y resultado inicial

- Panel: http://127.0.0.1:9000/dashboard?id=parautos-local
- SonarQube Community Build 26.10.0.133078, escáner 8.1.0.6389.
- 30 impactos de confiabilidad y 1 de seguridad, sin correcciones automáticas.
- [Informe y límites](../../docs/auditoria/sonarqube-local-2026-10-25/INFORME.md).
- La primera captura contiene cambios locales sin commit. No se atribuye identidad exacta con los 33 hallazgos de SonarCloud.

Actualización tras correcciones: **0 avisos abiertos de confiabilidad y seguridad**, con los 31 originales cerrados automáticamente como FIXED y 147 pruebas aprobadas. El Quality Gate de la segunda ejecución falla únicamente por cobertura de código nuevo sin LCOV importado. Consultar [correcciones y verificación](../../docs/auditoria/sonarqube-local-2026-10-25/CORRECCIONES.md).

## Acceso al panel

Usuario: `admin`. La contraseña predeterminada fue sustituida. Para consultar la contraseña local **en tu propia consola**, desde la raíz del proyecto ejecuta con PowerShell 7:

```powershell
./tools/sonarqube-local/Analizar.ps1 -MostrarAcceso
```

Con ese parámetro solo muestra el acceso y termina. No ejecuta un análisis ni cambia la cuenta. No pegues la contraseña en el chat ni publiques la salida. El archivo `.env.sonar-local` contiene la clave cifrada con DPAPI para el usuario Windows que hizo la instalación. Está ignorado por Git. No lo borres si deseas conservar el acceso ni lo incluyas en entregables. No se guardan tokens de análisis en él.

## Arranque después de cerrar Docker o reiniciar

1. Abrir Docker Desktop y esperar al motor Linux.
2. Desde PowerShell, en la raíz del proyecto:

```powershell
./tools/sonarqube-local/Iniciar.ps1
```

El script verifica Docker, aplica el límite `vm.max_map_count=524288` en la máquina WSL de Docker, prepara la red y volúmenes si faltan e inicia el servidor. El puerto se publica únicamente en `127.0.0.1:9000`. Las imágenes están fijadas por digest en la creación del servidor y la ejecución del escáner. Si el contenedor ya existe, se conserva su configuración.

Esperar a que el servicio responda `UP`:

```powershell
Invoke-RestMethod http://127.0.0.1:9000/api/system/status
```

## Repetir el análisis

```powershell
./tools/sonarqube-local/Analizar.ps1
```

Para conservar resultados anteriores, indicar otra carpeta de exportación:

```powershell
./tools/sonarqube-local/Analizar.ps1 -ReportDirectory ./docs/auditoria/sonarqube-local-2026-10-25/nueva-ejecucion
```

`hallazgos.json` conserva también registros históricos cerrados; `hallazgos-abiertos.json`, `confiabilidad.json` y el resumen separan los pendientes actuales. No sumar avisos CLOSED/FIXED como problemas abiertos.

El ejecutor utiliza la cuenta local cifrada, emite un token de análisis del proyecto con vencimiento y lo revoca al terminar. Monta el repositorio en solo lectura y guarda resultados en `docs/auditoria/sonarqube-local-2026-10-25`. **Una repetición sobrescribe las exportaciones de esa carpeta**, por lo que debe copiarse antes para comparar líneas base. El servidor conserva su historial en sus propios volúmenes.

La configuración está en `sonar-project.properties`. Fuentes: client/src, server/src, shared/src, scripts y database/migrations. Pruebas identificadas por patrones *.test.ts y *.test.tsx. El sensor solo reconoció TS, JS y CSS en la primera ejecución. No se incorpora cobertura LCOV ni análisis de dependencias SCA. No se ejecutan tests, migraciones, seeds, build ni escrituras en la base de datos de PARAUTOS.

Un código de salida no cero del escáner puede representar fallo del análisis o del Quality Gate: revisar `scanner.log` y `procesamiento.json` antes de interpretar las métricas. No se debe confundir un gate aprobado sin condiciones evaluadas con cero defectos. No cambiar reglas ni excluir archivos con el único fin de mejorar el número.

## Análisis ampliado con cobertura

El proyecto separado `parautos-local-completo` usa los perfiles instalados **Sonar way comprehensive**. Conserva el proyecto básico y sus resultados. Requiere las dependencias de desarrollo instaladas, Docker y SonarQube activos.

Desde la raíz del repositorio, configurar las variables `MIGRATION_TEST_DB_HOST`, `MIGRATION_TEST_DB_PORT`, `MIGRATION_TEST_DB_USER` y `MIGRATION_TEST_DB_PASSWORD` para una cuenta de pruebas local que pueda crear y eliminar bases temporales. No usar una base de producción ni guardar secretos en los informes.

```powershell
npm exec vitest -- run --config tools/sonarqube-local/vitest.coverage.config.mts --coverage
./tools/sonarqube-local/AnalizarCompleto.ps1
```

La configuración instrumenta también fuentes sin pruebas y resuelve el paquete compartido a su fuente TypeScript. El ejecutor importa el LCOV generado, normaliza sus rutas para el contenedor y exporta perfiles, reglas, métricas, hallazgos y hotspots. No ejecuta las pruebas por sí mismo: regenerar cobertura después de cambiar código.

La carpeta predeterminada es `docs/auditoria/sonarqube-completo-2026-10-25`. **Repetir sobrescribe exportaciones**: usar `-ReportDirectory` con otra carpeta para conservar una comparación. El informe interpretativo y los CSV de esta auditoría son artefactos adicionales, no se regeneran automáticamente con el ejecutor. SQL y PowerShell solo reciben inspección de texto/secretos; npm audit complementa el análisis de dependencias.

Para mostrar el acceso local en una consola privada puede usarse `./tools/sonarqube-local/AnalizarCompleto.ps1 -MostrarAcceso`. No copiar esa salida a documentos ni al repositorio.

## Detener el servidor

Desde una consola nueva en la que Docker esté en el PATH:

```powershell
docker stop parautos-sonarqube
```

La detención conserva el diagnóstico y los volúmenes. No hace falta eliminar bases, imágenes ni contenedores para pausar el trabajo. Mantener Docker y los datos de SonarQube únicamente en el equipo local.

## Alcance de los archivos

`Iniciar.ps1`, `Analizar.ps1` y la configuración son herramientas de desarrollo local. No añadirlos a los comandos de arranque o despliegue de Hostinger. El repositorio conserva su arquitectura React, Express y MariaDB.
