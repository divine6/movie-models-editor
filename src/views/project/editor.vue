<template>
  <div
    class="movie-editor"
    :class="{ 'preview-mode': editor.isPreviewMode, 'view-only-route': editor.viewOnly }"
    :tabindex="editor.viewOnly ? -1 : 0"
    :ref="editor.bindRef('rootEl')"
    @keydown="editor.onKey"
  >
    <editor-header />

    <div class="editor-body">
      <!-- 左侧：节点列表 -->
      <aside v-if="editor.hasVideo" class="panel-left visible editor-body__chapters">
        <editor-chapter-list />
      </aside>

      <!-- 中间：Three.js 实时预览视口 -->
      <div class="editor-body__center">
        <editor-viewport />
      </div>

      <!-- 右侧：参数编辑面板 -->
      <div v-if="!editor.isPreviewMode" class="editor-body__right">
        <editor-config-panel />
      </div>
    </div>

    <editor-overlays />
  </div>

  <div v-if="editor.routeGateLoading" class="editor-route-gate">
    <el-icon class="is-loading" :size="32"><Loading /></el-icon>
    <span>加载中...</span>
  </div>
</template>

<script setup lang="ts" name="project-editor">
import { Loading } from "@element-plus/icons-vue";
import { provide as vueProvide } from "vue";

import EditorChapterList from "@/components/business/movie-editor/editor-chapter-list.vue";
import EditorConfigPanel from "@/components/business/movie-editor/editor-config-panel.vue";
import EditorHeader from "@/components/business/movie-editor/editor-header.vue";
import EditorOverlays from "@/components/business/movie-editor/editor-overlays.vue";
import EditorViewport from "@/components/business/movie-editor/editor-viewport.vue";
import { MOVIE_EDITOR_KEY, useMovieEditor } from "@/composables/useMovieEditor";
import { providePreviewChapterDrawer } from "@/composables/usePreviewChapterDrawer";

const editor = useMovieEditor();
vueProvide(MOVIE_EDITOR_KEY, editor);
providePreviewChapterDrawer();
</script>

<!-- 样式嵌套在 .movie-editor 下，不加 scoped 以便子组件继承 -->
<style lang="scss">
@use "@/components/business/movie-editor/editor-styles.scss";

.editor-route-gate {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #fff;
  color: var(--text-color-2);
  font-size: 14px;
}
</style>
