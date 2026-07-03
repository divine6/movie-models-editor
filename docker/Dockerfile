# syntax=docker/dockerfile:1
# 构建上下文需为 saas3.0 目录（包含 movie-models-editor 与 movie-models-server）
# 示例: docker build -f movie-models-editor/docker/Dockerfile --secret id=npmrc,src=$HOME/.npmrc -t movie-models:latest .

# ---------- 1. 构建前端 SPA ----------
FROM node:20-alpine AS frontend-build

WORKDIR /app/editor

RUN corepack enable && corepack prepare pnpm@10.34.3 --activate

COPY movie-models-editor/package.json movie-models-editor/pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile

COPY movie-models-editor/ .

ARG VITE_API_URL=https://ext.highlands.ltd/light-sass-api/
ARG VITE_PUBLIC_PATH=/movie-editor/
ARG VITE_EDITOR_SERVER_URL=/movie-editor
ARG VITE_EDITOR_FRONTEND_URL=/movie-editor
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_PUBLIC_PATH=${VITE_PUBLIC_PATH} \
    VITE_EDITOR_SERVER_URL=${VITE_EDITOR_SERVER_URL} \
    VITE_EDITOR_FRONTEND_URL=${VITE_EDITOR_FRONTEND_URL}

RUN pnpm run build:docker

# ---------- 2. 运行时镜像（Express API + 静态 SPA） ----------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    EDITOR_DIST_PATH=/app/editor-dist \
    STORAGE_DRIVER=mysql

# 后端依赖均为公开包，使用公共源安装（避免 lock 中阿里云私有源地址）
COPY movie-models-server/package.json ./
RUN npm install --omit=dev --registry=https://registry.npmmirror.com && npm cache clean --force

COPY movie-models-server/ .
COPY --from=frontend-build /app/editor/dist-tenant ./editor-dist

RUN mkdir -p storage/uploads/models storage/uploads/videos storage/models storage/data

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
