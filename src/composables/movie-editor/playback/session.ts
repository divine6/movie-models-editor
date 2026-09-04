/**
 * Presentation / seek lock helpers.
 * Keeps generation + stuck-lock recovery outside the god file.
 */

export type PresentationPlaybackPhase = "paused" | "playing" | "seeking" | "ended" | "blocked" | "idle";
export type PresentationPlaybackIntent = "play" | "pause";

export type PresentationPlaybackSessionState = {
  phase: PresentationPlaybackPhase;
  intent: PresentationPlaybackIntent;
  committedTime: number;
  targetTime: number;
  navChapterId: string | null;
  playableChapterId: string | null;
  requestId: number;
  autoAdvance: boolean;
};

/** Default stuck-lock threshold before forced unlock while media is playing. */
export const PLAYBACK_STUCK_LOCK_MS = 400;

/** Hard ceiling: even while paused/seeking, never block mesh/progress forever. */
export const PLAYBACK_HARD_LOCK_MS = 800;

export function createPresentationPlaybackSession(): PresentationPlaybackSessionState {
  return {
    phase: "paused",
    intent: "pause",
    committedTime: 0,
    targetTime: 0,
    navChapterId: null,
    playableChapterId: null,
    requestId: 0,
    autoAdvance: false
  };
}

export function nextPlaybackRequestId(session: PresentationPlaybackSessionState): number {
  session.requestId += 1;
  return session.requestId;
}

export function isPlaybackRequestCurrent(session: PresentationPlaybackSessionState, requestId: number): boolean {
  return session.requestId === requestId;
}

export type PlaybackLockSnapshot = {
  videoChapterSyncPaused: boolean;
  presentationChapterTransition: boolean;
  chapterNavLock: boolean;
  pausedAt: number;
};

/**
 * Decide whether locks should be force-cleared.
 * - Soft: playing + lock older than PLAYBACK_STUCK_LOCK_MS
 * - Hard: any lock older than PLAYBACK_HARD_LOCK_MS (covers stuck seeking)
 */
export function shouldForceClearPlaybackLocks(
  video: Pick<HTMLVideoElement, "paused" | "ended">,
  locks: PlaybackLockSnapshot,
  now = performance.now()
): boolean {
  const locked =
    locks.videoChapterSyncPaused || locks.presentationChapterTransition || locks.chapterNavLock;
  if (!locked) return false;

  const age = locks.pausedAt > 0 ? now - locks.pausedAt : Number.POSITIVE_INFINITY;
  if (age >= PLAYBACK_HARD_LOCK_MS) return true;
  if (video.paused || video.ended) return false;
  return age >= PLAYBACK_STUCK_LOCK_MS;
}
