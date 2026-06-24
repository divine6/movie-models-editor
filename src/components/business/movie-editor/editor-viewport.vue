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

      <editor-viewport-preview-nav v-if="editor.isPreviewMode && editor.sortedChapters.length > 1" />

      <editor-video-pip v-if="editor.hasVideo" />
    </div>

    <editor-progress-bar v-if="editor.hasVideo" />
  </div>
</template>

<script setup lang="ts" name="editor-viewport">
import { VideoPause, VideoPlay } from "@element-plus/icons-vue";

import EditorProgressBar from "@/components/business/movie-editor/editor-progress-bar.vue";
import EditorVideoPip from "@/components/business/movie-editor/editor-video-pip.vue";
import EditorViewportPreviewNav from "@/components/business/movie-editor/editor-viewport-preview-nav.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();

function onViewportDblClick(e: MouseEvent) {
  if (!editor.hasVideo || editor.isPreviewMode) return;
  if ((e.target as HTMLElement).closest(".pip-group, .viewport-play-hint, .viewport-preview-nav")) return;
  if (editor.pickModelAtViewport(e.clientX, e.clientY)) return;
  editor.togglePlay();
}
</script>
