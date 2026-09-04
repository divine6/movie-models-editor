@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM 仅 kubectl 部署 v2（不会更新现网 Deployment movie-editor）
REM 用法: deploy-k8s.bat [tag]
REM 环境变量 KUBECONFIG 可覆盖默认 kubeconfig 路径

set "SCRIPT_DIR=%~dp0"
set "HARBOR_ENV=%SCRIPT_DIR%..\docker\harbor.env"

if not defined KUBECONFIG set "KUBECONFIG=%SCRIPT_DIR%shuaipeng.liu.kubeconfig"
if not exist "%KUBECONFIG%" (
  echo [ERROR] kubeconfig not found: %KUBECONFIG%
  exit /b 1
)

where kubectl >nul 2>&1
if errorlevel 1 (
  echo [ERROR] kubectl not found.
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%HARBOR_ENV%") do (
  if not "%%a"=="" set "%%a=%%b"
)

set "IMAGE_TAG=%~1"
if "%IMAGE_TAG%"=="" set "IMAGE_TAG=latest"
set "FULL_IMAGE=%HARBOR_REGISTRY%/%HARBOR_PROJECT%/%IMAGE_NAME%:%IMAGE_TAG%"

echo %FULL_IMAGE% | findstr /i /c:"/movie-editor/movie-editor:" >nul
if not errorlevel 1 (
  echo [ERROR] Refusing to deploy production image: %FULL_IMAGE%
  echo IMAGE_NAME must be movie-editor-v2.
  exit /b 1
)

echo ========================================
echo  movie-editor-v2 K8s Rollout
echo ========================================
echo KUBECONFIG: %KUBECONFIG%
echo Image:      %FULL_IMAGE%
echo ========================================
echo.

call "%SCRIPT_DIR%_kubectl-apply.cmd" "%SCRIPT_DIR%deploy.yaml" "%FULL_IMAGE%"
exit /b %ERRORLEVEL%
