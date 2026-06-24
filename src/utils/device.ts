/** 触屏/手机设备：无法可靠预加载视频，需首帧占位 + 手动播放 */
export function isCoarsePointerDevice() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
}

/** 媒体片段 URL，部分移动端可借此展示首帧 */
export function withVideoPosterFragment(src: string) {
  if (!src) return src;
  const base = src.split("#")[0];
  return `${base}#t=0.001`;
}
