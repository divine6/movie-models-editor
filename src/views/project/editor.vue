<template>
  <div
    class="movie-editor"
    :class="{ 'preview-mode': editor.isPreviewMode }"
    tabindex="0"
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
</template>

<script setup lang="ts" name="project-editor">
import { provide } from "vue";

import EditorChapterList from "@/components/business/movie-editor/editor-chapter-list.vue";
import EditorConfigPanel from "@/components/business/movie-editor/editor-config-panel.vue";
import EditorHeader from "@/components/business/movie-editor/editor-header.vue";
import EditorOverlays from "@/components/business/movie-editor/editor-overlays.vue";
import EditorViewport from "@/components/business/movie-editor/editor-viewport.vue";
import { MOVIE_EDITOR_KEY, useMovieEditor } from "@/composables/useMovieEditor";

const editor = useMovieEditor();
provide(MOVIE_EDITOR_KEY, editor);
</script>

<!-- 样式嵌套在 .movie-editor 下，不加 scoped 以便子组件继承 -->
<style lang="scss">
@use "@/components/business/movie-editor/editor-styles.scss";
</style>
