param([string]$InterfaceAlias = '')
$ErrorActionPreference = 'Stop'
$agriRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$agriNode = (Get-Command node.exe -ErrorAction Stop).Source
$agriNetworks = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address -and (-not $InterfaceAlias -or $_.InterfaceAlias -eq $InterfaceAlias) })
if ($agriNetworks.Count -ne 1) { throw 'Choose one connected network with -InterfaceAlias (for example Wi-Fi).' }
$agriIp = [string]$agriNetworks[0].IPv4Address[0].IPAddress
$agriUrl = 'http://' + $agriIp + ':3001'
$agriLogs = Join-Path $agriRoot '.local\lan-test'
New-Item -ItemType Directory -Path $agriLogs -Force | Out-Null
Push-Location -LiteralPath $agriRoot
try {
    & npm.cmd run api:build
    if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
    if (-not (Get-NetTCPConnection -State Listen -LocalPort 55432 -ErrorAction SilentlyContinue)) {
        Start-Process -FilePath $agriNode -ArgumentList @('scripts/local-postgres.mjs') -WorkingDirectory $agriRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $agriLogs 'postgres.log') -RedirectStandardError (Join-Path $agriLogs 'postgres-error.log') | Out-Null
        $agriDeadline = [DateTime]::UtcNow.AddSeconds(25)
        while (-not (Get-NetTCPConnection -State Listen -LocalPort 55432 -ErrorAction SilentlyContinue)) {
            if ([DateTime]::UtcNow -gt $agriDeadline) { throw 'PostgreSQL did not start. Check .local\lan-test\postgres-error.log.' }
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not (Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue)) {
        $agriEnvArgument = '--env-file-if-exists="' + (Join-Path $agriRoot '.local\api.env') + '"'
        Start-Process -FilePath $agriNode -ArgumentList @($agriEnvArgument, 'dist/main.js') -WorkingDirectory (Join-Path $agriRoot 'apps\api') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $agriLogs 'api.log') -RedirectStandardError (Join-Path $agriLogs 'api-error.log') | Out-Null
    }
    $agriDeadline = [DateTime]::UtcNow.AddSeconds(25)
    while ($true) {
        try {
            $agriHealth = Invoke-RestMethod -Uri ($agriUrl + '/api/health') -TimeoutSec 2
            if ($agriHealth.status -ne 'ok' -or $agriHealth.service -ne 'AgriStock') { throw 'Unexpected health response.' }
            break
        } catch {
            if ([DateTime]::UtcNow -gt $agriDeadline) { throw 'API did not become ready. Check .local\lan-test\api-error.log.' }
            Start-Sleep -Milliseconds 500
        }
    }
    [IO.File]::WriteAllText((Join-Path $agriLogs 'connection.json'), (@{ apiUrl = $agriUrl; interfaceAlias = $agriNetworks[0].InterfaceAlias; healthUrl = $agriUrl + '/api/health' } | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Write-Output ('Server ready: ' + $agriUrl)
    Write-Output ('Open on the phone first: ' + $agriUrl + '/api/health')
    Write-Output 'Use the same Wi-Fi and keep this computer awake. No Metro or Expo Go is needed for the LAN test APK.'
} finally { Pop-Location }
