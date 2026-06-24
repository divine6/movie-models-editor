import type { ComputedRef, Ref } from "vue";

import type { Chapter } from "@/interface/project";

export function createTimelineHelpers(duration: Ref<number>, currentTime: Ref<number>, timelineChapters: ComputedRef<Chapter[]>) {
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const se = Math.floor(s % 60);
    return `${m}:${se.toString().padStart(2, "0")}`;
  };

  const pct = (v: number) => (duration.value > 0 ? (v / duration.value) * 100 : 0);

  const fillScale = (i: number) => {
    const ch = timelineChapters.value[i];
    if (!ch || !duration.value) return 0;
    if (currentTime.value >= ch.endTime) return 1;
    if (currentTime.value > ch.startTime) return (currentTime.value - ch.startTime) / (ch.endTime - ch.startTime);
    return 0;
  };

  const chapterFillPct = (ch: Chapter) => {
    if (!duration.value || ch.endTime <= ch.startTime) return 0;
    if (currentTime.value >= ch.endTime) return 100;
    if (currentTime.value > ch.startTime) return ((currentTime.value - ch.startTime) / (ch.endTime - ch.startTime)) * 100;
    return 0;
  };

  const chapterSegmentFlex = (ch: Chapter) => {
    const dur = duration.value;
    if (dur <= 0) return 1;
    return Math.max((ch.endTime - ch.startTime) / dur, 0.001);
  };

  const chapterSegmentStyle = (ch: Chapter) => {
    const dur = duration.value;
    if (dur <= 0) return { left: "0%", width: "0%" };
    const left = (ch.startTime / dur) * 100;
    const width = ((ch.endTime - ch.startTime) / dur) * 100;
    return {
      left: `${left}%`,
      width: `${Math.max(0.15, width)}%`
    };
  };

  return { fmt, pct, fillScale, chapterFillPct, chapterSegmentFlex, chapterSegmentStyle };
}
