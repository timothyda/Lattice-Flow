# build-server-release.ps1
# Builds the Opus Flo server and packages it into a zip ready for distribution.
# Bundles Node.js 22 LTS (Windows x64) — no Node install needed on target machines.
# Run from the repo root:  .\scripts\build-server-release.ps1

$ErrorActionPreference = "Stop"
$nodeVersion = "24.15.0"
$nodeExe     = (Get-Command node -ErrorAction Stop).Source

$root   = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
$server = Join-Path $root "server"
$out    = Join-Path $root "release"

# ── Verify Node version matches what we bundle ───────────────────────────────
$activeNode = & node --version 2>&1
if (-not $activeNode.StartsWith("v24")) {
    Write-Host ""
    Write-Host "ERROR: Node.js v24 must be active to build the server package." -ForegroundColor Red
    Write-Host "       Currently active: $activeNode" -ForegroundColor Yellow
    Write-Host "       Install Node.js 24 LTS from https://nodejs.org" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "Node.js $activeNode active — OK" -ForegroundColor Green

Write-Host "Using local node.exe: $nodeExe" -ForegroundColor Gray

# ── Reinstall + recompile native addons for current Node version ─────────────
# npm install alone skips recompilation if better-sqlite3 is already present.
# We delete the build folder and force a clean rebuild to match the bundled node.exe ABI.
Write-Host "Recompiling native addons for Node $activeNode..." -ForegroundColor Cyan
Push-Location $server
$bsqlBuild = Join-Path $server "node_modules\better-sqlite3\build"
if (Test-Path $bsqlBuild) {
    Remove-Item $bsqlBuild -Recurse -Force
    Write-Host "  Cleared better-sqlite3 build cache" -ForegroundColor Gray
}
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed" -ForegroundColor Red; exit 1 }
npm rebuild better-sqlite3
if ($LASTEXITCODE -ne 0) { Write-Host "npm rebuild failed" -ForegroundColor Red; exit 1 }
Write-Host "  better-sqlite3 recompiled for Node $activeNode" -ForegroundColor Gray
Pop-Location

# ── Build TypeScript ─────────────────────────────────────────────────────────
Write-Host "Building server TypeScript..." -ForegroundColor Cyan
Push-Location $server
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }
Pop-Location

# ── Assemble package folder ──────────────────────────────────────────────────
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$pkg = Join-Path $out "opus-flo-server"
New-Item -ItemType Directory -Path $pkg | Out-Null

Copy-Item (Join-Path $server "dist")         $pkg -Recurse
Copy-Item (Join-Path $server "node_modules") $pkg -Recurse
Copy-Item (Join-Path $server ".env.example") $pkg
Copy-Item (Join-Path $server "package.json") $pkg

# Bundle node.exe
Copy-Item $nodeExe (Join-Path $pkg "node.exe")
Write-Host "  Bundled node.exe (v$nodeVersion)" -ForegroundColor Gray

# ── start.bat — uses bundled node.exe ───────────────────────────────────────
@'
@echo off
echo Starting Opus Flo Server...
echo.
if not exist ".env" (
    echo No .env file found. Copying .env.example to .env...
    copy .env.example .env
    echo.
    echo Please edit .env and set your JWT_SECRET before continuing.
    echo Open .env in Notepad, change JWT_SECRET, save, then run start.bat again.
    pause
    exit /b 1
)
.\node.exe dist/index.js
pause
'@ | Set-Content (Join-Path $pkg "start.bat") -Encoding utf8

# ── start.sh — Mac/Linux still requires system Node 22 ──────────────────────
@'
#!/bin/sh
if [ ! -f .env ]; then
  echo "No .env file found. Copying .env.example to .env..."
  cp .env.example .env
  echo "Edit .env and set your JWT_SECRET, then re-run this script."
  exit 1
fi
node dist/index.js
'@ | Set-Content (Join-Path $pkg "start.sh") -Encoding utf8

# ── README.txt ───────────────────────────────────────────────────────────────
@'
# Opus Flo Server

## Requirements (Windows)
  None — Node.js v22 is bundled. Just extract and run start.bat.

## Requirements (Mac / Linux)
  Node.js 24 LTS  (https://nodejs.org)

## Setup (first time only)
  1. Copy .env.example to .env
  2. Open .env in a text editor and set JWT_SECRET to a long random string
  3. Run start.bat (Windows) or  sh start.sh (Mac/Linux)

## Running
  Windows:    double-click start.bat
  Mac/Linux:  sh start.sh
  Default port: 3847  (change PORT= in .env)

## Finding your IP address
  Windows:    run  ipconfig  in Command Prompt → look for IPv4 Address
  Mac/Linux:  run  ifconfig  or  ip addr
  Enter that IP in the Opus Flo desktop app: http://192.168.x.x:3847

## Auto-start on Windows login
  1. Right-click start.bat > Create shortcut
  2. Press Win+R, type shell:startup, press Enter
  3. Move the shortcut into that folder
'@ | Set-Content (Join-Path $pkg "README.txt") -Encoding utf8

# ── Zip ──────────────────────────────────────────────────────────────────────
$zipPath = Join-Path $out "opus-flo-server.zip"
Compress-Archive -Path "$pkg\*" -DestinationPath $zipPath -Force

$sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "Server package ready ($sizeMB MB):" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Upload this zip to the GitHub Release alongside the Electron installer." -ForegroundColor Cyan
