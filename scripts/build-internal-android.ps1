param(
    [string]$ApiUrl = '',
    [ValidateRange(1,2100000000)][int]$VersionCode = 1
)
$ErrorActionPreference = 'Stop'
$agriRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$agriMobile = Join-Path $agriRoot 'apps\mobile'
$agriOrigin = $null
if ($ApiUrl) {
try { $agriOrigin = [Uri]$ApiUrl } catch { throw 'A valid HTTPS API origin is required.' }
if (-not $agriOrigin.IsAbsoluteUri -or $agriOrigin.Scheme -ne 'https' -or $agriOrigin.UserInfo -or $agriOrigin.Query -or $agriOrigin.Fragment -or $agriOrigin.AbsolutePath -ne '/' -or $agriOrigin.IsLoopback -or $agriOrigin.Host -eq '10.0.2.2') {
    throw 'Use the operational HTTPS API origin reachable by phones, without a path, query or embedded credentials.'
}
}
$agriSdk = Join-Path $agriRoot '.local\android-sdk'
if ($env:ANDROID_HOME -and (Test-Path -LiteralPath $env:ANDROID_HOME)) { $agriSdk = $env:ANDROID_HOME }
$agriSigner = Join-Path $agriSdk 'build-tools\37.0.0\apksigner.bat'
if (-not (Test-Path -LiteralPath $agriSigner)) { throw 'Android build-tools 37.0.0 are missing. Finish scripts\setup-android.ps1 -WithNdk first.' }
& (Join-Path $PSScriptRoot 'setup-ninja.ps1') -SdkPath $agriSdk
& (Join-Path $PSScriptRoot 'init-android-signing.ps1')
$agriPrivate = Join-Path $agriRoot '.local\android-release'
$agriSigning = Get-Content -LiteralPath (Join-Path $agriPrivate 'signing.json') -Raw | ConvertFrom-Json
$agriStore = [IO.Path]::GetFullPath((Join-Path $agriPrivate $agriSigning.keystoreFile))
if (-not $agriStore.StartsWith($agriPrivate + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Signing keystore must stay inside its private directory.' }
if (-not (Test-Path -LiteralPath $agriStore)) { throw 'The configured release keystore does not exist.' }
$agriNames = @('AGRISTOCK_RELEASE','AGRISTOCK_LAN_TEST','AGRISTOCK_LOCAL_RELEASE_SIGNING','AGRISTOCK_ALLOW_HTTP','EXPO_PUBLIC_API_URL','AGRISTOCK_ANDROID_VERSION_CODE','AGRISTOCK_KEYSTORE_PATH','AGRISTOCK_KEYSTORE_PASSWORD','AGRISTOCK_KEY_ALIAS','AGRISTOCK_KEY_PASSWORD','CI','EXPO_NO_GIT_STATUS','ANDROID_HOME','ANDROID_SDK_ROOT')
$agriPrevious = @{}
foreach ($agriName in $agriNames) { $agriPrevious[$agriName] = [Environment]::GetEnvironmentVariable($agriName, 'Process') }
try {
    $env:AGRISTOCK_RELEASE = '1'
    $env:AGRISTOCK_LOCAL_RELEASE_SIGNING = '1'
    $env:AGRISTOCK_ALLOW_HTTP = '0'
    if ($agriOrigin) { $env:EXPO_PUBLIC_API_URL = $agriOrigin.GetLeftPart([UriPartial]::Authority) }
    else { [Environment]::SetEnvironmentVariable('EXPO_PUBLIC_API_URL', $null, 'Process') }
    $env:AGRISTOCK_ANDROID_VERSION_CODE = [string]$VersionCode
    $env:AGRISTOCK_KEYSTORE_PATH = $agriStore
    $env:AGRISTOCK_KEYSTORE_PASSWORD = $agriSigning.storePassword
    $env:AGRISTOCK_KEY_ALIAS = $agriSigning.keyAlias
    $env:AGRISTOCK_KEY_PASSWORD = $agriSigning.keyPassword
    & (Join-Path $PSScriptRoot 'build-android.ps1') -SignedRelease
    $agriSource = Join-Path $agriMobile 'android\app\build\outputs\apk\release\app-release.apk'
    $agriVerification = & $agriSigner verify --verbose --print-certs $agriSource
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $agriCertificate = Join-Path $agriPrivate 'release-certificate.der'
    & keytool.exe -exportcert -keystore $agriStore -storetype PKCS12 -alias $agriSigning.keyAlias -storepass:env AGRISTOCK_KEYSTORE_PASSWORD -file $agriCertificate
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the expected signing certificate.' }
    $agriExpected = (Get-FileHash -LiteralPath $agriCertificate -Algorithm SHA256).Hash.ToLowerInvariant()
    $agriDigests = @($agriVerification | Select-String -Pattern 'certificate SHA-256 digest: ([0-9a-fA-F]{64})\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value.ToLowerInvariant() })
    if ($agriDigests.Count -lt 1 -or @($agriDigests | Where-Object { $_ -ne $agriExpected }).Count -gt 0) { throw 'APK was not signed with the expected AgriStock release key.' }
    $agriArtifacts = Join-Path $agriRoot 'artifacts'
    New-Item -ItemType Directory -Path $agriArtifacts -Force | Out-Null
    $agriApk = Join-Path $agriArtifacts ('AgriStock-internal-signed-' + $VersionCode + '.apk')
    Copy-Item -LiteralPath $agriSource -Destination $agriApk
    $agriManifest = @{ file = [IO.Path]::GetFileName($agriApk); versionCode = $VersionCode; apiUrl = $env:EXPO_PUBLIC_API_URL; sha256 = (Get-FileHash -LiteralPath $agriApk -Algorithm SHA256).Hash.ToLowerInvariant(); signingCertificateSha256 = $agriExpected; builtAt = [DateTime]::UtcNow.ToString('o'); deviceAcceptance = 'pending' }
    [IO.File]::WriteAllText(($agriApk + '.json'), ($agriManifest | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Write-Output ('Verified signed APK: ' + $agriApk)
    Write-Output 'Complete device acceptance before using operational data.'
} finally {
    foreach ($agriName in $agriNames) { [Environment]::SetEnvironmentVariable($agriName, $agriPrevious[$agriName], 'Process') }
    $agriSigning = $null
}
