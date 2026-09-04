/**
 * Single display clock for progress bar / play button.
 * Sources: video | wallclock | session (presentation optimistic).
 */

export type PlaybackClockSource = "video" | "wallclock" | "session";

export type PlaybackClockSnapshot = {
  source: PlaybackClockSource;
  time: number;
  duration: number;
  playing: boolean;
};

export type ResolvePlaybackClockInput = {
  isPresentation: boolean;
  wallclockActive: boolean;
  /** presentation session optimistic time */
  sessionTime: number;
  sessionPlaying: boolean;
  /** wallclock preview */
  wallElapsed: number;
  wallDuration: number;
  wallPlaying: boolean;
  /** edit / media */
  videoTime: number;
  videoDuration: number;
  videoPlaying: boolean;
  /** while seeking in presentation, freeze on session target */
  seekFrozen?: boolean;
};

/**
 * Resolve the one UI clock. Progress bar and play button must bind only this.
 */
export function resolvePlaybackClock(input: ResolvePlaybackClockInput): PlaybackClockSnapshot {
  if (input.wallclockActive) {
    return {
      source: "wallclock",
      time: input.wallElapsed,
      duration: Math.max(0, input.wallDuration),
      playing: input.wallPlaying
    };
  }
  if (input.isPresentation) {
    return {
      source: "session",
      time: input.sessionTime,
      duration: Math.max(0, input.videoDuration),
      playing: input.sessionPlaying
    };
  }
  return {
    source: "video",
    time: input.videoTime,
    duration: Math.max(0, input.videoDuration),
    playing: input.videoPlaying
  };
}
