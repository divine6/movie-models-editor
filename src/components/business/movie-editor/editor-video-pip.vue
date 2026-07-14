<template>
  <div
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
    <div class="video-pip" :class="{ 'is-loading': videoLoading }" :style="videoPipBoxStyle">
      <video
        :ref="editor.bindRef('videoEl')"
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
      <button
        v-if="isMobile && !videoLoading"
        type="button"
        class="video-pip-play-hint"
        :class="{ 'is-playing': editor.isPlaying }"
        :title="editor.isPlaying ? '点击暂停' : '点击播放'"
        @mousedown.stop
        @click.stop="onPlayHintClick"
      >
        <el-icon v-if="!editor.isPlaying"><VideoPlay /></el-icon>
      </button>
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
</template>

<script setup lang="ts" name="editor-video-pip">
import { Loading, VideoPlay } from "@element-plus/icons-vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useVideoPip } from "@/composables/movie-editor/useVideoPip";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { isCoarsePointerDevice } from "@/utils/device";

const editor = useMovieEditorContext();

const { pipGroupRef, pipStyle, pipDragging, pipResizing, placePipToRight, onPipDragStart, onPipResizeStart } =
  useVideoPip({
  getViewportEl: () => editor.viewportEl,
  getViewOnly: () => editor.viewOnly,
  getIsPreviewMode: () => editor.isPreviewMode,
  getHasVideo: () => editor.hasVideo,
  getVideoDisplayWidth: () => editor.activeVideoNode?.videoDisplayWidth || 0,
  getVideoDisplayWidthRatio: () => editor.activeVideoNode?.videoDisplayWidthRatio,
  getVideoDisplayLeft: () => editor.activeVideoNode?.videoDisplayLeft,
  getVideoDisplayTop: () => editor.activeVideoNode?.videoDisplayTop,
  getVideoDisplayXRatio: () => editor.activeVideoNode?.videoDisplayXRatio,
  getVideoDisplayYRatio: () => editor.activeVideoNode?.videoDisplayYRatio,
  setVideoDisplayWidth: width => {
    if (editor.activeVideoNode) editor.activeVideoNode.videoDisplayWidth = width;
  },
  setVideoDisplayWidthRatio: ratio => {
    if (editor.activeVideoNode) editor.activeVideoNode.videoDisplayWidthRatio = ratio;
  },
  setVideoDisplayPosition: (left, top) => {
    if (!editor.activeVideoNode) return;
    editor.activeVideoNode.videoDisplayLeft = left;
    editor.activeVideoNode.videoDisplayTop = top;
  },
  setVideoDisplayPositionRatio: (xRatio, yRatio) => {
    if (!editor.activeVideoNode) return;
    editor.activeVideoNode.videoDisplayXRatio = xRatio;
    editor.activeVideoNode.videoDisplayYRatio = yRatio;
  }
});

const videoLoading = ref(false);
const isMobile = ref(false);
let loadingTimer: ReturnType<typeof setTimeout> | null = null;
let pipApplyTimer: ReturnType<typeof setTimeout> | null = null;

function clearLoadingTimer() {
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
}

function clearPipApplyTimer() {
  if (pipApplyTimer) {
    clearTimeout(pipApplyTimer);
    pipApplyTimer = null;
  }
}

function applyStoredPipLayout() {
  nextTick(() => {
    placePipToRight(true, true);
    requestAnimationFrame(() => placePipToRight(true, true));
    clearPipApplyTimer();
    pipApplyTimer = setTimeout(() => placePipToRight(true, true), 120);
  });
}

function resolveVideoDimensions() {
  const w = editor.videoWidth || editor.videoEl?.videoWidth || 0;
  const h = editor.videoHeight || editor.videoEl?.videoHeight || 0;
  return { w, h };
}

/** 加载占位与视频实际显示区域使用相同宽高比 */
const videoPipBoxStyle = computed(() => {
  const { w, h } = resolveVideoDimensions();
  if (w > 0 && h > 0) {
    if (videoLoading.value) {
      return { aspectRatio: `${w} / ${h}` };
    }
    return undefined;
  }
  if (videoLoading.value || (isMobile.value && !editor.isPlaying)) {
    return { aspectRatio: "16 / 9" };
  }
  return undefined;
});

function onPlayHintClick() {
  editor.togglePlay();
}

function startLoadingIndicator() {
  videoLoading.value = true;
  clearLoadingTimer();
  loadingTimer = setTimeout(() => {
    videoLoading.value = false;
  }, 12000);
}

function onVideoLoadStart() {
  startLoadingIndicator();
}

function onVideoLoaded() {
  clearLoadingTimer();
  videoLoading.value = false;
}

function onVideoLoadedMetadata(e: Event) {
  editor.onMeta(e);
  onVideoLoaded();
  if (editor.showVideoPip) {
    applyStoredPipLayout();
  }
}

function onVideoLoadError() {
  clearLoadingTimer();
  videoLoading.value = false;
  editor.onVideoErr();
}

function onVideoWaiting() {
  if (!editor.isPlaying && !editor.viewOnly && !editor.isPreviewMode) return;
  startLoadingIndicator();
}

function syncVideoLoadingState() {
  if (!editor.hasVideo || !editor.videoSrc) {
    clearLoadingTimer();
    videoLoading.value = false;
    return;
  }
  const video = editor.videoEl;
  if (!video || video.error) {
    clearLoadingTimer();
    videoLoading.value = false;
    return;
  }
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    clearLoadingTimer();
    videoLoading.value = false;
    return;
  }
  startLoadingIndicator();
}

onMounted(() => {
  isMobile.value = isCoarsePointerDevice();
  nextTick(syncVideoLoadingState);
});

onBeforeUnmount(() => {
  clearLoadingTimer();
  clearPipApplyTimer();
});

watch(
  () => editor.hasVideo,
  hasVideo => {
    if (!hasVideo) {
      clearLoadingTimer();
      videoLoading.value = false;
      return;
    }
    nextTick(syncVideoLoadingState);
  }
);

watch(
  () => editor.videoSrc,
  src => {
    if (!src) {
      clearLoadingTimer();
      videoLoading.value = false;
      return;
    }
    nextTick(syncVideoLoadingState);
  }
);

watch(
  () => editor.activeVideoId,
  () => {
    if (!editor.showVideoPip) return;
    applyStoredPipLayout();
  }
);

watch(
  () => editor.showVideoPip,
  visible => {
    if (!visible) return;
    applyStoredPipLayout();
  }
);

watch(
  () => editor.selectedNodeId,
  () => {
    if (!editor.showVideoPip || !editor.hasVideo) return;
    applyStoredPipLayout();
  }
);
</script>
