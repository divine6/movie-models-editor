/**
 * Playback / render diagnostics for heavy scenes.
 * Enable via:
 * - localStorage.setItem("movieEditor.playbackDebug", "1")
 * - or URL ?playbackDebug=1
 * - or window.__MOVIE_EDITOR_PLAYBACK_DEBUG__ = true
 */

export type PlaybackDiagEvent =
  | "seek"
  | "lock"
  | "unlock"
  | "frame"
  | "switchVideo"
  | "command"
  | "stuckLock"
  | "sample";

export type PlaybackDiagSample = {
  at: number;
  event: PlaybackDiagEvent;
  label?: string;
  ms?: number;
  detail?: Record<string, unknown>;
};

const MAX_SAMPLES = 200;
const samples: PlaybackDiagSample[] = [];
let enabledCache: boolean | null = null;

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if ((window as any).__MOVIE_EDITOR_PLAYBACK_DEBUG__ === true) return true;
    if (localStorage.getItem("movieEditor.playbackDebug") === "1") return true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("playbackDebug") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function isPlaybackDiagnosticsEnabled(): boolean {
  if (enabledCache == null) enabledCache = readFlag();
  return enabledCache;
}

export function refreshPlaybackDiagnosticsFlag() {
  enabledCache = readFlag();
  return enabledCache;
}

export function markPlaybackDiag(
  event: PlaybackDiagEvent,
  label?: string,
  detail?: Record<string, unknown>,
  ms?: number
) {
  if (!isPlaybackDiagnosticsEnabled()) return;
  const sample: PlaybackDiagSample = {
    at: performance.now(),
    event,
    label,
    ms,
    detail
  };
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();
  if (event !== "frame") {
    // eslint-disable-next-line no-console
    console.debug(`[playback-diag] ${event}${label ? `:${label}` : ""}`, detail || "", ms != null ? `${ms.toFixed(1)}ms` : "");
  }
}

/** Timed span helper for seek / switchVideo / sample. */
export function beginPlaybackDiagSpan(event: PlaybackDiagEvent, label?: string, detail?: Record<string, unknown>) {
  const t0 = performance.now();
  if (!isPlaybackDiagnosticsEnabled()) {
    return () => performance.now() - t0;
  }
  markPlaybackDiag(event, label ? `${label}:start` : "start", detail);
  return () => {
    const ms = performance.now() - t0;
    markPlaybackDiag(event, label ? `${label}:end` : "end", detail, ms);
    return ms;
  };
}

export function getPlaybackDiagSamples(): readonly PlaybackDiagSample[] {
  return samples;
}

export function clearPlaybackDiagSamples() {
  samples.length = 0;
}

export function summarizePlaybackDiag() {
  const byEvent: Record<string, { count: number; totalMs: number; maxMs: number }> = {};
  for (const s of samples) {
    const key = s.event;
    if (!byEvent[key]) byEvent[key] = { count: 0, totalMs: 0, maxMs: 0 };
    byEvent[key].count++;
    if (typeof s.ms === "number") {
      byEvent[key].totalMs += s.ms;
      byEvent[key].maxMs = Math.max(byEvent[key].maxMs, s.ms);
    }
  }
  return byEvent;
}

/** Reproduce checklist for QA (logged once when diagnostics enable). */
export const PLAYBACK_REPRO_CHECKLIST = [
  "连点切章（同一视频内）— 进度条与 mesh 是否跟目标章",
  "跨视频切动画 — 是否播错视频/动画",
  "片尾循环 — 是否卡在 ended 或回跳错误",
  "无视频墙钟预览 — 片段顺序与时长是否与编辑一致",
  "展示页进度条拖拽 + 播放按钮 — 是否与动画同步",
  "页签切到后台再回来 — 是否停止发热 / 恢复播放"
] as const;

export function logPlaybackReproChecklist() {
  if (!isPlaybackDiagnosticsEnabled()) return;
  // eslint-disable-next-line no-console
  console.info("[playback-diag] repro checklist", PLAYBACK_REPRO_CHECKLIST);
}
