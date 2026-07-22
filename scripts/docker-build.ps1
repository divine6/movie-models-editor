# Build movie-models full-stack Docker image (frontend + backend)
# Usage:
#   .\scripts\docker-build.ps1
#   .\scripts\docker-build.ps1 -Tag movie-models:1.0.0 -ApiUrl "https://your-api.example.com/"

param(
    [string]$Tag = "movie-models:latest",
    [string]$ApiUrl = "https://ext.highlands.ltd/light-sass-api/",
    [string]$ContextPath = "/movie-editor",
    [switch]$NoCache,
    [switch]$LocalFrontend
)

$ErrorActionPreference = "Stop"

$EditorRoot = Split-Path $PSScriptRoot -Parent
$ContextRoot = (Resolve-Path (Join-Path $EditorRoot "..")).Path
$Dockerfile = if ($LocalFrontend) {
    Join-Path $EditorRoot "docker/Dockerfile.runtime"
} else {
    Join-Path $EditorRoot "docker/Dockerfile"
}
$DockerignoreSrc = Join-Path $EditorRoot "docker/.dockerignore"
$DockerignoreDst = Join-Path $ContextRoot ".dockerignore"

$ServerDir = Join-Path $ContextRoot "movie-models-server"
if (-not (Test-Path $ServerDir)) {
    throw "Backend not found: $ServerDir. movie-models-editor and movie-models-server must be sibling directories."
}

$Npmrc = Join-Path $env:USERPROFILE ".npmrc"
if (-not $LocalFrontend -and -not (Test-Path $Npmrc)) {
    throw "npm auth not found: $Npmrc (required for private packages like base-components)."
}

Write-Host "==> Context:      $ContextRoot"
Write-Host "==> Dockerfile:   $Dockerfile"
Write-Host "==> Image tag:    $Tag"
Write-Host "==> VITE_API_URL: $ApiUrl"
Write-Host "==> Context path: $ContextPath"
if (-not $LocalFrontend) {
    Write-Host "==> npmrc:        $Npmrc"
} else {
    Write-Host "==> Mode:         local frontend build + runtime image"
}

Copy-Item $DockerignoreSrc $DockerignoreDst -Force

if ($LocalFrontend) {
    Write-Host "==> Local frontend build (docker.tenant)..."
    Push-Location $EditorRoot
    try {
        pnpm run build:docker
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
        Pop-Location
    }
}

$buildArgs = @(
    "build",
    "-f", $Dockerfile,
    "-t", $Tag
)

if (-not $LocalFrontend) {
    $buildArgs += @(
        "--secret", "id=npmrc,src=$Npmrc",
        "--build-arg", "VITE_API_URL=$ApiUrl",
        "--build-arg", "VITE_PUBLIC_PATH=$ContextPath/",
        "--build-arg", "VITE_EDITOR_SERVER_URL=$ContextPath",
        "--build-arg", "VITE_EDITOR_FRONTEND_URL=$ContextPath"
    )
}

if ($NoCache) {
    $buildArgs += "--no-cache"
}

$buildArgs += $ContextRoot

try {
    docker @buildArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host ""
    Write-Host "Build succeeded: $Tag"
    Write-Host "Run locally:"
    Write-Host ('  docker run --rm -p 4000:4000 -e DB_HOST=host.docker.internal -e DB_PASSWORD=root ' + $Tag)
} finally {
    Remove-Item $DockerignoreDst -ErrorAction SilentlyContinue
}
