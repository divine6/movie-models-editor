@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM 一键：构建镜像 -> 推送 Harbor -> kubectl 部署到 u3d 命名空间
REM 用法:
REM   deploy.bat              使用 latest 标签
REM   deploy.bat v1.0.0       指定镜像标签
REM 可选环境变量: HARBOR_USER / HARBOR_PASSWORD（Harbor 登录）

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

echo ========================================
echo  movie-editor K8s Deploy
echo ========================================
echo KUBECONFIG:  %KUBECONFIG%
echo Image:       %FULL_IMAGE%
echo Namespace:   u3d
echo Service:     movie-editor
echo ========================================
echo.

echo [1/5] Build Docker image...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\docker-build.ps1" -Tag "%FULL_IMAGE%"
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
    echo [ERROR] docker push latest failed.
    exit /b 1
  )
)
echo.

echo [4/5] Apply K8s manifests...
kubectl apply -f "%SCRIPT_DIR%deploy.yaml"
if errorlevel 1 (
  echo [ERROR] kubectl apply failed.
  exit /b 1
)

kubectl set image deployment/movie-editor movie-editor="%FULL_IMAGE%" -n u3d
if errorlevel 1 (
  echo [ERROR] kubectl set image failed.
  exit /b 1
)
echo.

echo [5/5] Wait for rollout...
kubectl rollout status deployment/movie-editor -n u3d --timeout=300s
if errorlevel 1 (
  echo [ERROR] Rollout failed. Check: kubectl describe pod -l app=movie-editor -n u3d
  exit /b 1
)

echo.
echo ========================================
echo  Deploy succeeded
echo ========================================
echo Image:     %FULL_IMAGE%
echo Pods:      kubectl get pods -l app=movie-editor -n u3d
echo Service:   kubectl get svc movie-editor -n u3d
echo Access:    https://api.highlands.ltd/movie-editor
echo ========================================

endlocal
