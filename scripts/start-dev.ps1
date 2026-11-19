$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path '.env')) { throw 'Copie .env.example a .env y configure SQL/TLS e identidad.' }
Write-Host 'Terminal 1: npm run start:api'
Write-Host 'Terminal 2: npm run start:web'
Write-Host 'Abrir http://localhost:4200. No hay usuarios ni credenciales predeterminadas.'
