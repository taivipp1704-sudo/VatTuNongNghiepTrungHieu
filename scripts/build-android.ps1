param(
    [switch]$Debug,
    [switch]$SignedRelease,
    [switch]$LanTest,
    [string]$ApiUrl = '',
    [ValidateRange(1,2100000000)][int]$VersionCode = 1
)
$ErrorActionPreference = 'Stop'
$agriRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$agriMobile = Join-Path $agriRoot 'apps\mobile'
$agriSdk = Join-Path $agriRoot '.local\android-sdk'
if ($env:ANDROID_HOME -and (Test-Path -LiteralPath $env:ANDROID_HOME)) { $agriSdk = $env:ANDROID_HOME }
if (-not (Test-Path -LiteralPath (Join-Path $agriSdk 'platform-tools\adb.exe'))) {
    throw 'Android SDK not found. Run scripts\setup-android.ps1 or configure ANDROID_HOME.'
}
$env:ANDROID_HOME = $agriSdk
$env:ANDROID_SDK_ROOT = $agriSdk
if ($SignedRelease -and ($Debug -or $LanTest -or $env:AGRISTOCK_RELEASE -ne '1' -or $env:AGRISTOCK_LOCAL_RELEASE_SIGNING -ne '1')) { throw 'Use scripts\build-internal-android.ps1 for a signed release.' }
$env:AGRISTOCK_LAN_TEST = if ($LanTest) { '1' } else { '0' }
if ($LanTest) {
    if ($Debug) { throw 'The LAN test APK must bundle JavaScript; omit -Debug.' }
    try { $agriApi = [Uri]$ApiUrl } catch { throw 'Provide -ApiUrl with the LAN server origin.' }
    if (-not $agriApi.IsAbsoluteUri -or $agriApi.Scheme -notin @('http','https') -or $agriApi.UserInfo -or $agriApi.Query -or $agriApi.Fragment -or $agriApi.AbsolutePath -ne '/' -or $agriApi.IsLoopback -or $agriApi.Host -in @('10.0.2.2','10.0.3.2')) {
        throw 'Use the computer LAN address reachable by a physical phone, without paths or embedded credentials.'
    }
    $env:EXPO_PUBLIC_API_URL = $agriApi.GetLeftPart([UriPartial]::Authority)
    $env:AGRISTOCK_ANDROID_VERSION_CODE = [string]$VersionCode
}
if (-not $SignedRelease) {
    $env:AGRISTOCK_ALLOW_HTTP = '1'
    $env:AGRISTOCK_RELEASE = '0'
    $env:AGRISTOCK_LOCAL_RELEASE_SIGNING = '0'
}
$env:EXPO_NO_GIT_STATUS = '1'
$env:CI = '1'
Push-Location -LiteralPath $agriMobile
try {
    & npx.cmd expo prebuild --platform android --no-install --no-clean
    if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
    $agriLicenses = Join-Path $agriMobile 'android\app\src\main\assets\licenses'
    New-Item -ItemType Directory -Path $agriLicenses -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $agriMobile 'assets\fonts\OFL.txt') -Destination (Join-Path $agriLicenses 'BeVietnamPro-OFL.txt')
    Copy-Item -LiteralPath (Join-Path $agriMobile 'assets\licenses\Inter-OFL.txt') -Destination $agriLicenses
    Copy-Item -LiteralPath (Join-Path $agriMobile 'assets\licenses\Manrope-OFL.txt') -Destination $agriLicenses
    Copy-Item -LiteralPath (Join-Path $agriMobile 'assets\licenses\BwipJs-MIT.txt') -Destination $agriLicenses
    # React Native caches the package name independently of Expo prebuild.
    # Refresh that generated file when switching between the LAN and release apps.
    $agriAutolinking = Join-Path $agriMobile 'android\build\generated\autolinking\autolinking.json'
    if (Test-Path -LiteralPath $agriAutolinking) {
        $agriCachedPackage = (Get-Content -LiteralPath $agriAutolinking -Raw | ConvertFrom-Json).project.android.packageName
        $agriExpectedPackage = if ($LanTest) { 'vn.agristock.internal.lantest' } else { (Get-Content -LiteralPath (Join-Path $agriMobile 'app.json') -Raw | ConvertFrom-Json).expo.android.package }
        if ($agriCachedPackage -ne $agriExpectedPackage) { Remove-Item -LiteralPath $agriAutolinking }
    }
    $agriWrapper = Join-Path $agriMobile 'android\gradle\wrapper\gradle-wrapper.properties'
    $agriWrapperText = [IO.File]::ReadAllText($agriWrapper) -replace 'networkTimeout=\d+', 'networkTimeout=120000'
    [IO.File]::WriteAllText($agriWrapper, $agriWrapperText, [Text.UTF8Encoding]::new($false))
    $agriSdkProperty = $agriSdk.Replace('\','/')
    [System.IO.File]::WriteAllText((Join-Path $agriMobile 'android\local.properties'), ('sdk.dir=' + $agriSdkProperty), [System.Text.UTF8Encoding]::new($false))
    Push-Location -LiteralPath (Join-Path $agriMobile 'android')
    try {
        $agriTask = if ($Debug) { 'assembleDebug' } else { 'assembleRelease' }
        & .\gradlew.bat $agriTask --no-daemon --max-workers=2 --console=plain '-Dorg.gradle.internal.http.connectionTimeout=30000' '-Dorg.gradle.internal.http.socketTimeout=120000' '-PreactNativeArchitectures=arm64-v8a'
        if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed. Check the output above.' }
    } finally { Pop-Location }
    if ($SignedRelease) { return }
    $agriVariant = if ($Debug) { 'debug' } else { 'release' }
    $agriArtifactDirectory = Join-Path $agriRoot 'artifacts'
    New-Item -ItemType Directory -Path $agriArtifactDirectory -Force | Out-Null
    $agriApkName = if ($LanTest) { 'AgriStock-lan-test-' + $VersionCode + '.apk' } else { 'AgriStock-internal-' + $agriVariant + '.apk' }
    $agriApk = Join-Path $agriArtifactDirectory $agriApkName
    Copy-Item -LiteralPath (Join-Path $agriMobile ('android\app\build\outputs\apk\' + $agriVariant + '\app-' + $agriVariant + '.apk')) -Destination $agriApk
    Get-FileHash -LiteralPath $agriApk -Algorithm SHA256
    if ($LanTest) {
        $agriManifest = @{ file = $agriApkName; mode = 'lan-test'; package = 'vn.agristock.internal.lantest'; versionCode = $VersionCode; apiUrl = $env:EXPO_PUBLIC_API_URL; sha256 = (Get-FileHash -LiteralPath $agriApk -Algorithm SHA256).Hash.ToLowerInvariant(); builtAt = [DateTime]::UtcNow.ToString('o'); deviceAcceptance = 'pending' }
        [IO.File]::WriteAllText(($agriApk + '.json'), ($agriManifest | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        Write-Output ('LAN test APK: ' + $agriApk)
    }
    Write-Output 'Internal test build. This APK does not use a production signing key.'
} finally { Pop-Location }
