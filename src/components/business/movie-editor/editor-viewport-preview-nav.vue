<template>
  <div class="viewport-preview-nav" @click.stop>
    <button
      class="viewport-preview-nav-btn viewport-preview-nav-btn--prev"
      type="button"
      title="上一章"
      :disabled="!canPrev"
      @click="editor.prevCh()"
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
      :disabled="!canNext"
      @click="editor.nextCh()"
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
  if (!editor.isPreviewMode || editor.sortedChapters.length <= 1) return false;
  return editor.currentChapterIdx !== 0;
});

const canNext = computed(() => {
  if (!editor.isPreviewMode || editor.sortedChapters.length <= 1) return false;
  const idx = editor.currentChapterIdx;
  if (idx < 0) return true;
  return idx < editor.sortedChapters.length - 1;
});
</script>
