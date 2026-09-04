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
        :muted="editor.videoIsMuted"
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
        @seeked="editor.onVideoSeeked"
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
        v-if="!editor.viewOnly && !editor.isPreviewMode"
        class="video-pip-del"
        type="button"
        @mousedown.stop
        @click="editor.removeVideo"
        title="移除视频"
      >
        ✕
      </button>
    </div>
    <div v-if="!editor.viewOnly && !editor.isPreviewMode" class="video-info-bar">
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
    <div
      v-if="!editor.viewOnly && !editor.isPreviewMode"
      class="pip-resize-handle"
      title="缩放"
      @mousedown.stop="onPipResizeStart"
    />
  </div>
</template>

<script setup lang="ts" name="editor-video-pip">
import { Loading, VideoPlay } from "@element-plus/icons-vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useVideoPip } from "@/composables/movie-editor/useVideoPip";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import type { SceneAnimationNode } from "@/interface/project";
import { isCoarsePointerDevice } from "@/utils/device";

const editor = useMovieEditorContext();

/** 当前应读写视频框布局的动画（编辑选中 / 预览播放中的动画） */
function resolvePipLayoutAnimation(): SceneAnimationNode | null {
  const id =
    (typeof editor.getActiveChapterIdForUi === "function" ? editor.getActiveChapterIdForUi() : null) ||
    editor.selectedChapterId ||
    null;
  if (!id) return null;
  const ch = editor.chapters?.find((c: SceneAnimationNode) => c.id === id);
  return ch && ch.type === "animation" ? ch : null;
}

const { pipGroupRef, pipStyle, pipDragging, pipResizing, placePipToRight, onPipDragStart, onPipResizeStart } =
  useVideoPip({
  getViewportEl: () => editor.viewportEl,
  getViewOnly: () => editor.viewOnly,
  getIsPreviewMode: () => editor.isPreviewMode,
  getHasVideo: () => editor.hasVideo,
  getActiveAnimationId: () =>
    (typeof editor.getActiveChapterIdForUi === "function" ? editor.getActiveChapterIdForUi() : null) ||
    editor.selectedChapterId ||
    null,
  getVideoDisplayWidth: () => resolvePipLayoutAnimation()?.videoDisplayWidth || 0,
  getVideoDisplayWidthRatio: () => resolvePipLayoutAnimation()?.videoDisplayWidthRatio,
  getVideoDisplayLeft: () => resolvePipLayoutAnimation()?.videoDisplayLeft,
  getVideoDisplayTop: () => resolvePipLayoutAnimation()?.videoDisplayTop,
  getVideoDisplayXRatio: () => resolvePipLayoutAnimation()?.videoDisplayXRatio,
  getVideoDisplayYRatio: () => resolvePipLayoutAnimation()?.videoDisplayYRatio,
  getVideoDisplayViewportWidth: () => resolvePipLayoutAnimation()?.videoDisplayViewportWidth,
  getVideoDisplayViewportHeight: () => resolvePipLayoutAnimation()?.videoDisplayViewportHeight,
  setVideoDisplayWidth: width => {
    const anim = resolvePipLayoutAnimation();
    if (anim) anim.videoDisplayWidth = width;
  },
  setVideoDisplayWidthRatio: ratio => {
    const anim = resolvePipLayoutAnimation();
    if (anim) anim.videoDisplayWidthRatio = ratio;
  },
  setVideoDisplayPosition: (left, top) => {
    const anim = resolvePipLayoutAnimation();
    if (!anim) return;
    anim.videoDisplayLeft = left;
    anim.videoDisplayTop = top;
  },
  setVideoDisplayPositionRatio: (xRatio, yRatio) => {
    const anim = resolvePipLayoutAnimation();
    if (!anim) return;
    anim.videoDisplayXRatio = xRatio;
    anim.videoDisplayYRatio = yRatio;
  },
  setVideoDisplayViewportSize: (width, height) => {
    const anim = resolvePipLayoutAnimation();
    if (!anim) return;
    anim.videoDisplayViewportWidth = width;
    anim.videoDisplayViewportHeight = height;
  }
});

const videoLoading = ref(false);
const isMobile = ref(false);
let loadingTimer: ReturnType<typeof setTimeout> | null = null;

function clearLoadingTimer() {
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
}

function applyStoredPipLayout() {
  // 立即按已存位置落位，避免先闪默认位再跳到正确位
  placePipToRight(true, true);
  nextTick(() => {
    placePipToRight(true, true);
    requestAnimationFrame(() => placePipToRight(true, true));
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
  // 展示/预览：只有 syncVideoElementSrc 真正换源时才出加载遮罩（避免切章/seek 被当成刷新）。
  if (editor.viewOnly || editor.isPreviewMode) {
    const video = editor.videoEl;
    if (!video || video.dataset.editorReloading !== "1") return;
  }
  startLoadingIndicator();
}

function onVideoLoaded() {
  const video = editor.videoEl;
  if (video) delete video.dataset.editorReloading;
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
  // 展示页切章/拖进度条会频繁 waiting：遮罩会被当成「视频又刷新了」
  if (editor.viewOnly || editor.isPreviewMode) return;
  if (!editor.isPlaying) return;
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
  () => [
    editor.selectedChapterId,
    editor.selectedNodeId,
    typeof editor.getActiveChapterIdForUi === "function" ? editor.getActiveChapterIdForUi() : null
  ],
  (curr, prev) => {
    if (!editor.showVideoPip || !editor.hasVideo) return;
    const currId = curr?.[2] ?? curr?.[0] ?? null;
    const prevId = prev?.[2] ?? prev?.[0] ?? null;
    // 切换动画时按该动画的视频框设置落位；同源未切动画不重复跳
    if (currId && currId === prevId && curr?.[1] === prev?.[1]) return;
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
  () => editor.isPreviewMode,
  () => {
    if (!editor.showVideoPip || !editor.hasVideo) return;
    applyStoredPipLayout();
  }
);
</script>
