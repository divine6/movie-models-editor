import {
  DEFAULT_MODEL_HIGHLIGHT_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_WIREFRAME_COLOR
} from "@/composables/movie-editor/utils/modelConfig";

export function roundAnimNum(n: number, decimals = 3) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

let animSegIdCounter = 0;

export function nextAnimSegmentId() {
  return `seg_${++animSegIdCounter}`;
}

/** 片段外观（在片段时间窗内生效） */
export type ClipVisualState = {
  visible: boolean;
  outline: boolean;
  wireframe: boolean;
  highlight: boolean;
  outlineColor: string;
  wireframeColor: string;
  modelHighlightColor: string;
  intro: string;
};

export function createDefaultClipVisual(partial?: Partial<ClipVisualState>): ClipVisualState {
  return {
    visible: true,
    outline: false,
    wireframe: false,
    highlight: false,
    outlineColor: DEFAULT_OUTLINE_COLOR,
    wireframeColor: DEFAULT_WIREFRAME_COLOR,
    modelHighlightColor: DEFAULT_MODEL_HIGHLIGHT_COLOR,
    intro: "",
    ...partial
  };
}

export function cloneClipVisual(v?: Partial<ClipVisualState> | null): ClipVisualState {
  return createDefaultClipVisual(v ?? undefined);
}

export function mapStoredClipVisual(raw?: Partial<ClipVisualState> | null): ClipVisualState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return createDefaultClipVisual({
    // 必须保留显式 false，不能用 || 默认成 true
    visible: raw.visible === false ? false : raw.visible === true ? true : true,
    outline: !!raw.outline,
    wireframe: !!raw.wireframe,
    highlight: !!raw.highlight,
    outlineColor: raw.outlineColor || DEFAULT_OUTLINE_COLOR,
    wireframeColor: raw.wireframeColor || DEFAULT_WIREFRAME_COLOR,
    modelHighlightColor: raw.modelHighlightColor || DEFAULT_MODEL_HIGHLIGHT_COLOR,
    intro: typeof raw.intro === "string" ? raw.intro : ""
  });
}

export type StoredAnimSegmentInput = {
  id?: string;
  pauseTime?: number;
  animTime?: number;
  easing?: string;
  pivot?: string;
  startPos: number[];
  endPos: number[];
  startScale: number;
  endScale: number;
  startRot: number[];
  endRot: number[];
  clipVisual?: Partial<ClipVisualState> | null;
  _expandedPanels?: string[];
  /** 编辑态绝对时间（相对动画起点），不落盘 */
  start?: number;
  end?: number;
};

/** 存盘 segment → 编辑器 segment（含 pause/anim） */
export function mapStoredAnimSegment(s: StoredAnimSegmentInput) {
  const clipVisual = mapStoredClipVisual(s.clipVisual) ?? createDefaultClipVisual();
  return {
    id: s.id || nextAnimSegmentId(),
    pauseTime: s.pauseTime ?? 0,
    animTime: s.animTime ?? 3,
    easing: s.easing || "easeInOut",
    pivot: s.pivot || "center",
    startPos: [...s.startPos],
    endPos: [...s.endPos],
    startScale: s.startScale,
    endScale: s.endScale,
    startRot: [...s.startRot],
    endRot: [...s.endRot],
    clipVisual,
    _expandedPanels: s._expandedPanels || ["start", "end"],
    start: s.start,
    end: s.end
  };
}

export function serializeClipVisual(v?: Partial<ClipVisualState> | null): ClipVisualState {
  return cloneClipVisual(v);
}

/** 按 elapsed 取当前片段（含该段 pause 区间）；超出轨长取最后一段 */
export function findActiveSegmentAtElapsed<T extends { pauseTime?: number; animTime?: number }>(
  segments: T[],
  elapsedSec: number
): T | null {
  if (!segments?.length) return null;
  let acum = 0;
  let total = 0;
  for (const seg of segments) total += (seg.pauseTime || 0) + (seg.animTime ?? 3);
  if (total <= 0) return segments[0];
  const elapsed = Math.max(0, elapsedSec);
  if (elapsed <= 0) return segments[0];
  if (elapsed >= total) return segments[segments.length - 1];
  for (const seg of segments) {
    const segTotal = (seg.pauseTime || 0) + (seg.animTime ?? 3);
    if (elapsed >= acum && elapsed <= acum + segTotal) return seg;
    acum += segTotal;
  }
  return segments[segments.length - 1];
}

/**
 * 仅在「动画窗口」内取段（不含 pause 等待）。
 * - 段前初始 pause：返回 null（章节默认外观）
 * - 段与段之间的间隙：返回上一段（保持结束外观，多片段依次播放不跳动）
 * - 超出轨长：仍取最后一段
 * animTime=0（起止重合）时：从该时刻起生效，直到下一段动画窗或轨末。
 */
export function findAnimatingSegmentAtElapsed<
  T extends { pauseTime?: number; animTime?: number; start?: number; end?: number }
>(segments: T[], elapsedSec: number): T | null {
  if (!segments?.length) return null;
  const elapsed = Math.max(0, elapsedSec);
  let cursor = 0;
  let lastSeg = segments[0];
  let lastEnd = 0;
  const windows: Array<{ seg: T; start: number; end: number }> = [];

  for (const seg of segments) {
    const pause = seg.pauseTime || 0;
    const anim = seg.animTime ?? 3;
    const start =
      typeof seg.start === "number" && Number.isFinite(seg.start)
        ? seg.start
        : roundAnimNum(cursor + pause);
    const end =
      typeof seg.end === "number" && Number.isFinite(seg.end)
        ? seg.end
        : roundAnimNum(start + Math.max(0, anim));
    lastSeg = seg;
    lastEnd = end;
    windows.push({ seg, start, end });
    cursor = Math.max(cursor, end);
  }

  for (let i = 0; i < windows.length; i++) {
    const { seg, start, end } = windows[i];
    const zeroLen = end - start <= 1e-8;
    if (zeroLen) {
      const nextStart = i + 1 < windows.length ? windows[i + 1].start : Number.POSITIVE_INFINITY;
      if (elapsed + 1e-4 >= start && elapsed < nextStart - 1e-4) return seg;
      continue;
    }
    if (elapsed + 1e-4 >= start && elapsed < end - 1e-4) return seg;
  }

  if (elapsed >= lastEnd - 1e-4) return lastSeg;

  // 间隙：保持上一段结束态，避免下一段 start 提前套上造成「混乱」
  for (let i = 0; i < windows.length - 1; i++) {
    if (elapsed + 1e-4 >= windows[i].end && elapsed < windows[i + 1].start - 1e-4) {
      return windows[i].seg;
    }
  }
  return null;
}

/** pause 链 → 绝对 [start, end]（原地写入 seg.start / seg.end） */
export function annotateSegmentsAbsoluteTimes<T extends { pauseTime?: number; animTime?: number; start?: number; end?: number }>(
  segments: T[]
): T[] {
  let t = 0;
  for (const seg of segments) {
    const pause = seg.pauseTime || 0;
    const anim = seg.animTime ?? 3;
    const start = roundAnimNum(t + pause);
    const end = roundAnimNum(start + anim);
    seg.start = start;
    seg.end = end;
    t = end;
  }
  return segments;
}

export type SyncAbsoluteTimesResult = {
  ok: boolean;
  error?: string;
  segments: StoredAnimSegmentInput[];
};

const TIME_EPS = 1e-3;

/**
 * 以绝对 start/end 为源，重算 pauseTime/animTime（按 start 排序）。
 * 同轨不允许重叠；间隙用 pauseTime 表达。
 */
export function syncPauseChainFromAbsoluteTimes(
  segments: StoredAnimSegmentInput[]
): SyncAbsoluteTimesResult {
  if (!segments.length) {
    return { ok: true, segments: [] };
  }

  const sorted = [...segments].sort((a, b) => {
    const as = a.start ?? 0;
    const bs = b.start ?? 0;
    return as - bs;
  });

  let prevEnd = 0;
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const start = roundAnimNum(seg.start ?? prevEnd);
    let end = roundAnimNum(seg.end ?? start + (seg.animTime ?? 3));
    if (end < start - TIME_EPS) {
      end = start;
    }
    if (start < prevEnd - TIME_EPS) {
      return {
        ok: false,
        error: `片段时间重叠（第 ${i + 1} 段与上一段）`,
        segments
      };
    }
    seg.pauseTime = roundAnimNum(Math.max(0, start - prevEnd));
    // 允许 0：瞬移
    seg.animTime = roundAnimNum(Math.max(0, end - start));
    seg.start = start;
    seg.end = roundAnimNum(start + seg.animTime);
    prevEnd = seg.end;
  }

  segments.splice(0, segments.length, ...sorted);
  return { ok: true, segments };
}

/** 轨总时长 = 最后一段 end（或 pause 链累加） */
export function calcSegmentsTotalDuration(segments: Array<{ pauseTime?: number; animTime?: number; end?: number }>): number {
  if (!segments.length) return 0;
  const last = segments[segments.length - 1];
  if (typeof last.end === "number" && Number.isFinite(last.end)) {
    return Math.max(0, last.end);
  }
  let total = 0;
  for (const seg of segments) {
    total += (seg.pauseTime || 0) + (seg.animTime ?? 3);
  }
  return total;
}
