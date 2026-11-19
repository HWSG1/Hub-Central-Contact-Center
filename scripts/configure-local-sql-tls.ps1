#requires -Version 5.1
[CmdletBinding()]
param([switch]$Apply,[switch]$RestartSql)
$ErrorActionPreference='Stop'
$serviceName='MSSQL$SQLEXPRESS01'
$sqlRegistry='HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL16.SQLEXPRESS01\MSSQLServer\SuperSocketNetLib'
if($env:COMPUTERNAME -ine 'JanOda_PC_00'){throw 'Este asistente es exclusivo para la PC local JanOda_PC_00.'}
$settings=Get-ItemProperty -LiteralPath $sqlRegistry
if(!$Apply){
 Write-Host 'Diagnostico: SQLEXPRESS01 local, certificado configurado:' $settings.Certificate
 Write-Host 'Para instalar un certificado LOCAL y confiar en el desde TU usuario:'
 Write-Host '.\scripts\configure-local-sql-tls.ps1 -Apply'
 Write-Host 'Despues reinicia SQLEXPRESS01 desde Configuration Manager, o agrega -RestartSql.'
 Write-Host 'Reiniciar interrumpe otras aplicaciones conectadas a esta instancia. No cambia otras instancias.'
 return
}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Abre PowerShell como administrador con tu mismo usuario de Windows.'}
$friendly='ContactCenterHub - SQL local development'
$existingThumb=([string]$settings.Certificate).Replace(' ','')
if($existingThumb){
 $cert=Get-Item -LiteralPath ('Cert:\LocalMachine\My\'+$existingThumb) -ErrorAction Stop
 if($cert.FriendlyName -ne $friendly){throw 'Ya existe otro certificado configurado. No se reemplazara; revisar con Infraestructura.'}
}else{
 $cert=Get-ChildItem Cert:\LocalMachine\My | Where-Object {$_.FriendlyName -eq $friendly -and $_.NotAfter -gt (Get-Date).AddDays(30) -and $_.HasPrivateKey} | Sort-Object NotAfter -Descending | Select-Object -First 1
 if(!$cert){
  $cert=New-SelfSignedCertificate -Type SSLServerAuthentication -Subject ('CN='+$env:COMPUTERNAME) -DnsName $env:COMPUTERNAME,'localhost' -CertStoreLocation 'Cert:\LocalMachine\My' -KeySpec KeyExchange -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -Provider 'Microsoft RSA SChannel Cryptographic Provider' -NotAfter (Get-Date).AddYears(1) -FriendlyName $friendly
 }
}
if($cert.NotAfter -le (Get-Date)){throw 'El certificado local ha expirado. Requiere renovacion controlada.'}
$serviceAccount=(Get-ItemProperty -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$serviceName)).ObjectName
$keyName=$cert.PrivateKey.CspKeyContainerInfo.UniqueKeyContainerName
if(!$keyName){throw 'No se pudo localizar la clave privada CSP del certificado.'}
$keyPath=Join-Path $env:ProgramData ('Microsoft\Crypto\RSA\MachineKeys\'+$keyName)
$acl=Get-Acl -LiteralPath $keyPath
$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($serviceAccount,'Read','Allow')
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $keyPath -AclObject $acl
$store=New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','CurrentUser')
try{$store.Open('ReadWrite');$public=New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @(,$cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert));$store.Add($public)}finally{$store.Close()}
Set-ItemProperty -LiteralPath $sqlRegistry -Name Certificate -Value $cert.Thumbprint.ToLowerInvariant()
Write-Host 'Certificado local instalado. Confianza limitada al usuario Windows:' $identity.Name
Write-Host 'Huella publica:' $cert.Thumbprint
Write-Host 'La API conserva Encrypt=True y TrustServerCertificate=False.'
if($RestartSql){Restart-Service -Name $serviceName -ErrorAction Stop;Write-Host 'SQLEXPRESS01 reiniciado.'}else{Write-Host 'Reinicia SQLEXPRESS01 en una ventana adecuada para aplicar el certificado.'}
Write-Host 'Verifica: sqlcmd -S "tcp:localhost,14331" -E -N -Q "SELECT DB_ID(''ContactCenterHub_Dev'') AS database_id"'
