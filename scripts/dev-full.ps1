# 同时启动前端 (5173) 与后端 API (4000)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path (Split-Path -Parent $Root) "movie-models-server"

if (-not (Test-Path $ServerDir)) {
  Write-Error "未找到 movie-models-server：$ServerDir`n请确保 movie-models-editor 与 movie-models-server 为同级目录。"
}

Write-Host "启动 movie-models-server (http://localhost:4000) ..."
$server = Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $ServerDir -PassThru -NoNewWindow

Start-Sleep -Seconds 2

Write-Host "启动 movie-models-editor (http://localhost:5173) ..."
try {
  Push-Location $Root
  npm run dev
} finally {
  if ($server -and -not $server.HasExited) {
    Write-Host "停止 movie-models-server ..."
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
