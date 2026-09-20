<#
  Vyact — expose a local LM Studio model to the Ask Vyact gateway.
  RUN THIS ON THE MACHINE WHERE LM STUDIO IS RUNNING.

  What it does, in order:
    1. checks LM Studio is up and reports which model is loaded
    2. generates a shared secret (once) and stores it for this machine only
    3. starts the auth bridge (vyact-llm-bridge.mjs) in front of LM Studio
    4. starts a Cloudflare tunnel and prints the public HTTPS hostname
    5. prints the two things Vyact needs: the hostname, and the secret command

  It never sends the secret anywhere. You set it on Supabase yourself, with the
  command it prints at the end.

  Usage:
    powershell -ExecutionPolicy Bypass -File .\start-vyact-llm.ps1
    powershell -ExecutionPolicy Bypass -File .\start-vyact-llm.ps1 -Named vyact-llm -Hostname llm.example.com
#>

[CmdletBinding()]
param(
  # LM Studio's own port.
  [int]$UpstreamPort = 1234,
  # The bridge's port — this is what the tunnel points at.
  [int]$BridgePort = 1235,
  # Use a NAMED tunnel (stable hostname, needs a Cloudflare account + `cloudflared tunnel login`).
  [string]$Named,
  [string]$HostName
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$secretFile = Join-Path $env:LOCALAPPDATA 'Vyact\local-llm-key.txt'

function Write-Step($n, $text) { Write-Host "`n[$n] $text" -ForegroundColor Cyan }

# ── 1. Is LM Studio up? ─────────────────────────────────────────────────────
Write-Step 1 "Checking LM Studio on port $UpstreamPort"
try {
  $models = Invoke-RestMethod -Uri "http://127.0.0.1:$UpstreamPort/v1/models" -TimeoutSec 5
  $ids = @($models.data | ForEach-Object { $_.id })
  if ($ids.Count -eq 0) { throw 'no model loaded' }
  Write-Host "    loaded: $($ids -join ', ')" -ForegroundColor Green
} catch {
  Write-Host "    LM Studio is not answering on http://127.0.0.1:$UpstreamPort" -ForegroundColor Red
  Write-Host "    Open LM Studio, load Gemma, and start the server (Developer tab), then re-run." -ForegroundColor Red
  exit 1
}

# ── 2. Shared secret — generated here, kept here ─────────────────────────────
Write-Step 2 'Shared secret'
if (Test-Path $secretFile) {
  $key = (Get-Content $secretFile -Raw).Trim()
  Write-Host '    reusing the existing key for this machine' -ForegroundColor Green
} else {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $key = [Convert]::ToBase64String($bytes).Replace('+','-').Replace('/','_').TrimEnd('=')
  New-Item -ItemType Directory -Force -Path (Split-Path $secretFile) | Out-Null
  Set-Content -Path $secretFile -Value $key -Encoding utf8
  # Readable by this user only.
  icacls $secretFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
  Write-Host "    generated a new 256-bit key → $secretFile" -ForegroundColor Green
}

# ── 3. cloudflared ───────────────────────────────────────────────────────────
Write-Step 3 'Cloudflare tunnel client'
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host '    cloudflared is not installed. Install it with ONE of:' -ForegroundColor Yellow
  Write-Host '      winget install --id Cloudflare.cloudflared' -ForegroundColor Yellow
  Write-Host '      choco install cloudflared' -ForegroundColor Yellow
  Write-Host '    then re-run this script.' -ForegroundColor Yellow
  exit 1
}
Write-Host "    $((cloudflared --version) 2>&1 | Select-Object -First 1)" -ForegroundColor Green

# ── 4. Bridge ────────────────────────────────────────────────────────────────
Write-Step 4 "Starting the auth bridge on 127.0.0.1:$BridgePort"
$env:VYACT_LLM_KEY = $key
$env:UPSTREAM      = "http://127.0.0.1:$UpstreamPort"
$env:PORT          = "$BridgePort"
$bridge = Start-Process -FilePath 'node' -ArgumentList "`"$(Join-Path $scriptDir 'vyact-llm-bridge.mjs')`"" -PassThru -NoNewWindow
Start-Sleep -Seconds 2
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BridgePort/healthz" -TimeoutSec 5
  if (-not $health.ok) { throw 'bridge unhealthy' }
  Write-Host '    bridge is up and refusing unauthenticated calls' -ForegroundColor Green
} catch {
  Write-Host '    the bridge did not start — check the node output above' -ForegroundColor Red
  if ($bridge -and -not $bridge.HasExited) { Stop-Process -Id $bridge.Id -Force }
  exit 1
}

# ── 5. Tunnel ────────────────────────────────────────────────────────────────
Write-Step 5 'Starting the tunnel'
Write-Host '    Ctrl+C stops both the tunnel and the bridge.' -ForegroundColor DarkGray
try {
  if ($Named) {
    if ($HostName) {
      Write-Host "    named tunnel '$Named' → https://$HostName" -ForegroundColor Green
    }
    cloudflared tunnel run --url "http://127.0.0.1:$BridgePort" $Named
  } else {
    Write-Host '    quick tunnel: the hostname CHANGES on every restart.' -ForegroundColor Yellow
    Write-Host '    Watch for the https://<something>.trycloudflare.com line below.' -ForegroundColor Yellow
    Write-Host '    For a stable hostname: cloudflared tunnel login, then re-run with -Named.' -ForegroundColor DarkGray
    cloudflared tunnel --url "http://127.0.0.1:$BridgePort"
  }
} finally {
  if ($bridge -and -not $bridge.HasExited) {
    Stop-Process -Id $bridge.Id -Force
    Write-Host "`nbridge stopped." -ForegroundColor DarkGray
  }
  Write-Host "`nGive Vyact these two things:" -ForegroundColor Cyan
  Write-Host '  1. the https://... hostname printed above'
  Write-Host '  2. run this yourself, from the Vyact repo, to store the key server-side:'
  Write-Host "       supabase secrets set LOCAL_LLM_KEY=$key" -ForegroundColor White
  Write-Host '     (the key is also at' $secretFile ')'
}
