#!/usr/bin/env pwsh
# Install Piper TTS for Windows
# Downloads the official Windows binary from GitHub and places it in
# backend/bin/ — you then point TT_PIPER_BINARY at it, or add it to PATH.

$ErrorActionPreference = "Stop"

$PiperVersion = "2023.11.14-2"
$BaseUrl = "https://github.com/rhasspy/piper/releases/download/v$PiperVersion"
$Archive = "piper_windows_amd64.zip"
$ExtractDir = "piper"
$TargetDir = "$PSScriptRoot\..\backend\bin"

Write-Host "⬇  Downloading Piper v$PiperVersion for Windows..." -ForegroundColor Cyan
$ZipPath = "$env:TEMP\$Archive"
$Url = "$BaseUrl/$Archive"

try {
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✓ Downloaded to $ZipPath" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Download failed: $_" -ForegroundColor Red
    Write-Host "   → Try manually: $Url" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Extracting to $TargetDir ..." -ForegroundColor Cyan
if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
}
New-Item -ItemType Directory -Force $TargetDir | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath "$TargetDir\$ExtractDir" -Force

# The exe lives inside the extracted folder
$BinaryPath = "$TargetDir\$ExtractDir\piper.exe"
if (-not (Test-Path $BinaryPath)) {
    Write-Host "   ✗ piper.exe not found after extraction at: $BinaryPath" -ForegroundColor Red
    exit 1
}

Write-Host "   ✓ Extracted to $BinaryPath" -ForegroundColor Green

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  Piper installed!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "Add to your environment (choose one):" -ForegroundColor White
Write-Host ""
Write-Host "  A) Set env var for this session:"
Write-Host "     `$env:TT_PIPER_BINARY = '$BinaryPath'"
Write-Host ""
Write-Host "  B) Add to PATH (permanent):"
Write-Host "     `$env:Path += ';$TargetDir\$ExtractDir'"
Write-Host ""
Write-Host "  C) Or permanently in your profile:"
Write-Host "     [Environment]::SetEnvironmentVariable("
Write-Host "       'TT_PIPER_BINARY', '$BinaryPath', 'User')"
Write-Host ""
Write-Host "Then restart the backend and check /api/health" -ForegroundColor Cyan
