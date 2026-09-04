@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM 一键构建/推送/部署 movie-editor-v2（不会推送或更新现网 movie-editor）
REM 用法:
REM   deploy.bat              使用 movie-editor-v2:latest
REM   deploy.bat v1.0.0       指定镜像标签

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "KUBECONFIG=%SCRIPT_DIR%shuaipeng.liu.kubeconfig"
set "HARBOR_ENV=%PROJECT_ROOT%\docker\harbor.env"

if not exist "%KUBECONFIG%" (
  echo [ERROR] kubeconfig not found: %KUBECONFIG%
  exit /b 1
)

where kubectl >nul 2>&1
if errorlevel 1 (
  echo [ERROR] kubectl not found. Run k8s\setup-kubectl.bat first.
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] docker not found.
  exit /b 1
)

if not exist "%HARBOR_ENV%" (
  echo [ERROR] harbor config not found: %HARBOR_ENV%
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
  echo [ERROR] Refusing to build/push production image: %FULL_IMAGE%
  echo IMAGE_NAME must be movie-editor-v2.
  exit /b 1
)

echo ========================================
echo  movie-editor-v2 K8s Deploy
echo ========================================
echo KUBECONFIG:  %KUBECONFIG%
echo Image:       %FULL_IMAGE%
echo Namespace:   u3d
echo Service:     movie-editor-v2
echo Access:      https://api.highlands.ltd/movie-editor-v2
echo ========================================
echo.

echo [1/5] Build Docker image (v2 frontend + runtime)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\docker-build.ps1" -Tag "%FULL_IMAGE%" -LocalFrontend -ViteMode docker.v2 -ContextPath "/movie-editor-v2"
if errorlevel 1 (
  echo [ERROR] Docker build failed.
  exit /b 1
)
echo.

echo [2/5] Login Harbor...
if defined HARBOR_USER (
  if not defined HARBOR_PASSWORD (
    echo [ERROR] HARBOR_PASSWORD is required when HARBOR_USER is set.
    exit /b 1
  )
  echo %HARBOR_PASSWORD%| docker login %HARBOR_REGISTRY% -u %HARBOR_USER% --password-stdin
  if errorlevel 1 (
    echo [ERROR] Harbor login failed.
    exit /b 1
  )
) else (
  echo [INFO] HARBOR_USER not set, skip login (ensure already logged in to %HARBOR_REGISTRY%)
)
echo.

echo [3/5] Push image to Harbor...
docker push "%FULL_IMAGE%"
if errorlevel 1 (
  echo [ERROR] docker push failed.
  exit /b 1
)
if /i not "%IMAGE_TAG%"=="latest" (
  docker tag "%FULL_IMAGE%" "%LATEST_IMAGE%"
  docker push "%LATEST_IMAGE%"
  if errorlevel 1 (
    echo [ERROR] docker push movie-editor-v2:latest failed.
    exit /b 1
  )
)
echo.

echo [4/5] Apply K8s manifests and rollout...
call "%SCRIPT_DIR%_kubectl-apply.cmd" "%SCRIPT_DIR%deploy.yaml" "%FULL_IMAGE%"
if errorlevel 1 (
  echo [ERROR] K8s deploy failed.
  exit /b 1
)
echo.

echo [5/5] Done.

echo.
echo ========================================
echo  v2 Deploy succeeded
echo ========================================
echo Image:     %FULL_IMAGE%
echo Pods:      kubectl get pods -l app=movie-editor-v2 -n u3d
echo Service:   kubectl get svc movie-editor-v2 -n u3d
echo Access:    https://api.highlands.ltd/movie-editor-v2
echo Ingress:   kubectl apply -f k8s\ingress.yaml
echo ========================================

endlocal
