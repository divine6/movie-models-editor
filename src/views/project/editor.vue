<template>
  <div
    class="movie-editor editor-dark-theme"
    :class="{
      'preview-mode': editor.isPreviewMode,
      'view-only-route': editor.viewOnly,
      'is-initializing': editor.editorInitializing
    }"
    :tabindex="editor.viewOnly ? -1 : 0"
    :inert="editor.editorInitializing"
    :ref="editor.bindRef('rootEl')"
    @keydown="editor.onKey"
  >
    <editor-header />

    <div class="editor-body">
      <!-- 左侧：节点列表 -->
      <aside v-if="editor.showNodePanel" class="panel-left visible editor-body__chapters">
        <editor-chapter-list />
      </aside>

      <!-- 中间：Three.js 实时预览视口 -->
      <div class="editor-body__center">
        <editor-viewport />
      </div>

      <!-- 右侧：参数编辑面板 -->
      <div v-if="!editor.isPreviewMode && editor.nodes.length > 0" class="editor-body__right">
        <editor-config-panel />
      </div>
    </div>

    <editor-overlays />
  </div>

  <Teleport to="body">
    <div
      v-if="editor.editorInitializing"
      class="editor-boot-gate"
      data-testid="editor-boot-loading"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      :aria-label="bootLoadingText"
    >
      <el-icon class="is-loading editor-boot-gate__icon" :size="36"><Loading /></el-icon>
      <span class="editor-boot-gate__text">{{ bootLoadingText }}</span>
      <span v-if="bootLoadingHint" class="editor-boot-gate__hint">{{ bootLoadingHint }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts" name="project-editor">
import { Loading } from "@element-plus/icons-vue";
import { computed, provide as vueProvide, watchEffect } from "vue";

import EditorChapterList from "@/components/business/movie-editor/editor-chapter-list.vue";
import EditorConfigPanel from "@/components/business/movie-editor/editor-config-panel.vue";
import EditorHeader from "@/components/business/movie-editor/editor-header.vue";
import EditorOverlays from "@/components/business/movie-editor/editor-overlays.vue";
import EditorViewport from "@/components/business/movie-editor/editor-viewport.vue";
import { MOVIE_EDITOR_KEY, useMovieEditor } from "@/composables/useMovieEditor";
import { providePreviewChapterDrawer } from "@/composables/usePreviewChapterDrawer";

const editor = useMovieEditor();
const bootLoadingText = computed(() => (editor.viewOnly ? "加载中......" : "正在初始化编辑器..."));
const bootLoadingHint = computed(() => (editor.viewOnly ? "" : "场景、模型与视口就绪后可操作"));
vueProvide(MOVIE_EDITOR_KEY, editor);
providePreviewChapterDrawer();

if (import.meta.env.DEV) {
  watchEffect(() => {
    (window as any).__movieEditorTest = {
      videoOnlyMode: editor.videoOnlyMode,
      selectedNodeId: editor.selectedNodeId,
      selectedChapterId: editor.selectedChapterId,
      activeVideoId: editor.activeVideoId,
      hasVideo: editor.hasVideo,
      nodes: JSON.parse(JSON.stringify(editor.nodes ?? [])),
      chapterSubtitles: JSON.parse(JSON.stringify(editor.chapterSubtitles ?? [])),
      sceneCode: editor.sceneCode,
      isPreviewMode: editor.isPreviewMode,
      editorInitializing: editor.editorInitializing,
      loadSceneForEdit: (code: string) => editor.loadSceneForEdit(code),
      openChapterDrawer: () => {
        const btn = document.querySelector(".editor-header [data-testid='open-chapter-drawer']") as HTMLElement | null;
        btn?.click();
      }
    };
  });
}
</script>

<!-- 样式嵌套在 .movie-editor 下，不加 scoped 以便子组件继承 -->
<style lang="scss">
@use "@/components/business/movie-editor/styles/index.scss";

.movie-editor.is-initializing {
  pointer-events: none;
  user-select: none;
}

.editor-boot-gate {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgb(10 11 13 / 92%);
  color: rgb(255 255 255 / 88%);
  font-size: 14px;
  pointer-events: auto;
  backdrop-filter: blur(4px);

  &__icon {
    margin-bottom: 4px;
  }

  &__text {
    font-size: 15px;
    font-weight: 500;
  }

  &__hint {
    font-size: 12px;
    color: rgb(255 255 255 / 48%);
  }
}
</style>
