# build-server-release.ps1
# Builds the Opus Flo server and packages it into a zip ready for distribution.
# Run from the repo root:  .\scripts\build-server-release.ps1

$ErrorActionPreference = "Stop"
$root   = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
$server = Join-Path $root "server"
$out    = Join-Path $root "release"

Write-Host "Building server TypeScript..." -ForegroundColor Cyan
Push-Location $server
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed" -ForegroundColor Red; exit 1 }
Pop-Location

# Create release folder
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$pkg = Join-Path $out "opus-flo-server"
New-Item -ItemType Directory -Path $pkg | Out-Null

# Copy compiled output and dependencies
Copy-Item (Join-Path $server "dist")         $pkg -Recurse
Copy-Item (Join-Path $server "node_modules") $pkg -Recurse
Copy-Item (Join-Path $server ".env.example") $pkg
Copy-Item (Join-Path $server "package.json") $pkg

# Write start scripts
@'
@echo off
echo Starting Opus Flo Server...
echo.
if not exist ".env" (
    echo No .env file found. Copying .env.example to .env...
    copy .env.example .env
    echo Please edit .env and set your JWT_SECRET before continuing.
    pause
    exit /b 1
)
node dist/index.js
pause
'@ | Set-Content (Join-Path $pkg "start.bat") -Encoding utf8

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

# Write quick README
@'
# Opus Flo Server

## Requirements
- Node.js 22 LTS  (https://nodejs.org — download the LTS version)

## Setup (first time only)
1. Copy .env.example to .env
2. Edit .env — at minimum change JWT_SECRET to a long random string
3. Run: start.bat  (Windows) or  sh start.sh  (Mac/Linux)

## Running
- Windows: double-click start.bat
- Mac/Linux: sh start.sh
- The server listens on port 3847 by default (change PORT in .env)

## Finding your IP address
- Windows: run  ipconfig  in Command Prompt, look for IPv4 Address
- Mac/Linux: run  ifconfig  or  ip addr
- Use that IP in the Opus Flo desktop app: http://192.168.x.x:3847
'@ | Set-Content (Join-Path $pkg "README.txt") -Encoding utf8

# Zip it
$zipPath = Join-Path $out "opus-flo-server.zip"
Compress-Archive -Path "$pkg\*" -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "Server package ready:" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor White
Write-Host ""
Write-Host "Upload this zip to the GitHub Release alongside the Electron installer." -ForegroundColor Cyan
