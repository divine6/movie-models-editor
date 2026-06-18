/** 项目默认资源路径（相对站点根路径，不含 VITE_PUBLIC_PATH 前缀） */
export const DEFAULT_MODEL_RELATIVE_PATH = "models/Shell.glb";

/**
 * movies 目录下候选视频（按优先级）。
 * 开发/构建时由 Vite 插件将仓库根目录 movie/ 映射为 URL 路径 /movies/
 */
export const DEFAULT_VIDEO_CANDIDATES = ["faq-friday-power-shelf.mp4", "video.mp4", "main.mp4"];

/** 拼接带 base 的静态资源 URL */
export function projectAssetUrl(relativePath: string): string {
  const base = import.meta.env.VITE_PUBLIC_PATH || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${relativePath.replace(/^\//, "")}`;
}

export function defaultModelUrl(): string {
  return projectAssetUrl(DEFAULT_MODEL_RELATIVE_PATH);
}

/** 探测 movies 目录下第一个可用的默认视频 */
export async function resolveDefaultVideoUrl(): Promise<string | null> {
  for (const file of DEFAULT_VIDEO_CANDIDATES) {
    const url = projectAssetUrl(`movies/${file}`);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch {
      /* ignore */
    }
  }
  return null;
}
