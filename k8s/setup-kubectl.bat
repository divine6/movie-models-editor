@echo off
setlocal EnableExtensions

set "KUBECONFIG_FILE=%~dp0shuaipeng.liu.kubeconfig"

if not exist "%KUBECONFIG_FILE%" (
  echo [ERROR] kubeconfig not found: %KUBECONFIG_FILE%
  exit /b 1
)

where kubectl >nul 2>&1
if errorlevel 1 (
  echo [ERROR] kubectl not found. Install via:
  echo   winget install -e --id Kubernetes.kubectl
  echo Or enable Kubernetes in Docker Desktop.
  exit /b 1
)

setx KUBECONFIG "%KUBECONFIG_FILE%" >nul
set "KUBECONFIG=%KUBECONFIG_FILE%"

echo [OK] KUBECONFIG set to:
echo   %KUBECONFIG_FILE%
echo.
echo Current context:
kubectl config current-context
echo.
echo Namespace (from context):
kubectl config view --minify -o jsonpath="{..namespace}{'\n'}"
echo.
echo Cluster access test:
kubectl get ns u3d
echo.
echo Done. Re-open terminal for setx to take effect in new shells.
