param([switch]$WithNdk)
$ErrorActionPreference = 'Stop'
$agriRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$agriSdk = Join-Path $agriRoot '.local\android-sdk'
$agriArchive = Join-Path $agriRoot '.local\android-commandline-tools.zip'
$agriExpectedHash = '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a'
New-Item -ItemType Directory -Path $agriSdk -Force | Out-Null
$agriManager = Join-Path $agriSdk 'cmdline-tools\bin\sdkmanager.bat'
if (-not (Test-Path -LiteralPath $agriManager)) {
    $agriValid = (Test-Path -LiteralPath $agriArchive) -and ((Get-FileHash -LiteralPath $agriArchive -Algorithm SHA256).Hash.ToLowerInvariant() -eq $agriExpectedHash)
    if (-not $agriValid) {
        & curl.exe -4 -L -C - --connect-timeout 30 --max-time 1800 --fail --silent --show-error 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' -o $agriArchive
        if ($LASTEXITCODE -ne 0) { throw 'Android tools download is incomplete. Run this script again to resume.' }
    }
    if ((Get-FileHash -LiteralPath $agriArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $agriExpectedHash) { throw 'Android tools checksum mismatch.' }
    Expand-Archive -LiteralPath $agriArchive -DestinationPath $agriSdk
}
$env:ANDROID_HOME = $agriSdk
$env:ANDROID_SDK_ROOT = $agriSdk
1..100 | ForEach-Object { 'y' } | & $agriManager "--sdk_root=$agriSdk" --licenses
if ($LASTEXITCODE -ne 0) { throw 'Android SDK license step did not complete.' }
$agriPackages = @('platform-tools','platforms;android-37.0','build-tools;36.0.0','build-tools;37.0.0','cmake;3.22.1')
if ($WithNdk) { $agriPackages += 'ndk;27.1.12297006' }
& $agriManager "--sdk_root=$agriSdk" @agriPackages
if ($LASTEXITCODE -ne 0) { throw 'Android SDK installation did not complete. Run this script again to retry.' }
Write-Output ('Android SDK ready: ' + $agriSdk)
