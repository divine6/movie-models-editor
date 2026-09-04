/**
 * Lightweight off-DOM video preload pool for multi-video scenes.
 * Does not mutate stored videoSrc; only warms browser media cache.
 * Use preload=metadata so warmers do not steal bandwidth from the active video.
 */

export type VideoPoolEntry = {
  src: string;
  el: HTMLVideoElement;
};

const MAX_POOL = 4;
const pool: VideoPoolEntry[] = [];
let idleWarmHandle: number | null = null;
let pendingWarmSrcs: string[] = [];

function makeWarmVideo(src: string): HTMLVideoElement {
  const el = document.createElement("video");
  el.muted = true;
  el.playsInline = true;
  el.preload = "auto";
  el.src = src;
  try {
    el.load();
  } catch {
    /* ignore */
  }
  return el;
}

/** Warm src in background; keep at most MAX_POOL entries. */
export function warmVideoSrc(src: string | null | undefined) {
  if (!src || typeof document === "undefined") return;
  if (src.startsWith("blob:") || src.startsWith("data:")) return;
  const existing = pool.find(p => p.src === src);
  if (existing) {
    const idx = pool.indexOf(existing);
    if (idx > 0) {
      pool.splice(idx, 1);
      pool.unshift(existing);
    }
    return;
  }
  const el = makeWarmVideo(src);
  pool.unshift({ src, el });
  while (pool.length > MAX_POOL) {
    const dropped = pool.pop();
    if (dropped) {
      try {
        dropped.el.removeAttribute("src");
        dropped.el.load();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Defer warming other videos until the browser is idle.
 * Call only after a real source switch — never on same-node seek/reuse.
 */
export function scheduleWarmVideoSrcs(srcs: Array<string | null | undefined>) {
  if (typeof window === "undefined") return;
  for (const src of srcs) {
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) continue;
    if (!pendingWarmSrcs.includes(src)) pendingWarmSrcs.push(src);
  }
  if (!pendingWarmSrcs.length) return;
  if (idleWarmHandle != null) return;
  const run = () => {
    idleWarmHandle = null;
    const batch = pendingWarmSrcs.splice(0, 2);
    for (const src of batch) warmVideoSrc(src);
    if (pendingWarmSrcs.length) scheduleWarmVideoSrcs([...pendingWarmSrcs]);
  };
  if (typeof requestIdleCallback === "function") {
    idleWarmHandle = requestIdleCallback(run, { timeout: 2500 }) as unknown as number;
  } else {
    idleWarmHandle = window.setTimeout(run, 600) as unknown as number;
  }
}

export function clearVideoWarmPool() {
  if (idleWarmHandle != null) {
    if (typeof cancelIdleCallback === "function") {
      try {
        cancelIdleCallback(idleWarmHandle);
      } catch {
        window.clearTimeout(idleWarmHandle);
      }
    } else {
      window.clearTimeout(idleWarmHandle);
    }
    idleWarmHandle = null;
  }
  pendingWarmSrcs = [];
  while (pool.length) {
    const dropped = pool.pop();
    if (!dropped) break;
    try {
      dropped.el.removeAttribute("src");
      dropped.el.load();
    } catch {
      /* ignore */
    }
  }
}

export function getWarmedVideoSrcs(): string[] {
  return pool.map(p => p.src);
}
