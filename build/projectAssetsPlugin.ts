import { createReadStream, existsSync, statSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PluginOption } from "vite";

function resolveMoviesDir(): string {
  const root = process.cwd();
  const moviesDir = resolve(root, "movies");
  if (existsSync(moviesDir)) return moviesDir;
  return resolve(root, "movie");
}

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json"
};

function parseByteRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;

  return { start, end: Math.min(end, size - 1) };
}

function serveProjectAsset(req: IncomingMessage, res: ServerResponse, next: () => void, mountPath: string, rootDir: string) {
  const url = req.url?.split("?")[0] || "";
  if (!url.startsWith(mountPath)) return next();

  const rel = decodeURIComponent(url.slice(mountPath.length)).replace(/^\/+/, "");
  if (!rel) return next();

  const filePath = normalize(join(rootDir, rel));
  const normalizedRoot = normalize(rootDir);
  if (!filePath.startsWith(normalizedRoot)) return next();

  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const size = stat.size;
  const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  res.setHeader("Accept-Ranges", "bytes");

  const range = req.headers.range;
  if (range) {
    const parsed = parseByteRange(range, size);
    if (!parsed) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }

    const { start, end } = parsed;
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", end - start + 1);
    res.setHeader("Content-Type", contentType);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", size);
  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

/**
 * 开发环境：将仓库根目录 movie/、models/ 映射为 /movies、/models
 * 生产构建：复制默认视频与 Shell.glb 到输出目录
 */
export function projectAssetsPlugin(): PluginOption {
  let outDir = "dist";

  return {
    name: "project-assets",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      const base = server.config.base || "/";
      const basePrefix = base.endsWith("/") ? base.slice(0, -1) : base;
      const movieDir = resolveMoviesDir();
      const modelsDir = resolve(process.cwd(), "models");

      server.middlewares.use((req, res, next) => {
        serveProjectAsset(req, res, next, `${basePrefix}/movies`, movieDir);
      });
      server.middlewares.use((req, res, next) => {
        serveProjectAsset(req, res, next, `${basePrefix}/models`, modelsDir);
      });
    },
    async closeBundle() {
      const movieSrc = resolveMoviesDir();
      const shellSrc = resolve(process.cwd(), "models/Shell.glb");
      const moviesDest = join(outDir, "movies");
      const modelsDest = join(outDir, "models");

      if (existsSync(movieSrc)) {
        await cp(movieSrc, moviesDest, { recursive: true });
      }
      if (existsSync(shellSrc)) {
        await mkdir(modelsDest, { recursive: true });
        await cp(shellSrc, join(modelsDest, "Shell.glb"));
      }
    }
  };
}
