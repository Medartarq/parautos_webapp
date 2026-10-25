$ErrorActionPreference = 'Stop'
$dockerBin = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin'
if (Test-Path -LiteralPath $dockerBin) { $env:PATH = $dockerBin + ';' + $env:PATH }
docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Abra Docker Desktop y espere a que el motor Linux este listo.' }
& wsl.exe -d docker-desktop -u root -- sysctl -w vm.max_map_count=524288
if ($LASTEXITCODE -ne 0) { throw 'No se pudo aplicar el limite requerido por Elasticsearch.' }
docker network inspect parautos-sonar-local --format '{{.Name}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    docker network create parautos-sonar-local
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la red local.' }
}
foreach ($volume in @('parautos_sonar_data','parautos_sonar_logs','parautos_sonar_extensions','parautos_sonar_scanner_cache')) {
    docker volume create $volume | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar $volume" }
}
docker container inspect parautos-sonarqube --format '{{.State.Status}}' 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    docker start parautos-sonarqube
} else {
    docker run -d --name parautos-sonarqube --network parautos-sonar-local --restart no --memory 6g --cpus 4 --ulimit nofile=131072:131072 --ulimit nproc=8192:8192 -p 127.0.0.1:9000:9000 -e SONAR_TELEMETRY_ENABLE=false -v parautos_sonar_data:/opt/sonarqube/data -v parautos_sonar_logs:/opt/sonarqube/logs -v parautos_sonar_extensions:/opt/sonarqube/extensions sonarqube@sha256:0b3408443fb6a311253de27941b10977c9b977fd53be2265947bfe14161308b8
}
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el contenedor.' }
Write-Output 'SonarQube se esta iniciando. Panel: http://127.0.0.1:9000'
