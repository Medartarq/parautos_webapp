param([switch]$MostrarAcceso, [string]$ReportDirectory)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path.Replace('\','/')
$base = 'http://127.0.0.1:9000'
$reportDir = "$root/docs/auditoria/sonarqube-local-2026-10-25"
if ($ReportDirectory) { $reportDir = [IO.Path]::GetFullPath($ReportDirectory) }
$secretPath = "$root/.env.sonar-local"
$env:PATH = 'C:/Users/medar/AppData/Local/Programs/DockerDesktop/resources/bin;' + $env:PATH
function Password-FromFile {
    $secure = (Get-Content -LiteralPath $secretPath -Raw).Trim() | ConvertTo-SecureString
    return [System.Net.NetworkCredential]::new('admin',$secure).Password
}
if ($MostrarAcceso) {
    Write-Host 'URL: http://127.0.0.1:9000    Usuario: admin'
    Write-Host ('Clave local: ' + (Password-FromFile))
    exit
}
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
function Set-Auth([string]$password) {
    $script:headers = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('admin:' + $password)) }
}
function Api([string]$endpoint, [string]$method='Get', $body=$null) {
    $requestParameters = @{ Uri = "$base/api/$endpoint"; Method=$method; Headers=$script:headers; TimeoutSec=60 }
    if ($null -ne $body) { $requestParameters.Body=$body }
    return Invoke-RestMethod @requestParameters
}
function Save-Json($value,[string]$name) {
    ConvertTo-Json -InputObject $value -Depth 40 | Set-Content -LiteralPath "$reportDir/$name" -Encoding UTF8
}
if (Test-Path -LiteralPath $secretPath) {
    Set-Auth (Password-FromFile)
} else {
    Set-Auth 'admin'
    $password = 'Pa!' + [guid]::NewGuid().ToString('N') + 'Q9' + [guid]::NewGuid().ToString('N')
    $password | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $secretPath -Encoding ASCII
    Api 'users/change_password' 'Post' @{ login='admin'; previousPassword='admin'; password=$password } | Out-Null
    Set-Auth $password
    $password=$null
}
if (-not (Api 'authentication/validate').valid) { throw 'Autenticacion local no valida' }
$project = Api 'projects/search?projects=parautos-local'
if ($project.paging.total -eq 0) {
    Api 'projects/create' 'Post' @{ project='parautos-local'; name='PARAUTOS auditoria local'; visibility='private' } | Out-Null
}
$serverVersion=Invoke-RestMethod -Uri "$base/api/server/version"
$serverImage=docker image inspect sonarqube:community --format '{{json .RepoDigests}}'
$scannerImage=docker image inspect sonarsource/sonar-scanner-cli:latest --format '{{json .RepoDigests}}'
Save-Json ([ordered]@{ version=$serverVersion; serverImage=$serverImage; scannerImage=$scannerImage; head=(git rev-parse HEAD); branch=(git branch --show-current); capturedAt=(Get-Date -Format o); workingTree=(git status --porcelain); scope='Codigo local con cambios sin commit. Sin cobertura LCOV importada.' }) 'contexto.json'
Save-Json (Api 'qualityprofiles/search?project=parautos-local') 'perfiles.json'
$tokenName='parautos-local-' + [guid]::NewGuid().ToString('N')
try {
    $generated=Api 'user_tokens/generate' 'Post' @{ name=$tokenName; type='PROJECT_ANALYSIS_TOKEN'; projectKey='parautos-local'; expirationDate=(Get-Date).AddDays(1).ToString('yyyy-MM-dd') }
    $env:SONAR_TOKEN=$generated.token
    $generated=$null
    Write-Output 'Ejecutando scanner contra el servidor local...'
    docker run --rm --name parautos-sonar-scanner --network parautos-sonar-local --memory 6g --cpus 4 --mount "type=bind,source=$root,target=/usr/src,readonly" --mount 'type=volume,source=parautos_sonar_scanner_cache,target=/opt/sonar-scanner/.sonar/cache' -e SONAR_HOST_URL=http://parautos-sonarqube:9000 -e SONAR_TOKEN sonarsource/sonar-scanner-cli@sha256:47956b669bf486bdad919e1cbd0533223515aa0b6d1d31763e5a3754942df6d7 '-Dproject.settings=tools/sonarqube-local/sonar-project.properties' '-Dsonar.qualitygate.wait=true' '-Dsonar.qualitygate.timeout=600' 2>&1 | Tee-Object -FilePath "$reportDir/scanner.log"
    $scanExit=$LASTEXITCODE
    Write-Output "Scanner terminado. Codigo: $scanExit. Exportando diagnostico."
    Save-Json (Api 'ce/component?component=parautos-local') 'procesamiento.json'
    $metricList=(Api 'metrics/search?ps=500').metrics.key
    $wanted=@('ncloc','files','bugs','vulnerabilities','code_smells','reliability_rating','security_rating','sqale_rating','coverage','duplicated_lines_density','security_hotspots','software_quality_reliability_issues','software_quality_security_issues','software_quality_maintainability_issues','software_quality_reliability_rating')
    $keys=($wanted | Where-Object { $_ -in $metricList }) -join ','
    Save-Json (Api ('measures/component?component=parautos-local&metricKeys='+$keys)) 'metricas.json'
    Save-Json (Api 'qualitygates/project_status?projectKey=parautos-local') 'quality-gate.json'
    Save-Json (Api 'qualityprofiles/search?project=parautos-local') 'perfiles.json'
    $issues=@();$page=1
    do {
        $batch=Api "issues/search?componentKeys=parautos-local&ps=500&p=$page"
        $issues+=@($batch.issues)
        $page++
    } while ($issues.Count -lt $batch.paging.total -and $page -le 20)
    Save-Json ([ordered]@{ total=$batch.paging.total; exported=$issues.Count; issues=$issues }) 'hallazgos.json'
    Save-Json (Api 'hotspots/search?project=parautos-local&ps=500') 'hotspots.json'
    $openIssues=@($issues | Where-Object { -not $_.resolution -and $_.status -notin @('CLOSED','RESOLVED') })
    Save-Json ([ordered]@{ total=$openIssues.Count; issues=$openIssues }) 'hallazgos-abiertos.json'
    $reliable=@($openIssues | Where-Object { $_.type -eq 'BUG' -or @($_.impacts | Where-Object { $_.softwareQuality -eq 'RELIABILITY' }).Count -gt 0 })
    Save-Json $reliable 'confiabilidad.json'
    $ruleKeys=@($reliable.rule | Sort-Object -Unique)
    $rules=@(foreach ($ruleKey in $ruleKeys) { (Api ('rules/show?key='+[uri]::EscapeDataString($ruleKey))).rule })
    Save-Json $rules 'reglas-confiabilidad.json'
    Save-Json ([ordered]@{ scannerExitCode=$scanExit; historicalIssues=$issues.Count; issues=$openIssues.Count; reliability=$reliable.Count; rules=$ruleKeys.Count; tokenRevokedOnExit=$true }) 'resumen.json'
    Write-Output "Exportados $($issues.Count) registros historicos, $($openIssues.Count) abiertos y $($reliable.Count) de confiabilidad."
} finally {
    Remove-Item Env:SONAR_TOKEN -ErrorAction SilentlyContinue
    Api 'user_tokens/revoke' 'Post' @{ name=$tokenName } | Out-Null
}
