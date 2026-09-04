import type {
  AnimationClip,
  AnimationClipTarget,
  AnimSegment,
  CameraConfig,
  Chapter,
  ModelConfig
} from "@/interface/project";
import {
  annotateSegmentsAbsoluteTimes,
  calcSegmentsTotalDuration,
  createDefaultClipVisual,
  mapStoredAnimSegment,
  nextAnimSegmentId,
  roundAnimNum,
  syncPauseChainFromAbsoluteTimes,
  type ClipVisualState
} from "@/composables/movie-editor/utils/animation";
import { DEFAULT_CAMERA } from "@/utils/three/constants";

/** 片段间隔默认（秒） */
export const DEFAULT_CLIP_PAUSE_TIME = 0;
/** 片段起始→结束默认时长（秒）；0 表示瞬移 */
export const DEFAULT_CLIP_ANIM_TIME = 0.5;

let clipIdCounter = 0;

export function nextAnimationClipId() {
  return `clip_${Date.now().toString(36)}_${++clipIdCounter}`;
}

export function cloneCameraConfig(cam?: CameraConfig | null): CameraConfig {
  const src = cam ?? DEFAULT_CAMERA;
  return {
    position: [...(src.position || DEFAULT_CAMERA.position)] as [number, number, number],
    target: [...(src.target || DEFAULT_CAMERA.target)] as [number, number, number],
    fov: src.fov ?? DEFAULT_CAMERA.fov,
    transitionSec: src.transitionSec ?? DEFAULT_CAMERA.transitionSec
  };
}

function nearlyEqualNum(a: number, b: number, eps = 1e-3) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= eps;
}

/** 运镜数值是否实质相同（忽略浮点误差 / 控件精度四舍五入） */
export function cameraConfigsNearlyEqual(
  a?: CameraConfig | null,
  b?: CameraConfig | null,
  eps = 1e-3
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    nearlyEqualNum(a.position[0], b.position[0], eps) &&
    nearlyEqualNum(a.position[1], b.position[1], eps) &&
    nearlyEqualNum(a.position[2], b.position[2], eps) &&
    nearlyEqualNum(a.target[0], b.target[0], eps) &&
    nearlyEqualNum(a.target[1], b.target[1], eps) &&
    nearlyEqualNum(a.target[2], b.target[2], eps) &&
    nearlyEqualNum(a.fov, b.fov, eps) &&
    nearlyEqualNum(a.transitionSec ?? 0, b.transitionSec ?? 0, eps)
  );
}

export function clipTargetKey(modelId: string, nodeId?: string | null) {
  return `${modelId}|${nodeId || ""}`;
}

export function resolveTargetPauseTime(target: AnimationClipTarget): number {
  if (typeof target.pauseTime === "number" && Number.isFinite(target.pauseTime)) {
    return roundAnimNum(Math.max(0, target.pauseTime));
  }
  return 0;
}

export function resolveTargetAnimTime(target: AnimationClipTarget): number {
  if (typeof target.animTime === "number" && Number.isFinite(target.animTime)) {
    return roundAnimNum(Math.max(0, target.animTime));
  }
  return DEFAULT_CLIP_ANIM_TIME;
}

export function createEmptyClipTarget(
  modelId: string,
  nodeId: string | null,
  transform: {
    pos: number[];
    scale: number;
    rot: number[];
  },
  visual?: Partial<ClipVisualState> | null
): AnimationClipTarget {
  const pos = [...transform.pos] as [number, number, number];
  const rot = [...transform.rot] as [number, number, number];
  return {
    modelId,
    nodeId,
    easing: "easeInOut",
    pivot: "center",
    pauseTime: 0,
    animTime: DEFAULT_CLIP_ANIM_TIME,
    startPos: [...pos] as [number, number, number],
    endPos: [...pos] as [number, number, number],
    startScale: transform.scale,
    endScale: transform.scale,
    startRot: [...rot] as [number, number, number],
    endRot: [...rot] as [number, number, number],
    clipVisual: createDefaultClipVisual(visual ?? undefined)
  };
}

export function createAnimationClip(opts: {
  name: string;
  start?: number;
  end?: number;
  pauseTime?: number;
  animTime?: number;
  camera?: CameraConfig | null;
  targets?: AnimationClipTarget[];
}): AnimationClip {
  const pauseTime = roundAnimNum(Math.max(0, opts.pauseTime ?? DEFAULT_CLIP_PAUSE_TIME));
  const animTime = roundAnimNum(
    Math.max(
      0,
      opts.animTime ??
        (typeof opts.start === "number" && typeof opts.end === "number"
          ? Math.max(0, opts.end - opts.start)
          : DEFAULT_CLIP_ANIM_TIME)
    )
  );
  const start = roundAnimNum(Math.max(0, opts.start ?? 0));
  const end = roundAnimNum(
    typeof opts.end === "number" ? Math.max(start, opts.end) : start + animTime
  );
  return {
    id: nextAnimationClipId(),
    name: opts.name,
    start,
    end,
    pauseTime,
    animTime: typeof opts.animTime === "number" ? animTime : roundAnimNum(Math.max(0, end - start)),
    camera: cloneCameraConfig(opts.camera),
    targets: opts.targets ? opts.targets.map(cloneClipTarget) : []
  };
}

export function cloneClipTarget(t: AnimationClipTarget): AnimationClipTarget {
  return {
    modelId: t.modelId,
    nodeId: t.nodeId ?? null,
    easing: t.easing || "easeInOut",
    pivot: t.pivot || "center",
    pauseTime: resolveTargetPauseTime(t),
    animTime: resolveTargetAnimTime(t),
    startPos: [...(t.startPos || [0, 0, 0])] as [number, number, number],
    endPos: [...(t.endPos || [0, 0, 0])] as [number, number, number],
    startScale: t.startScale ?? 1,
    endScale: t.endScale ?? 1,
    startRot: [...(t.startRot || [0, 0, 0])] as [number, number, number],
    endRot: [...(t.endRot || [0, 0, 0])] as [number, number, number],
    clipVisual: createDefaultClipVisual(t.clipVisual ?? undefined)
  };
}

export function cloneAnimationClip(clip: AnimationClip): AnimationClip {
  return {
    id: clip.id,
    name: clip.name,
    start: clip.start,
    end: clip.end,
    pauseTime: resolveClipPauseTime(clip),
    animTime: resolveClipAnimTime(clip),
    camera: clip.camera ? cloneCameraConfig(clip.camera) : undefined,
    targets: (clip.targets || []).map(cloneClipTarget)
  };
}

export function resolveClipPauseTime(clip: AnimationClip): number {
  if (typeof clip.pauseTime === "number" && Number.isFinite(clip.pauseTime)) {
    return roundAnimNum(Math.max(0, clip.pauseTime));
  }
  return DEFAULT_CLIP_PAUSE_TIME;
}

export function resolveClipAnimTime(clip: AnimationClip): number {
  if (typeof clip.animTime === "number" && Number.isFinite(clip.animTime)) {
    return roundAnimNum(Math.max(0, clip.animTime));
  }
  const dur = (clip.end ?? 0) - (clip.start ?? 0);
  if (Number.isFinite(dur) && dur >= 0) return roundAnimNum(dur);
  return DEFAULT_CLIP_ANIM_TIME;
}

/** 片段窗长以界面起/止为准；animTime 仅作缺省回退（避免残留 animTime 把窗拉长盖住下一段） */
function resolveClipWindowAnim(clip: AnimationClip): number {
  const span = roundAnimNum(Math.max(0, (clip.end ?? 0) - (clip.start ?? 0)));
  if (span > 1e-8) return span;
  // 显式的 0 表示瞬时片段，不能再回退成默认 0.5 秒。
  if (typeof clip.animTime === "number" && Number.isFinite(clip.animTime)) {
    return roundAnimNum(Math.max(0, clip.animTime));
  }
  return DEFAULT_CLIP_ANIM_TIME;
}

/** 从绝对 start/end 回填 pause/anim（按列表播放顺序，不用 start 排序以免同起点片段乱序） */
export function ensureClipTimingFields(clips: AnimationClip[]) {
  let prevEnd = 0;
  for (const clip of clips) {
    const span = roundAnimNum(Math.max(0, (clip.end ?? 0) - (clip.start ?? 0)));
    if (span > 1e-8) {
      clip.animTime = span;
    } else if (typeof clip.animTime !== "number" || !Number.isFinite(clip.animTime)) {
      clip.animTime = DEFAULT_CLIP_ANIM_TIME;
    } else {
      clip.animTime = roundAnimNum(Math.max(0, clip.animTime));
    }
    if (typeof clip.pauseTime !== "number" || !Number.isFinite(clip.pauseTime)) {
      clip.pauseTime = roundAnimNum(Math.max(0, (clip.start ?? 0) - prevEnd));
    } else {
      clip.pauseTime = roundAnimNum(Math.max(0, clip.pauseTime));
    }
    prevEnd = Math.max(prevEnd, clip.end ?? prevEnd);
  }
}

/**
 * 以列表顺序的绝对 start/end 为准回填 pause/anim。
 * - 重叠/同窗：接到上一段末尾（四个 0–0.5 会变成 0–0.5 / 0.5–1 / …）
 * - 故意留白（start > prevEnd）：保留间隙
 * 不再用 pauseTime 重算起点（残留 pause 会把中间段挤掉）。
 */
export function rebuildClipAbsoluteTimes(clips: AnimationClip[]) {
  if (!clips.length) return;
  ensureClipTimingFields(clips);
  let prevEnd = 0;
  for (const clip of clips) {
    const anim = resolveClipWindowAnim(clip);
    const start = roundAnimNum(Math.max(prevEnd, Math.max(0, clip.start ?? prevEnd)));
    clip.pauseTime = roundAnimNum(Math.max(0, start - prevEnd));
    clip.animTime = roundAnimNum(anim);
    clip.start = start;
    clip.end = roundAnimNum(start + clip.animTime);
    prevEnd = clip.end;
  }
}

export function getClipsTotalDuration(clips: AnimationClip[]): number {
  if (!clips.length) return 0;
  return Math.max(0, ...clips.map(c => c.end || 0));
}

export function findActiveClipAtElapsed(clips: AnimationClip[], elapsedSec: number): AnimationClip | null {
  if (!clips?.length) return null;
  // 起点相同时保持列表顺序，避免同窗片段被排到最后一段、中间段被跳过
  const sorted = clips
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => (a.clip.start ?? 0) - (b.clip.start ?? 0) || a.index - b.index);
  const t = Math.max(0, elapsedSec);
  for (let i = 0; i < sorted.length; i++) {
    const clip = sorted[i].clip;
    const start = clip.start ?? 0;
    const end = clip.end ?? start;
    const isLast = i === sorted.length - 1;
    if (end - start <= 1e-8) continue;
    if (t + 1e-8 >= start && (isLast ? t <= end + 1e-8 : t < end - 1e-8)) return clip;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const end = sorted[i].clip.end ?? 0;
    const nextStart = sorted[i + 1].clip.start ?? end;
    if (end - (sorted[i].clip.start ?? 0) <= 1e-8) continue;
    if (t + 1e-8 >= end && t < nextStart - 1e-8) return sorted[i].clip;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const clip = sorted[i].clip;
    if ((clip.end ?? 0) - (clip.start ?? 0) > 1e-8) return clip;
  }
  return sorted[0].clip;
}

export function syncClipTimes(clips: AnimationClip[]): { ok: boolean; error?: string } {
  ensureClipTimingFields(clips);
  // 优先用 pause/anim 重建绝对时间，允许 animTime=0
  try {
    rebuildClipAbsoluteTimes(clips);
  } catch {
    return { ok: false, error: "片段时间无效" };
  }
  let prevEnd = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (clip.start < prevEnd - 1e-3) {
      return { ok: false, error: `片段时间重叠（「${clip.name}」与上一段）` };
    }
    prevEnd = clip.end;
  }
  return { ok: true };
}

/** 将片段列表投影为各模型 animConfig.segments（复用既有播放） */
export function projectClipsToModelAnimConfigs(
  clips: AnimationClip[],
  getWritableConfig: (modelId: string, nodeId: string | null) => ModelConfig,
  clearAnimConfig: (modelId: string, nodeId: string | null) => void
) {
  // 先按片段窗 pause/anim 重建绝对时间，保证片段依次占满各自时长
  rebuildClipAbsoluteTimes(clips);
  const byTarget = new Map<string, { modelId: string; nodeId: string | null; segments: any[] }>();

  for (const clip of clips) {
    const clipStart = roundAnimNum(clip.start ?? 0);
    const clipEnd = roundAnimNum(Math.max(clipStart, clip.end ?? clipStart));
    for (const target of clip.targets || []) {
      if (!target?.modelId) continue;
      const nodeId = target.nodeId ?? null;
      const key = clipTargetKey(target.modelId, nodeId);
      let bucket = byTarget.get(key);
      if (!bucket) {
        bucket = { modelId: target.modelId, nodeId, segments: [] };
        byTarget.set(key, bucket);
      }
      // 姿态时长独立：落在片段窗内；超出则截到片段结束，不挤占下一片段
      const localPause = resolveTargetPauseTime(target);
      const localAnim = resolveTargetAnimTime(target);
      const segStart = roundAnimNum(Math.min(clipEnd, clipStart + localPause));
      const segEnd = roundAnimNum(Math.min(clipEnd, segStart + localAnim));
      bucket.segments.push(
        mapStoredAnimSegment({
          id: nextAnimSegmentId(),
          pauseTime: 0,
          animTime: roundAnimNum(Math.max(0, segEnd - segStart)),
          easing: target.easing || "easeInOut",
          pivot: target.pivot || "center",
          startPos: [...(target.startPos || [0, 0, 0])],
          endPos: [...(target.endPos || [0, 0, 0])],
          startScale: target.startScale ?? 1,
          endScale: target.endScale ?? 1,
          startRot: [...(target.startRot || [0, 0, 0])],
          endRot: [...(target.endRot || [0, 0, 0])],
          clipVisual: target.clipVisual,
          start: segStart,
          end: segEnd
        })
      );
    }
  }

  const touched = new Set<string>();
  for (const { modelId, nodeId, segments } of byTarget.values()) {
    const key = clipTargetKey(modelId, nodeId);
    touched.add(key);
    let synced = syncPauseChainFromAbsoluteTimes(segments);
    if (!synced.ok) {
      // 重叠时按 start 排序并压紧，避免整轨跳过导致播放混乱
      const sorted = [...segments].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
      let prevEnd = 0;
      for (const seg of sorted) {
        const start = Math.max(prevEnd, roundAnimNum(seg.start ?? prevEnd));
        const anim = Math.max(0, roundAnimNum((seg.end ?? start) - (seg.start ?? start)));
        seg.start = start;
        seg.end = roundAnimNum(start + anim);
        seg.pauseTime = roundAnimNum(Math.max(0, start - prevEnd));
        seg.animTime = anim;
        prevEnd = seg.end;
      }
      segments.splice(0, segments.length, ...sorted);
      synced = { ok: true, segments };
    }
    annotateSegmentsAbsoluteTimes(synced.segments);
    const cfg = getWritableConfig(modelId, nodeId);
    cfg.animation = true;
    cfg.animConfig = {
      duration: calcSegmentsTotalDuration(synced.segments),
      easing: "easeInOut",
      relativeTransform: false,
      // 保留绝对 start/end：播放侧可在「首段出场前」用绑定位姿，即使 pause 链曾被草稿覆盖也能对齐片段窗
      segments: synced.segments.map(s => ({
        id: s.id,
        pauseTime: s.pauseTime ?? 0,
        animTime: s.animTime ?? 0,
        easing: s.easing || "easeInOut",
        pivot: s.pivot || "center",
        startPos: [...s.startPos] as [number, number, number],
        endPos: [...s.endPos] as [number, number, number],
        startScale: s.startScale,
        endScale: s.endScale,
        startRot: [...s.startRot] as [number, number, number],
        endRot: [...s.endRot] as [number, number, number],
        clipVisual: s.clipVisual,
        start: s.start,
        end: s.end
      })) as AnimSegment[]
    };
  }

  return touched;
}

/**
 * 从旧的「按模型轨」animConfig 反推时间片段（仅当 chapter.clips 为空时）。
 * 按相同 [start,end] 合并为同一片段，多模型进同一轨。
 */
export function migrateModelAnimConfigsToClips(
  chapter: Chapter,
  walkTargets: Array<{ modelId: string; nodeId: string | null; segments: any[] }>
): AnimationClip[] {
  type Bucket = { start: number; end: number; targets: AnimationClipTarget[] };
  const buckets = new Map<string, Bucket>();

  for (const { modelId, nodeId, segments } of walkTargets) {
    if (!segments?.length) continue;
    const annotated = annotateSegmentsAbsoluteTimes(
      segments.map((s: any) => mapStoredAnimSegment(s))
    );
    for (const seg of annotated) {
      const start = roundAnimNum(seg.start ?? 0);
      const end = roundAnimNum(seg.end ?? start + (seg.animTime ?? 1));
      const key = `${start.toFixed(2)}|${end.toFixed(2)}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { start, end, targets: [] };
        buckets.set(key, bucket);
      }
      bucket.targets.push({
        modelId,
        nodeId,
        easing: seg.easing || "easeInOut",
        pivot: seg.pivot || "center",
        startPos: [...(seg.startPos || [0, 0, 0])] as [number, number, number],
        endPos: [...(seg.endPos || [0, 0, 0])] as [number, number, number],
        startScale: seg.startScale ?? 1,
        endScale: seg.endScale ?? 1,
        startRot: [...(seg.startRot || [0, 0, 0])] as [number, number, number],
        endRot: [...(seg.endRot || [0, 0, 0])] as [number, number, number],
        clipVisual: createDefaultClipVisual(seg.clipVisual)
      });
    }
  }

  const clips = [...buckets.values()]
    .sort((a, b) => a.start - b.start)
    .map((b, i) =>
      createAnimationClip({
        name: `片段 ${i + 1}`,
        start: b.start,
        end: b.end,
        camera: chapter.camera,
        targets: b.targets
      })
    );

  return clips;
}

export function targetToLiveSegment(clip: AnimationClip, target: AnimationClipTarget) {
  let pause: number;
  let anim: number;
  if (typeof target.animTime !== "number" && typeof target.pauseTime !== "number") {
    // 旧数据：姿态时长曾跟片段窗绑定；迁移为独立字段并写回，之后互不影响
    pause = 0;
    anim = resolveClipAnimTime(clip);
    target.pauseTime = pause;
    target.animTime = anim;
  } else {
    pause = resolveTargetPauseTime(target);
    anim = resolveTargetAnimTime(target);
  }
  const start = roundAnimNum((clip.start ?? 0) + pause);
  return mapStoredAnimSegment({
    id: nextAnimSegmentId(),
    pauseTime: pause,
    animTime: anim,
    easing: target.easing || "easeInOut",
    pivot: target.pivot || "center",
    startPos: [...(target.startPos || [0, 0, 0])],
    endPos: [...(target.endPos || [0, 0, 0])],
    startScale: target.startScale ?? 1,
    endScale: target.endScale ?? 1,
    startRot: [...(target.startRot || [0, 0, 0])],
    endRot: [...(target.endRot || [0, 0, 0])],
    clipVisual: target.clipVisual,
    start,
    end: roundAnimNum(start + anim)
  });
}

export function liveSegmentToTarget(
  modelId: string,
  nodeId: string | null,
  seg: any
): AnimationClipTarget {
  return {
    modelId,
    nodeId,
    easing: seg.easing || "easeInOut",
    pivot: seg.pivot || "center",
    pauseTime: roundAnimNum(Math.max(0, seg.pauseTime ?? 0)),
    animTime: roundAnimNum(Math.max(0, seg.animTime ?? DEFAULT_CLIP_ANIM_TIME)),
    startPos: [...(seg.startPos || [0, 0, 0])] as [number, number, number],
    endPos: [...(seg.endPos || [0, 0, 0])] as [number, number, number],
    startScale: seg.startScale ?? 1,
    endScale: seg.endScale ?? 1,
    startRot: [...(seg.startRot || [0, 0, 0])] as [number, number, number],
    endRot: [...(seg.endRot || [0, 0, 0])] as [number, number, number],
    clipVisual: createDefaultClipVisual(seg.clipVisual)
  };
}
