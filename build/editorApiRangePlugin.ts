import type { PluginOption } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

type CachedAsset = {
  body: Buffer;
  contentType: string;
};

const cache = new Map<string, CachedAsset>();
const inflight = new Map<string, Promise<CachedAsset | null>>();
const MAX_CACHE_BYTES = 80 * 1024 * 1024;

function parseByteRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return null;
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function cacheBytes() {
  let n = 0;
  for (const item of cache.values()) n += item.body.length;
  return n;
}

function remember(key: string, item: CachedAsset) {
  if (item.body.length > MAX_CACHE_BYTES) return;
  while (cache.size && cacheBytes() + item.body.length > MAX_CACHE_BYTES) {
    const first = cache.keys().next().value as string | undefined;
    if (!first) break;
    cache.delete(first);
  }
  cache.set(key, item);
}

function sendAsset(req: IncomingMessage, res: ServerResponse, item: CachedAsset) {
  const size = item.body.length;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", item.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");

  const range = req.headers.range;
  if (range) {
    const parsed = parseByteRange(Array.isArray(range) ? range[0] : range, size);
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
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(item.body.subarray(start, end + 1));
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Length", size);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(item.body);
}

/**
 * Dev-only: editor-api 静态资源补 HTTP Range（206），否则 Chromium 无法 seek。
 */
export function editorApiRangePlugin(upstream = "http://127.0.0.1:4000"): PluginOption {
  const origin = upstream.replace(/\/$/, "");
  return {
    name: "editor-api-range",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url?.split("?")[0] || "";
        if (!rawUrl.startsWith("/editor-api/api/assets/")) return next();
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        const upstreamPath = rawUrl.replace(/^\/editor-api/, "") || rawUrl;
        const cacheKey = upstreamPath;
        const hit = cache.get(cacheKey);
        if (hit) {
          sendAsset(req, res, hit);
          return;
        }

        let pending = inflight.get(cacheKey);
        if (!pending) {
          pending = (async () => {
            try {
              const resp = await fetch(`${origin}${upstreamPath}`);
              if (!resp.ok) return null;
              const buf = Buffer.from(await resp.arrayBuffer());
              if (!buf.length) return null;
              const item: CachedAsset = {
                body: buf,
                contentType: resp.headers.get("content-type") || "application/octet-stream"
              };
              remember(cacheKey, item);
              return item;
            } catch {
              return null;
            } finally {
              inflight.delete(cacheKey);
            }
          })();
          inflight.set(cacheKey, pending);
        }

        const item = await pending;
        if (!item) return next();
        sendAsset(req, res, item);
      });
    }
  };
}
