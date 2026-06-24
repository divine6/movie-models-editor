<template>
  <div class="chapter-preview-panel">
    <div class="chapter-preview-drawer-head">
      <span class="chapter-preview-drawer-title">{{ $t("OpWeb.Editor.Chapters", "节点") }}</span>
      <button type="button" class="chapter-preview-drawer-close" :title="$t('OpWeb.Common.Close', '关闭')" @click="emit('close')">
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <div class="chapter-panel-list">
      <div class="chapter-list chapter-list--preview-drawer" :class="{ 'is-empty': editor.chapters.length === 0 }">
        <div
          v-for="item in editor.chapterTreeList"
          :key="item.chapter.id"
          class="ch-item"
          :class="{
            'ch-item--root': item.depth === 0,
            'ch-item--child': item.depth > 0,
            active: editor.selectedChapterId === item.chapter.id,
            playing: editor.isChapterPlaying(item.chapter)
          }"
          @click="emit('select', item.chapter)"
        >
          <el-icon v-if="item.depth === 0" class="ch-item-icon">
            <VideoCamera v-if="editor.isChapterPlaying(item.chapter)" />
            <Compass v-else />
          </el-icon>
          <span class="ch-body">
            <span class="ch-name">{{ item.chapter.name }}</span>
          </span>
        </div>
        <div v-if="editor.chapters.length === 0" class="chapter-list-empty chapter-list-empty--preview">
          <span>{{ $t("OpWeb.Editor.NoChapters", "暂无节点") }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-chapter-preview-drawer">
import { Close, Compass, VideoCamera } from "@element-plus/icons-vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";
import type { Chapter } from "@/interface/project";

const editor = useMovieEditorContext();
const $t = useTranslate();

const emit = defineEmits<{
  close: [];
  select: [chapter: Chapter];
}>();
</script>
