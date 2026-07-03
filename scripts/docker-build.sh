#!/usr/bin/env bash
# 构建 movie-models 全栈 Docker 镜像（前端 + 后端）
# 用法:
#   ./scripts/docker-build.sh
#   TAG=movie-models:1.0.0 VITE_API_URL=https://api.example.com/ ./scripts/docker-build.sh

set -euo pipefail

TAG="${TAG:-movie-models:latest}"
VITE_API_URL="${VITE_API_URL:-https://ext.highlands.ltd/light-sass-api/}"
CONTEXT_PATH="${CONTEXT_PATH:-/movie-editor}"
NO_CACHE="${NO_CACHE:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EDITOR_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTEXT_ROOT="$(cd "${EDITOR_ROOT}/.." && pwd)"
DOCKERFILE="${EDITOR_ROOT}/docker/Dockerfile"
DOCKERIGNORE_SRC="${EDITOR_ROOT}/docker/.dockerignore"
DOCKERIGNORE_DST="${CONTEXT_ROOT}/.dockerignore"
SERVER_DIR="${CONTEXT_ROOT}/movie-models-server"
NPMRC="${NPMRC:-${HOME}/.npmrc}"

if [[ ! -d "${SERVER_DIR}" ]]; then
  echo "Backend not found: ${SERVER_DIR}" >&2
  echo "movie-models-editor and movie-models-server must be sibling directories." >&2
  exit 1
fi

if [[ ! -f "${NPMRC}" ]]; then
  echo "npm auth not found: ${NPMRC} (required for private packages like base-components)." >&2
  exit 1
fi

echo "==> Context:      ${CONTEXT_ROOT}"
echo "==> Dockerfile:   ${DOCKERFILE}"
echo "==> Image tag:     ${TAG}"
echo "==> VITE_API_URL: ${VITE_API_URL}"
echo "==> Context path: ${CONTEXT_PATH}"
echo "==> npmrc:        ${NPMRC}"

cp "${DOCKERIGNORE_SRC}" "${DOCKERIGNORE_DST}"
trap 'rm -f "${DOCKERIGNORE_DST}"' EXIT

BUILD_ARGS=(
  build
  -f "${DOCKERFILE}"
  -t "${TAG}"
  --secret "id=npmrc,src=${NPMRC}"
  --build-arg "VITE_API_URL=${VITE_API_URL}"
  --build-arg "VITE_PUBLIC_PATH=${CONTEXT_PATH}/"
  --build-arg "VITE_EDITOR_SERVER_URL=${CONTEXT_PATH}"
  --build-arg "VITE_EDITOR_FRONTEND_URL=${CONTEXT_PATH}"
)

if [[ -n "${NO_CACHE}" ]]; then
  BUILD_ARGS+=(--no-cache)
fi

BUILD_ARGS+=("${CONTEXT_ROOT}")

docker "${BUILD_ARGS[@]}"

echo ""
echo "构建完成: ${TAG}"
echo "本地运行示例:"
echo "  docker run --rm -p 4000:4000 -e DB_HOST=host.docker.internal -e DB_PASSWORD=root ${TAG}"
