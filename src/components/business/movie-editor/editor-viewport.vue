<template>
  <div class="panel-center">
    <div
      :ref="editor.bindRef('viewportEl')"
      class="viewport"
      :class="{ 'viewport--interactive': editor.isPreviewMode && editor.hasVideo }"
      @dblclick="onViewportDblClick"
    >
      <div :ref="editor.bindRef('subEl')" class="viewport-subtitle" v-show="editor.displaySubtitle" />
      <canvas :ref="editor.bindRef('canvasEl')" class="view-canvas" />

      <div
        v-if="editor.hasVideo && editor.playbackHintVisible"
        class="viewport-play-hint"
        :class="{ 'is-fading': editor.playbackHintFading }"
      >
        <el-icon class="viewport-play-hint-icon" title="点击播放/暂停" @click.stop="editor.togglePlay">
          <VideoPause v-if="editor.isPlaying" />
          <VideoPlay v-else />
        </el-icon>
      </div>

      <div v-if="editor.modelIntroLabels.length" class="model-intro-layer">
        <div
          v-for="label in editor.modelIntroLabels"
          :key="label.modelId"
          class="model-intro-popup"
          :style="{ left: `${label.x}px`, top: `${label.y}px` }"
        >
          {{ label.text }}
        </div>
      </div>

      <div v-if="editor.isPreviewMode && editor.sortedChapters.length > 1" class="viewport-preview-nav" @click.stop>
        <button
          class="viewport-preview-nav-btn viewport-preview-nav-btn--prev"
          type="button"
          title="上一章"
          :disabled="!previewCanPrev"
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
          :disabled="!previewCanNext"
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

      <div
        v-if="editor.hasVideo"
        v-show="editor.showVideoPip"
        ref="pipGroupRef"
        class="pip-group"
        :class="{
          'is-dragging': pipDragging,
          'is-resizing': pipResizing,
          'pip-group--view-fixed': editor.viewOnly,
          'pip-group--preview': editor.isPreviewMode
        }"
        :style="pipStyle"
        @mousedown="onPipDragStart"
      >
        <div class="video-pip" :class="{ 'is-loading': videoLoading }">
          <video
            :ref="editor.bindRef('videoEl')"
            :src="editor.videoSrc"
            :muted="false"
            preload="metadata"
            playsinline
            @loadstart="onVideoLoadStart"
            @loadedmetadata="onVideoLoadedMetadata"
            @loadeddata="onVideoLoaded"
            @canplay="onVideoLoaded"
            @timeupdate="editor.onTick"
            @play="editor.onVideoPlay"
            @waiting="onVideoWaiting"
            @playing="onVideoLoaded"
            @pause="editor.onVideoPause"
            @ended="editor.onVideoEnd"
            @error="onVideoLoadError"
          />
          <div v-if="isMobile && !editor.isPlaying" class="video-pip-play-hint" aria-hidden="true">
            <el-icon><VideoPlay /></el-icon>
          </div>
          <div v-if="videoLoading" class="video-pip-loading" aria-live="polite" aria-busy="true">
            <el-icon class="is-loading video-pip-loading__icon"><Loading /></el-icon>
          </div>
          <button
            v-if="!editor.viewOnly"
            class="video-pip-del"
            type="button"
            @mousedown.stop
            @click="editor.removeVideo"
            title="移除视频"
          >
            ✕
          </button>
        </div>
        <div v-if="!editor.viewOnly" class="video-info-bar">
          <span class="vi-item">
            <span class="vi-label">{{ $t("OpWeb.Editor.Duration", "时长") }}</span>
            <span class="vi-value">{{ editor.fmt(editor.duration) }}</span>
          </span>
          <span class="vi-divider" />
          <span v-if="editor.videoWidth" class="vi-item">
            <span class="vi-label">{{ editor.videoWidth }}×{{ editor.videoHeight }}</span>
          </span>
          <span v-if="editor.videoWidth" class="vi-divider" />
          <span v-if="editor.videoFps" class="vi-item">
            <span class="vi-value">{{ editor.videoFps }}fps</span>
          </span>
        </div>
        <div v-if="!editor.viewOnly" class="pip-resize-handle" title="缩放" @mousedown.stop="onPipResizeStart" />
      </div>
    </div>

    <div v-if="editor.hasVideo" class="progress-area" :class="{ 'preview-progress': editor.isPreviewMode }" @click.stop>
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
  </div>
</template>

<script setup lang="ts" name="editor-viewport">
import { Loading, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { isCoarsePointerDevice } from "@/utils/device";

const editor = useMovieEditorContext();

const activeChapterLabel = computed(() => {
  const idx = editor.currentChapterIdx;
  if (idx >= 0) return editor.sortedChapters[idx]?.name ?? "";
  return editor.sortedChapters[0]?.name ?? "";
});

const previewCanPrev = computed(() => {
  if (!editor.isPreviewMode || editor.sortedChapters.length <= 1) return false;
  return editor.currentChapterIdx !== 0;
});

const previewCanNext = computed(() => {
  if (!editor.isPreviewMode || editor.sortedChapters.length <= 1) return false;
  const idx = editor.currentChapterIdx;
  if (idx < 0) return true;
  return idx < editor.sortedChapters.length - 1;
});

const PIP_DEFAULT_WIDTH = 200;
const PIP_MIN_WIDTH = 140;
const PIP_MAX_WIDTH_RATIO = 0.75;

const pipGroupRef = ref<HTMLElement | null>(null);
const pipWidth = ref(PIP_DEFAULT_WIDTH);
const pipLeft = ref(10);
const pipTop = ref(10);
const pipDragging = ref(false);
const pipResizing = ref(false);
const videoLoading = ref(false);
const isMobile = ref(false);

function onVideoLoadStart() {
  if (isMobile.value) return;
  videoLoading.value = true;
}

function onVideoLoaded() {
  videoLoading.value = false;
}

function onVideoLoadedMetadata(e: Event) {
  editor.onMeta(e);
  onVideoLoaded();
}

function onVideoLoadError() {
  videoLoading.value = false;
  editor.onVideoErr();
}

function onVideoWaiting() {
  if (isMobile.value && !editor.isPlaying) return;
  videoLoading.value = true;
}

function syncVideoLoadingState() {
  if (!editor.hasVideo || !editor.videoSrc || isMobile.value) {
    videoLoading.value = false;
    return;
  }
  const video = editor.videoEl;
  videoLoading.value = !video || video.readyState < HTMLMediaElement.HAVE_METADATA;
}

function ensureVideoPreload() {
  if (isMobile.value) return;
  const video = editor.videoEl;
  if (!video || !editor.videoSrc) return;
  video.preload = "metadata";
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) video.load();
}

function onViewportDblClick(e: MouseEvent) {
  if (!editor.hasVideo || editor.isPreviewMode) return;
  if ((e.target as HTMLElement).closest(".pip-group, .viewport-play-hint, .viewport-preview-nav")) return;
  // 双击空白区域：播放/暂停（单击留给模型选中，避免冲突）
  if (editor.pickModelAtViewport(e.clientX, e.clientY)) return;
  editor.togglePlay();
}

const pipPresentationMode = computed(() => editor.viewOnly || editor.isPreviewMode);

const pipStyle = computed(() => {
  const style: Record<string, string> = { width: `${pipWidth.value}px` };
  if (!pipPresentationMode.value) {
    style.left = `${pipLeft.value}px`;
    style.top = `${pipTop.value}px`;
  }
  return style;
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampPipBounds() {
  const viewport = editor.viewportEl;
  const group = pipGroupRef.value;
  if (!viewport || !group) return;

  const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);
  pipWidth.value = clamp(pipWidth.value, PIP_MIN_WIDTH, maxWidth);

  const maxLeft = Math.max(0, viewport.clientWidth - pipWidth.value);
  const maxTop = Math.max(0, viewport.clientHeight - group.offsetHeight);
  pipLeft.value = clamp(pipLeft.value, 0, maxLeft);
  pipTop.value = clamp(pipTop.value, 0, maxTop);
}

function resolvePipWidth(viewportWidth: number, presentation: boolean) {
  if (presentation) {
    if (viewportWidth <= 480) return Math.min(200, Math.max(148, Math.round(viewportWidth * 0.42)));
    if (viewportWidth <= 768) return Math.min(220, Math.max(168, Math.round(viewportWidth * 0.38)));
    return Math.min(150, Math.max(120, Math.round(viewportWidth * 0.11)));
  }
  if (viewportWidth <= 640) return 160;
  return PIP_DEFAULT_WIDTH;
}

function placePipToRight(resetWidth = false) {
  const viewport = editor.viewportEl;
  if (!viewport) return;
  const presentation = editor.viewOnly || editor.isPreviewMode;
  if (resetWidth) pipWidth.value = resolvePipWidth(viewport.clientWidth, presentation);
  if (!presentation) {
    const inset = resolvePipInset(viewport.clientWidth);
    pipLeft.value = Math.max(inset.right, viewport.clientWidth - pipWidth.value - inset.right);
    pipTop.value = inset.top;
    requestAnimationFrame(clampPipBounds);
  }
}

function resolvePipInset(viewportWidth: number) {
  return { top: 10, right: 10 };
}

function placePipDefault() {
  placePipToRight(true);
}

function onPipDragStart(e: MouseEvent) {
  if (editor.viewOnly) return;
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest(".video-pip-del, .pip-resize-handle")) return;

  const viewport = editor.viewportEl;
  const group = pipGroupRef.value;
  if (!viewport || !group) return;

  e.preventDefault();
  pipDragging.value = true;

  const startX = e.clientX;
  const startY = e.clientY;
  const originLeft = pipLeft.value;
  const originTop = pipTop.value;
  const maxLeft = viewport.clientWidth - pipWidth.value;
  const maxTop = viewport.clientHeight - group.offsetHeight;

  const onMove = (ev: MouseEvent) => {
    pipLeft.value = clamp(originLeft + ev.clientX - startX, 0, maxLeft);
    pipTop.value = clamp(originTop + ev.clientY - startY, 0, maxTop);
  };

  const onUp = () => {
    pipDragging.value = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  };

  document.body.style.userSelect = "none";
  document.body.style.cursor = "move";
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

function onPipResizeStart(e: MouseEvent) {
  if (editor.viewOnly) return;
  if (e.button !== 0) return;

  const viewport = editor.viewportEl;
  if (!viewport) return;

  e.preventDefault();
  pipResizing.value = true;

  const startX = e.clientX;
  const originLeft = pipLeft.value;
  const originWidth = pipWidth.value;
  const originRight = originLeft + originWidth;
  const maxWidth = Math.max(PIP_MIN_WIDTH, viewport.clientWidth * PIP_MAX_WIDTH_RATIO);

  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX;
    const newLeft = clamp(originLeft + dx, 0, originRight - PIP_MIN_WIDTH);
    const newWidth = clamp(originRight - newLeft, PIP_MIN_WIDTH, maxWidth);
    pipWidth.value = newWidth;
    pipLeft.value = originRight - newWidth;
  };

  const onUp = () => {
    pipResizing.value = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  };

  document.body.style.userSelect = "none";
  document.body.style.cursor = "nesw-resize";
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

let viewportObserver: ResizeObserver | null = null;

onMounted(() => {
  isMobile.value = isCoarsePointerDevice();
  nextTick(() => {
    ensureVideoPreload();
    syncVideoLoadingState();
    placePipToRight(editor.viewOnly || editor.isPreviewMode);
    const viewport = editor.viewportEl;
    if (viewport) {
      viewportObserver = new ResizeObserver(() => {
        if (editor.viewOnly || editor.isPreviewMode) placePipToRight();
        else clampPipBounds();
      });
      viewportObserver.observe(viewport);
    }
  });
});

onUnmounted(() => {
  viewportObserver?.disconnect();
});

watch(
  () => editor.hasVideo,
  hasVideo => {
    if (!hasVideo) {
      videoLoading.value = false;
      return;
    }
    nextTick(() => {
      ensureVideoPreload();
      syncVideoLoadingState();
      placePipToRight(editor.viewOnly || editor.isPreviewMode);
    });
  }
);

watch(
  () => editor.videoSrc,
  src => {
    if (!src) {
      videoLoading.value = false;
      return;
    }
    nextTick(syncVideoLoadingState);
  }
);

watch(
  () => editor.isPreviewMode,
  isPreview => {
    if (!isPreview || !editor.hasVideo) return;
    nextTick(() => {
      setTimeout(() => placePipToRight(true), 120);
    });
  }
);

watch(
  () => editor.viewOnly,
  viewOnly => {
    if (!viewOnly || !editor.hasVideo) return;
    nextTick(() => placePipToRight(true));
  }
);
</script>
