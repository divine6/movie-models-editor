@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM 仅构建并推送 v2 镜像（不会推送现网 movie-editor:latest）
REM 用法: deploy-push.bat [tag]

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "HARBOR_ENV=%PROJECT_ROOT%\docker\harbor.env"

if not exist "%HARBOR_ENV%" (
  echo [ERROR] harbor config not found: %HARBOR_ENV%
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] docker not found.
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%HARBOR_ENV%") do (
  if not "%%a"=="" set "%%a=%%b"
)

set "IMAGE_TAG=%~1"
if "%IMAGE_TAG%"=="" set "IMAGE_TAG=latest"
set "FULL_IMAGE=%HARBOR_REGISTRY%/%HARBOR_PROJECT%/%IMAGE_NAME%:%IMAGE_TAG%"
set "LATEST_IMAGE=%HARBOR_REGISTRY%/%HARBOR_PROJECT%/%IMAGE_NAME%:latest"

echo %FULL_IMAGE% | findstr /i /c:"/movie-editor/movie-editor:" >nul
if not errorlevel 1 (
  echo [ERROR] Refusing to push production image: %FULL_IMAGE%
  echo IMAGE_NAME must be movie-editor-v2.
  exit /b 1
)

echo ========================================
echo  movie-editor-v2 Build ^& Push
echo ========================================
echo Image: %FULL_IMAGE%
echo ========================================
echo.

echo [1/2] Build Docker image...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\docker-build.ps1" -Tag "%FULL_IMAGE%" -LocalFrontend -ViteMode docker.v2 -ContextPath "/movie-editor-v2"
if errorlevel 1 exit /b 1
echo.

echo [2/2] Push image to Harbor...
if defined HARBOR_USER (
  if not defined HARBOR_PASSWORD (
    echo [ERROR] HARBOR_PASSWORD is required when HARBOR_USER is set.
    exit /b 1
  )
  echo %HARBOR_PASSWORD%| docker login %HARBOR_REGISTRY% -u %HARBOR_USER% --password-stdin
  if errorlevel 1 exit /b 1
)
docker push "%FULL_IMAGE%"
if errorlevel 1 exit /b 1
if /i not "%IMAGE_TAG%"=="latest" (
  docker tag "%FULL_IMAGE%" "%LATEST_IMAGE%"
  docker push "%LATEST_IMAGE%"
  if errorlevel 1 exit /b 1
)

echo.
echo ========================================
echo  Push succeeded
echo ========================================
echo Image: %FULL_IMAGE%
echo Next:  k8s\deploy-k8s.bat
echo ========================================

endlocal
