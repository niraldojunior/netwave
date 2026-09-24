param(
  [switch]$Seed,
  [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "             V.tal netWave - Dev Stack Launcher            " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow

$backendPort = 4001
$webPort = 5200

# 1. Encerra processos anteriores nas portas 4001 e 5200 se existirem
foreach ($port in @($backendPort, $webPort)) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($procId in ($listeners.OwningProcess | Select-Object -Unique)) {
    Write-Host "Liberando porta $port (PID $procId)..." -ForegroundColor DarkGray
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

# 2. Compila backend TypeScript se dist não existir ou se solicitado (-Rebuild)
if ($Rebuild -or -not (Test-Path "dist\src\index.js")) {
  Write-Host "Compilando backend TypeScript..." -ForegroundColor Cyan
  & cmd.exe /c "npx tsc -p tsconfig.build.json"
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha na compilacao do backend."
  }
}

if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

# 3. Executa seed de dados se solicitado (-Seed)
if ($Seed) {
  Write-Host "Executando carga inicial de dados de demonstracao..." -ForegroundColor Cyan
  & cmd.exe /c "npx tsx scripts/seed-sample-data.ts"
}

# 4. Inicia Servidor Backend Node nativo
Write-Host "Iniciando Servidor Backend netWave na porta $backendPort..." -ForegroundColor Green
$backendLogOut = Join-Path $PSScriptRoot "logs\backend-dev.log"
$backendLogErr = Join-Path $PSScriptRoot "logs\backend-dev.err.log"
$backendJob = Start-Process -FilePath "node" -ArgumentList "dist/src/index.js" -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $backendLogOut -RedirectStandardError $backendLogErr -PassThru

# 5. Aguarda Backend ficar saudável
Write-Host "Aguardando backend inicializar..." -ForegroundColor DarkGray
$backendReady = $false
for ($i = 1; $i -le 15; $i++) {
  Start-Sleep -Seconds 1
  try {
    $res = Invoke-RestMethod -Uri "http://localhost:$backendPort/api/v1/migration/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res.status -eq 'healthy') {
      $backendReady = $true
      break
    }
  } catch {}
}

if ($backendReady) {
  Write-Host "Backend online e saudavel!" -ForegroundColor Green
} else {
  Write-Host "Aviso: Backend ainda inicializando ou verificar logs em logs/backend-dev.err.log" -ForegroundColor Yellow
}

# 6. Inicia Frontend Vite
Write-Host "Iniciando Frontend Vite netWave na porta $webPort..." -ForegroundColor Green
$webJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx vite --config web/vite.config.mjs" -WorkingDirectory $PSScriptRoot -PassThru

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "                netWave esta operacional!                   " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  -> Backend:  http://localhost:$backendPort/api/v1/migration/health" -ForegroundColor Cyan
Write-Host "  -> Frontend: http://localhost:$webPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione Ctrl+C para encerrar os servicos..." -ForegroundColor Yellow

try {
  while ($true) {
    Start-Sleep -Seconds 1
  }
} finally {
  Write-Host "Encerrando netWave..." -ForegroundColor DarkYellow
  if ($backendJob -and -not $backendJob.HasExited) { Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue }
  if ($webJob -and -not $webJob.HasExited) { Stop-Process -Id $webJob.Id -Force -ErrorAction SilentlyContinue }
}
