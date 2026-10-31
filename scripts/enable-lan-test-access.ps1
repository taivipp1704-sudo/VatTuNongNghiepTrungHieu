param([string]$InterfaceAlias = 'Wi-Fi')
$ErrorActionPreference = 'Stop'
$agriIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$agriPrincipal = [Security.Principal.WindowsPrincipal]::new($agriIdentity)
if (-not $agriPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in PowerShell opened with Run as administrator to allow phone access to port 3001.'
}
$agriNetwork = Get-NetIPConfiguration -InterfaceAlias $InterfaceAlias
if (-not $agriNetwork.IPv4DefaultGateway -or -not $agriNetwork.IPv4Address) { throw 'The selected network is not connected.' }
$agriIp = [string]$agriNetwork.IPv4Address[0].IPAddress
if ($agriIp -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)') { throw 'Select a network using a private LAN address.' }
$agriRuleName = 'AgriStock-LAN-test-3001'
if (Get-NetFirewallRule -Name $agriRuleName -ErrorAction SilentlyContinue) { Remove-NetFirewallRule -Name $agriRuleName }
New-NetFirewallRule -Name $agriRuleName -DisplayName 'AgriStock LAN test - API 3001' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -LocalAddress $agriIp -RemoteAddress LocalSubnet -InterfaceAlias $InterfaceAlias -Program (Get-Command node.exe).Source -Profile Any -EdgeTraversalPolicy Block | Out-Null
Write-Output ('Phone access enabled for http://' + $agriIp + ':3001 on ' + $InterfaceAlias + ', limited to the local subnet.')
Write-Output ('To remove: Remove-NetFirewallRule -Name ' + $agriRuleName)
