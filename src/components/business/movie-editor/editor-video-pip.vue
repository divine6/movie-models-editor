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
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { useVideoPip } from "@/composables/movie-editor/useVideoPip";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { isCoarsePointerDevice } from "@/utils/device";

const editor = useMovieEditorContext();

const { pipGroupRef, pipStyle, pipDragging, pipResizing, onPipDragStart, onPipResizeStart } = useVideoPip({
  getViewportEl: () => editor.viewportEl,
  getViewOnly: () => editor.viewOnly,
  getIsPreviewMode: () => editor.isPreviewMode,
  getHasVideo: () => editor.hasVideo
});

const videoLoading = ref(false);
const isMobile = ref(false);

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

onMounted(() => {
  isMobile.value = isCoarsePointerDevice();
  nextTick(() => {
    ensureVideoPreload();
    syncVideoLoadingState();
  });
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
</script>
