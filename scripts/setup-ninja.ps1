param([string]$SdkPath = '')
$ErrorActionPreference = 'Stop'
$agriRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$agriPrivate = Join-Path $agriRoot '.local'
if (-not $SdkPath) { $SdkPath = Join-Path $agriPrivate 'android-sdk' }
$agriSdk = (Resolve-Path -LiteralPath $SdkPath).Path
$agriNinja = Join-Path $agriSdk 'cmake\3.22.1\bin\ninja.exe'
if (-not (Test-Path -LiteralPath $agriNinja)) { throw 'Install Android SDK cmake;3.22.1 first with scripts\setup-android.ps1 -WithNdk.' }
$agriVersion = (& $agriNinja --version).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the Ninja build tool.' }
if ([Version]$agriVersion -ge [Version]'1.12.0') { Write-Output ('Ninja ' + $agriVersion + ' supports Windows long paths.'); return }
if (-not $agriSdk.StartsWith($agriPrivate + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Update Ninja to 1.12 or newer in your external Android SDK, or use this project SDK. External SDK files were preserved.' }
$agriArchive = Join-Path $agriPrivate 'ninja-v1.13.2.zip'
& node (Join-Path $PSScriptRoot 'download-ranges.mjs') 'https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip' $agriArchive 291570 '07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65' 4
if ($LASTEXITCODE -ne 0) { throw 'Verified Ninja download did not complete.' }
$agriStaging = Join-Path $agriPrivate 'ninja-v1.13.2'
Expand-Archive -LiteralPath $agriArchive -DestinationPath $agriStaging -Force
$agriOriginal = $agriNinja + '.original'
if (-not (Test-Path -LiteralPath $agriOriginal)) { Copy-Item -LiteralPath $agriNinja -Destination $agriOriginal }
Copy-Item -LiteralPath (Join-Path $agriStaging 'ninja.exe') -Destination $agriNinja -Force
$agriUpdated = (& $agriNinja --version).Trim()
if ($LASTEXITCODE -ne 0 -or $agriUpdated -ne '1.13.2') { throw 'Ninja update verification failed.' }
Write-Output ('Installed verified Ninja ' + $agriUpdated + ' in the project SDK; original executable preserved.')
