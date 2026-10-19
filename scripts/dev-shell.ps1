# Puts this project's portable Node.js and Git on PATH for the current PowerShell session.
# Usage (from the project folder):  . .\scripts\dev-shell.ps1
$root = Split-Path -Parent $PSScriptRoot
$env:Path = "$root\.tools\node;$root\.tools\git\cmd;$env:Path"
Set-Location $root
Write-Host "SolGag dev shell ready: node $(node -v), $(git --version)" -ForegroundColor Green
