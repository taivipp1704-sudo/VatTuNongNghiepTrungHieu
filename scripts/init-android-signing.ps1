$ErrorActionPreference = 'Stop'
$agriRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$agriPrivate = Join-Path $agriRoot '.local\android-release'
$agriStore = Join-Path $agriPrivate 'agristock-internal.p12'
$agriCredentialsFile = Join-Path $agriPrivate 'signing.json'
if ((Test-Path -LiteralPath $agriStore) -or (Test-Path -LiteralPath $agriCredentialsFile)) {
    if ((Test-Path -LiteralPath $agriStore) -and (Test-Path -LiteralPath $agriCredentialsFile)) {
        Write-Output 'Existing AgriStock release signing files preserved.'
        return
    }
    throw 'Incomplete signing files. Restore the matching keystore and signing.json from your private backup. No keys were overwritten.'
}
$agriKeytool = (Get-Command keytool.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $agriPrivate -Force | Out-Null
$agriIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $agriPrivate /inheritance:r /grant:r "${agriIdentity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict access to the signing directory.' }
$agriRandom = New-Object byte[] 32
$agriGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $agriGenerator.GetBytes($agriRandom) } finally { $agriGenerator.Dispose() }
$agriPassword = [Convert]::ToBase64String($agriRandom)
$agriPreviousPassword = $env:AGRISTOCK_KEYGEN_PASSWORD
try {
    $env:AGRISTOCK_KEYGEN_PASSWORD = $agriPassword
    & $agriKeytool -genkeypair -keystore $agriStore -storetype PKCS12 -alias agristock-internal -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 10000 -dname 'CN=AgriStock, OU=Internal, O=AgriStock, C=VN' -storepass:env AGRISTOCK_KEYGEN_PASSWORD -keypass:env AGRISTOCK_KEYGEN_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate the release signing key.' }
    $agriCredentials = @{ keystoreFile = 'agristock-internal.p12'; keyAlias = 'agristock-internal'; storePassword = $agriPassword; keyPassword = $agriPassword }
    [IO.File]::WriteAllText($agriCredentialsFile, ($agriCredentials | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
} finally {
    $env:AGRISTOCK_KEYGEN_PASSWORD = $agriPreviousPassword
    $agriPassword = $null
}
Write-Output ('Release signing files created in ' + $agriPrivate)
Write-Output 'Keep this directory private and back it up separately. Reuse the same key for every app update.'
