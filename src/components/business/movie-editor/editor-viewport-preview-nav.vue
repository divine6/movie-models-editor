<template>
  <div class="viewport-preview-nav">
    <button
      class="viewport-preview-nav-btn viewport-preview-nav-btn--prev"
      type="button"
      title="上一章"
      :class="{ 'is-disabled': !canPrev }"
      :aria-disabled="!canPrev"
      @pointerdown.capture="onPrevPointerDown"
      @click.capture="onPrevClick"
    >
      <svg
        class="viewport-preview-nav-btn__icon"
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        role="img"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M8.53 1.47a.75.75 0 0 0-1.06 0l-4 4a.75.75 0 0 0 0 1.06l4 4a.75.75 0 0 0 1.06-1.06L5.06 6l3.47-3.47a.75.75 0 0 0 0-1.06"
        />
      </svg>
    </button>
    <button
      class="viewport-preview-nav-btn viewport-preview-nav-btn--next"
      type="button"
      title="下一章"
      :class="{ 'is-disabled': !canNext }"
      :aria-disabled="!canNext"
      @pointerdown.capture="onNextPointerDown"
      @click.capture="onNextClick"
    >
      <svg
        class="viewport-preview-nav-btn__icon"
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        role="img"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M3.47 1.47a.75.75 0 0 1 1.06 0l4 4a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 0 1-1.06-1.06L6.94 6 3.47 2.53a.75.75 0 0 1 0-1.06"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts" name="editor-viewport-preview-nav">
import { computed } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();

const canPrev = computed(() => {
  if (!editor.isPreviewMode && !editor.viewOnly) return false;
  void editor.currentTime;
  void editor.isPlaying;
  void editor.presentationUiChapterId;
  void editor.presentationNavIndex;
  void editor.presentationTimelineChapterIdx;
  void editor.presentationPlaybackSession?.navChapterId;
  void editor.presentationPlaybackSession?.requestId;
  void editor.presentationDisplayTime;
  return editor.canPresentationPrevChapter();
});

const canNext = computed(() => {
  if (!editor.isPreviewMode && !editor.viewOnly) return false;
  void editor.currentTime;
  void editor.isPlaying;
  void editor.presentationUiChapterId;
  void editor.presentationNavIndex;
  void editor.presentationTimelineChapterIdx;
  void editor.presentationPlaybackSession?.navChapterId;
  void editor.presentationPlaybackSession?.requestId;
  void editor.presentationDisplayTime;
  return editor.canPresentationNextChapter();
});

let lastNavAt = 0;
/** 触控已在 pointerdown 处理时，吞掉后续合成 click，防止连跳 */
let ignoreClickUntil = 0;

function fireNav(direction: "prev" | "next") {
  const allowed = direction === "prev" ? canPrev.value : canNext.value;
  if (!allowed) return;
  const now = performance.now();
  if (now - lastNavAt < 160) return;
  lastNavAt = now;
  if (direction === "prev") editor.prevCh();
  else editor.nextCh();
}

function onPrevPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  // 手机/触控：在 pointerdown 立即导航（不要先设 ignore 再调会自检 ignore 的函数）
  if (e.pointerType === "mouse") return;
  e.preventDefault();
  e.stopPropagation();
  ignoreClickUntil = performance.now() + 500;
  fireNav("prev");
}

function onNextPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === "mouse") return;
  if (e.pointerType === "mouse") return;
  e.preventDefault();
  e.stopPropagation();
  ignoreClickUntil = performance.now() + 500;
  fireNav("next");
}

function onPrevClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (performance.now() < ignoreClickUntil) return;
  fireNav("prev");
}

function onNextClick(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (performance.now() < ignoreClickUntil) return;
  fireNav("next");
}
</script>
