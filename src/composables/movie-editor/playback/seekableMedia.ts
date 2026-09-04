/**
 * Servers that omit Accept-Ranges leave HTMLVideoElement.seekable at [0, 0]
 * even when the file is fully buffered. Blob URLs are always seekable.
 */

const blobUrlBySrc = new Map<string, string>();
const inflightBySrc = new Map<string, Promise<string | null>>();

export function peekSeekableMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("blob:") || src.startsWith("data:")) return src;
  return blobUrlBySrc.get(src) ?? null;
}

export function prefetchSeekableMedia(src: string | null | undefined) {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return;
  void ensureSeekableMediaUrl(src);
}

export async function ensureSeekableMediaUrl(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("blob:") || src.startsWith("data:")) return src;
  const hit = blobUrlBySrc.get(src);
  if (hit) return hit;
  const pending = inflightBySrc.get(src);
  if (pending) return pending;

  const task = (async () => {
    try {
      const res = await fetch(src, { mode: "cors", credentials: "same-origin" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.size) return null;
      const url = URL.createObjectURL(blob);
      blobUrlBySrc.set(src, url);
      return url;
    } catch {
      return null;
    } finally {
      inflightBySrc.delete(src);
    }
  })();
  inflightBySrc.set(src, task);
  return task;
}

export function clearSeekableMediaCache() {
  for (const url of blobUrlBySrc.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  blobUrlBySrc.clear();
  inflightBySrc.clear();
}
