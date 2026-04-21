param(
    [string]$BackendMessage = "chore: backend updates",
    [string]$ParentMessage = "chore: bump backend submodule pointer",
    [string]$BackendRemoteBranch = "backend-migration-fixes"
)

$ErrorActionPreference = "Stop"

function Run-Step {
    param(
        [string]$Command,
        [string]$WorkingDir
    )
    Write-Host "[$WorkingDir] $Command" -ForegroundColor Cyan
    Push-Location $WorkingDir
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed: $Command"
        }
    }
    finally {
        Pop-Location
    }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot "backend"

if (-not (Test-Path $backendDir)) {
    throw "backend folder not found at: $backendDir"
}

Write-Host "== 1/2 Backend repo commit + push ==" -ForegroundColor Yellow
Run-Step -WorkingDir $backendDir -Command "git status --short --branch"

Push-Location $backendDir
try {
    $backendHasChanges = (git status --porcelain)
    if (-not [string]::IsNullOrWhiteSpace($backendHasChanges)) {
        Run-Step -WorkingDir $backendDir -Command "git add ."
        Run-Step -WorkingDir $backendDir -Command "git commit -m `"$BackendMessage`""
    }
    else {
        Write-Host "No backend changes to commit." -ForegroundColor DarkYellow
    }

    Run-Step -WorkingDir $backendDir -Command "git push -u origin HEAD:$BackendRemoteBranch"
}
finally {
    Pop-Location
}

Write-Host "`n== 2/2 Parent repo submodule pointer commit + push ==" -ForegroundColor Yellow
Run-Step -WorkingDir $repoRoot -Command "git status --short --branch"
Run-Step -WorkingDir $repoRoot -Command "git add backend"

Push-Location $repoRoot
try {
    $parentHasChanges = (git status --porcelain)
    if (-not [string]::IsNullOrWhiteSpace($parentHasChanges)) {
        Run-Step -WorkingDir $repoRoot -Command "git commit -m `"$ParentMessage`""
    }
    else {
        Write-Host "No parent repo changes to commit." -ForegroundColor DarkYellow
    }

    Run-Step -WorkingDir $repoRoot -Command "git push"
}
finally {
    Pop-Location
}

Write-Host "`nDone. Backend and parent pointers are pushed." -ForegroundColor Green
