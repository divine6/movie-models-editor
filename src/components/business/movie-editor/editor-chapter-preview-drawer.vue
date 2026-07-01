<template>
  <div class="chapter-preview-panel">
    <div class="chapter-preview-drawer-head">
      <span class="chapter-preview-drawer-title">{{ $t("OpWeb.Editor.ChapterList", "节点列表") }}</span>
      <button type="button" class="chapter-preview-drawer-close" :title="$t('OpWeb.Common.Close', '关闭')" @click="emit('close')">
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <div class="chapter-panel-list">
      <div class="chapter-list chapter-list--preview-drawer" :class="{ 'is-empty': rootChapters.length === 0 }">
        <div v-for="root in rootChapters" :key="root.id" class="chapter-preview-group">
          <div
            class="ch-item ch-item--root"
            :class="{
              'is-expanded': isRootExpanded(root.id),
              active: isRootHighlighted(root),
              playing: isRootPlaying(root)
            }"
            @click="onRootClick(root)"
          >
            <el-icon class="ch-item-icon">
              <VideoCamera v-if="isRootPlaying(root) || isRootHighlighted(root)" />
              <Compass v-else />
            </el-icon>
            <span class="ch-body">
              <span class="ch-name">{{ root.name }}</span>
            </span>
          </div>

          <div v-if="isRootExpanded(root.id) && getChildren(root.id).length > 0" class="chapter-preview-children">
            <div
              v-for="child in getChildren(root.id)"
              :key="child.id"
              class="ch-item ch-item--child"
              :class="{
                active: editor.isChapterListActive(child),
                playing: editor.isChapterPlaying(child)
              }"
              @click.stop="onChildClick(child)"
            >
              <span class="ch-body">
                <span class="ch-name">{{ child.name }}</span>
              </span>
            </div>
          </div>
        </div>

        <div v-if="rootChapters.length === 0" class="chapter-list-empty chapter-list-empty--preview">
          <span>{{ $t("OpWeb.Editor.NoChapters", "暂无节点") }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-chapter-preview-drawer">
import { Close, Compass, VideoCamera } from "@element-plus/icons-vue";
import { computed, ref, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";
import type { Chapter } from "@/interface/project";

const editor = useMovieEditorContext();
const $t = useTranslate();

const emit = defineEmits<{
  close: [];
  play: [chapter: Chapter];
}>();

const rootChapters = computed(() => editor.timelineChapters);
const expandedRootId = ref<string | null>(null);

function getChildren(rootId: string) {
  return editor.getChapterChildren(rootId);
}

function isRootExpanded(rootId: string) {
  return expandedRootId.value === rootId;
}

function isRootHighlighted(root: Chapter) {
  return editor.isChapterListActive(root);
}

function isRootPlaying(root: Chapter) {
  return editor.isChapterPlaying(root);
}

function syncExpandedRoot() {
  const selectedId = editor.getActiveChapterIdForUi();
  if (!selectedId) {
    if (expandedRootId.value) return;
    const firstWithChildren = rootChapters.value.find(root => getChildren(root.id).length > 0);
    expandedRootId.value = firstWithChildren?.id ?? rootChapters.value[0]?.id ?? null;
    return;
  }

  const selected = editor.chapters.find(ch => ch.id === selectedId);
  if (!selected) return;
  expandedRootId.value = selected.parentId ?? selected.id;
}

function onRootClick(root: Chapter) {
  const children = getChildren(root.id);
  if (children.length > 0) {
    expandedRootId.value = root.id;
  }
  emit("play", root);
}

function onChildClick(child: Chapter) {
  emit("play", child);
}

watch(
  () => [editor.selectedChapterId, editor.chapters.length] as const,
  () => syncExpandedRoot(),
  { immediate: true }
);
</script>
