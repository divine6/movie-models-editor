export {
  beginPlaybackDiagSpan,
  clearPlaybackDiagSamples,
  getPlaybackDiagSamples,
  isPlaybackDiagnosticsEnabled,
  logPlaybackReproChecklist,
  markPlaybackDiag,
  PLAYBACK_REPRO_CHECKLIST,
  refreshPlaybackDiagnosticsFlag,
  summarizePlaybackDiag,
  type PlaybackDiagEvent,
  type PlaybackDiagSample
} from "./diagnostics";

export {
  chapterHasClips,
  CLIP_TARGET_ANIM_TIME_DEFAULT,
  LEGACY_SEGMENT_ANIM_TIME_DEFAULT,
  shouldSampleClipsOnly,
  shouldSampleLegacyAnimConfig
} from "./clipSamplerPolicy";

export {
  createPresentationPlaybackSession,
  isPlaybackRequestCurrent,
  nextPlaybackRequestId,
  PLAYBACK_HARD_LOCK_MS,
  PLAYBACK_STUCK_LOCK_MS,
  shouldForceClearPlaybackLocks,
  type PlaybackLockSnapshot,
  type PresentationPlaybackIntent,
  type PresentationPlaybackPhase,
  type PresentationPlaybackSessionState
} from "./session";

export {
  resolvePlaybackClock,
  type PlaybackClockSnapshot,
  type PlaybackClockSource,
  type ResolvePlaybackClockInput
} from "./clock";

export {
  clearGlbUrlCache,
  DEFAULT_GLB_LOAD_CONCURRENCY,
  getCachedGlbLoad,
  mapPool,
  setCachedGlbLoad
} from "./assetLoader";

export {
  bindVisibilityRenderController,
  MOBILE_PRESENTATION_DPR_SOFT_CAP,
  shouldPresentFrame,
  type RenderLoopActivity,
  type VisibilityRenderController
} from "./renderLoop";

export { clearVideoWarmPool, getWarmedVideoSrcs, scheduleWarmVideoSrcs, warmVideoSrc } from "./videoPool";

export {
  clearSeekableMediaCache,
  ensureSeekableMediaUrl,
  peekSeekableMediaUrl,
  prefetchSeekableMedia
} from "./seekableMedia";
