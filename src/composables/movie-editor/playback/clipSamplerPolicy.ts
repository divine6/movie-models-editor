import type { Chapter, SceneAnimationNode } from "@/interface/project";

/**
 * Runtime sampling policy: clips are the truth when present.
 * Does NOT mutate persisted server JSON.
 */
export function chapterHasClips(chapter: Chapter | SceneAnimationNode | null | undefined): boolean {
  return !!(chapter?.clips && chapter.clips.length > 0);
}

/**
 * When true, pose/visual sampling must use clips only and ignore
 * modelConfigs.*.animConfig (avoids double-apply in export/presentation).
 */
export function shouldSampleClipsOnly(chapter: Chapter | SceneAnimationNode | null | undefined): boolean {
  return chapterHasClips(chapter);
}

/**
 * When true, fall back to legacy modelConfigs.animConfig segments.
 * Only for chapters that never got clips (v1 / empty).
 */
export function shouldSampleLegacyAnimConfig(chapter: Chapter | SceneAnimationNode | null | undefined): boolean {
  return !chapterHasClips(chapter);
}

/** Default target animTime for clip targets (matches animationClips.ts). */
export const CLIP_TARGET_ANIM_TIME_DEFAULT = 0.5;

/** Legacy segment animTime fallback (old animConfig chains). */
export const LEGACY_SEGMENT_ANIM_TIME_DEFAULT = 3;
