<template>
  <div class="progress-area" :class="{ 'preview-progress': editor.isPreviewMode }" @click.stop>
    <div :ref="editor.bindRef('trackEl')" class="progress-track progress-track--chapters" @click="editor.seekTrack">
      <div class="prog-segs">
        <div
          v-for="(ch, i) in editor.timelineChapters"
          :key="ch.id"
          class="prog-seg-wrap"
          :style="{ flex: `${editor.chapterSegmentFlex(ch)} 1 0%` }"
        >
          <el-tooltip :content="ch.name" placement="top" :show-after="200">
            <div
              class="prog-seg"
              :class="{ 'is-current': editor.currentChapterIdx === i }"
              @click.stop="editor.jumpToChapter(ch)"
            >
              <div class="prog-seg-fill" :style="{ transform: `scaleX(${editor.fillScale(i)})` }" />
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="prog-playhead" :style="{ left: `${editor.pct(editor.currentTime)}%` }" />
    </div>
    <div class="progress-meta">
      <div class="progress-meta-left">
        <button class="progress-ctrl-btn" type="button" :title="editor.isPlaying ? '暂停' : '播放'" @click="editor.togglePlay">
          <svg
            v-if="editor.isPlaying"
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
          <span class="progress-time-current">{{ editor.fmt(editor.currentTime) }}</span>
          <span class="progress-time-sep">/</span>
          <span class="progress-time-total">{{ editor.fmt(editor.duration) }}</span>
        </div>
      </div>
      <div v-if="activeChapterLabel" class="progress-chapter">{{ activeChapterLabel }}</div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-progress-bar">
import { computed } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();

const activeChapterLabel = computed(() => {
  const idx = editor.currentChapterIdx;
  if (idx >= 0) return editor.sortedChapters[idx]?.name ?? "";
  return editor.sortedChapters[0]?.name ?? "";
});
</script>
