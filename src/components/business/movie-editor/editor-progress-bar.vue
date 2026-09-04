<template>
  <div class="progress-area" :class="{ 'preview-progress': editor.isPreviewMode }" @click.stop>
    <div
      :ref="editor.bindRef('trackEl')"
      class="progress-track progress-track--chapters"
      @click="onTrackClick"
      @pointerup="onTrackPointerUp"
    >
      <div class="prog-playback" :style="{ width: `${trailPct}%` }" />
      <div class="prog-segs prog-segs--absolute">
        <div
          v-for="(ch, i) in progressSegments"
          :key="ch.id"
          class="prog-seg-wrap"
          :style="segmentStyle(ch)"
        >
          <el-tooltip :content="ch.name" placement="top" :show-after="200">
            <div
              class="prog-seg"
              :class="{ 'is-current': editor.isPresentationTimelineSegmentCurrent(i) }"
              @click.stop="onSegmentClick(ch, $event)"
            >
              <div class="prog-seg-fill" :style="{ transform: `scaleX(${segmentFillScale(i)})` }" />
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="prog-playhead" :style="{ left: `${playheadPct}%` }" />
    </div>
    <div class="progress-meta">
      <div class="progress-meta-left">
        <button class="progress-ctrl-btn" type="button" :title="timelinePlaying ? '暂停' : '播放'" @click.stop="editor.togglePlay">
          <svg
            v-if="timelinePlaying"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="progress-ctrl-btn__icon"
            role="img"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M3.67 2C3.29997 2 3 2.29997 3 2.67V9.33C3 9.70003 3.29997 10 3.67 10H4.33C4.70003 10 5 9.70003 5 9.33V2.67C5 2.29997 4.70003 2 4.33 2H3.67ZM7.67 2C7.29997 2 7 2.29997 7 2.67V9.33C7 9.70003 7.29997 10 7.67 10H8.33C8.70003 10 9 9.70003 9 9.33V2.67C9 2.29997 8.70003 2 8.33 2H7.67Z"
              fill="currentColor"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            class="progress-ctrl-btn__icon"
            role="img"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M8.807 6.597a.667.667 0 0 0 0-1.194l-5.842-2.92A.667.667 0 0 0 2 3.079v5.842c0 .496.522.818.965.596z"
            />
          </svg>
        </button>
        <button
          class="progress-ctrl-btn progress-ctrl-btn--speed"
          type="button"
          title="播放倍速"
          @click="editor.cyclePlaybackRate"
        >
          {{ editor.playbackRateLabel }}
        </button>
        <div class="progress-time">
          <span class="progress-time-current">{{ editor.fmt(displayTime) }}</span>
          <span class="progress-time-sep">/</span>
          <span class="progress-time-total">{{ editor.fmt(displayDuration) }}</span>
        </div>
      </div>
      <div v-if="activeChapterLabel" class="progress-chapter">{{ activeChapterLabel }}</div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-progress-bar">
import { computed } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import type { Chapter } from "@/interface/project";

const editor = useMovieEditorContext();

const timelinePlaying = computed(() =>
  editor.playbackClock
    ? !!editor.playbackClock.playing
    : editor.wallclockPreviewActive
      ? !!editor.totalPlaying
      : !!editor.isPlaying
);
const displayTime = computed(() =>
  editor.playbackClock
    ? editor.playbackClock.time
    : editor.wallclockPreviewActive
      ? editor.clipPlayElapsed
      : editor.currentTime
);
const displayDuration = computed(() =>
  editor.playbackClock
    ? editor.playbackClock.duration
    : editor.wallclockPreviewActive
      ? editor.clipPlayDuration
      : editor.duration
);

const progressSegments = computed(() => editor.timelineChapters);
const trailPct = computed(() => {
  const dur = displayDuration.value;
  if (!dur || dur <= 0) return 0;
  return Math.max(0, Math.min(100, (displayTime.value / dur) * 100));
});
const playheadPct = computed(() => trailPct.value);

function segmentStyle(ch: Chapter) {
  return editor.chapterSegmentStyle(ch);
}

function segmentFillScale(i: number) {
  return editor.fillScale(i);
}

const activeChapterLabel = computed(() => {
  void editor.playbackUiRevision;
  void editor.selectedChapterId;
  void editor.selectedNodeId;
  void editor.currentTime;
  void editor.presentationUiRevision;
  void editor.isPlaying;
  if (editor.viewOnly || editor.isPreviewMode) {
    const idx = editor.currentChapterIdx;
    if (idx >= 0) return editor.timelineChapters[idx]?.name ?? "";
    return "";
  }
  const activeId = editor.getActiveChapterIdForUi();
  if (activeId) {
    return editor.chapters.find(ch => ch.id === activeId)?.name ?? "";
  }
  const idx = editor.currentChapterIdx;
  if (idx >= 0) return editor.timelineChapters[idx]?.name ?? "";
  return "";
});

function onSegmentClick(ch: Chapter, e: MouseEvent) {
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  if (!rect.width) {
    editor.jumpToChapter(ch);
    return;
  }
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const seekTime = ch.startTime + ratio * (ch.endTime - ch.startTime);
  editor.jumpToChapter(ch, seekTime);
}

let suppressTrackClickUntil = 0;

function onTrackClick(e: MouseEvent) {
  if (performance.now() < suppressTrackClickUntil) return;
  const target = e.target as HTMLElement;
  if (target.closest(".prog-seg")) return;
  editor.seekTrack(e);
}

function onTrackPointerUp(e: PointerEvent) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest(".prog-seg")) return;
  e.preventDefault();
  // pointerup already seeks; suppress the synthetic click that browsers emit after touch.
  suppressTrackClickUntil = performance.now() + 500;
  editor.seekTrack(e);
}
</script>
