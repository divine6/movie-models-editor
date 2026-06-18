<template>
  <div class="panel-center">
    <div
      :ref="editor.bindRef('viewportEl')"
      class="viewport"
      :class="{ 'viewport--interactive': editor.hasVideo }"
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
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <button
          class="viewport-preview-nav-btn viewport-preview-nav-btn--next"
          type="button"
          title="下一章"
          :disabled="!previewCanNext"
          @click="editor.nextCh()"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>

      <div
        v-if="editor.hasVideo"
        v-show="editor.showVideoPip"
        ref="pipGroupRef"
        class="pip-group"
        :class="{ 'is-dragging': pipDragging, 'is-resizing': pipResizing }"
        :style="pipStyle"
        @mousedown="onPipDragStart"
        @click.stop
      >
        <div class="video-pip">
          <video
            :ref="editor.bindRef('videoEl')"
            :src="editor.videoSrc"
            :muted="false"
            playsinline
            @loadedmetadata="editor.onMeta"
            @timeupdate="editor.onTick"
            @play="editor.onVideoPlay"
            @pause="editor.onVideoPause"
            @ended="editor.onVideoEnd"
            @error="editor.onVideoErr"
          />
          <button class="video-pip-del" type="button" @mousedown.stop @click="editor.removeVideo" title="移除视频">✕</button>
        </div>
        <div class="video-info-bar">
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
        <div class="pip-resize-handle" title="缩放" @mousedown.stop="onPipResizeStart" />
      </div>
    </div>

    <div v-if="editor.hasVideo" class="progress-area" :class="{ 'preview-progress': editor.isPreviewMode }">
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
            <el-icon>
              <VideoPause v-if="editor.isPlaying" />
              <VideoPlay v-else />
            </el-icon>
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
import { ArrowLeft, ArrowRight, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

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

function onViewportDblClick(e: MouseEvent) {
  if (!editor.hasVideo) return;
  if ((e.target as HTMLElement).closest(".pip-group, .viewport-play-hint, .viewport-preview-nav")) return;
  // 双击空白区域：播放/暂停（单击留给模型选中，避免冲突）
  if (editor.pickModelAtViewport(e.clientX, e.clientY)) return;
  editor.togglePlay();
}

const pipStyle = computed(() => ({
  left: `${pipLeft.value}px`,
  top: `${pipTop.value}px`,
  width: `${pipWidth.value}px`
}));

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

function placePipToRight(resetWidth = false) {
  const viewport = editor.viewportEl;
  if (!viewport) return;
  if (resetWidth) pipWidth.value = PIP_DEFAULT_WIDTH;
  pipLeft.value = Math.max(10, viewport.clientWidth - pipWidth.value - 10);
  pipTop.value = 10;
  requestAnimationFrame(clampPipBounds);
}

function placePipDefault() {
  placePipToRight(true);
}

function onPipDragStart(e: MouseEvent) {
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
  nextTick(() => {
    placePipDefault();
    const viewport = editor.viewportEl;
    if (viewport) {
      viewportObserver = new ResizeObserver(() => clampPipBounds());
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
    if (hasVideo) nextTick(placePipDefault);
  }
);

watch(
  () => editor.isPreviewMode,
  isPreview => {
    if (!isPreview || !editor.hasVideo) return;
    nextTick(() => {
      setTimeout(() => placePipToRight(), 120);
    });
  }
);
</script>
