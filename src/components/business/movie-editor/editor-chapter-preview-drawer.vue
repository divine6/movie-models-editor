<template>
  <div class="chapter-preview-panel">
    <div class="chapter-preview-drawer-head">
      <span class="chapter-preview-drawer-title">{{ drawerTitle }}</span>
      <button
        v-if="!viewOnly"
        type="button"
        class="chapter-preview-drawer-close"
        :title="$t('OpWeb.Common.Close', '关闭')"
        @click="emit('close')"
      >
        <el-icon><Close /></el-icon>
      </button>
    </div>

    <div class="chapter-panel-list">
      <editor-scene-node-tree preview @play="onPlay" />
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-chapter-preview-drawer">
import { Close } from "@element-plus/icons-vue";
import { computed } from "vue";

import EditorSceneNodeTree from "@/components/business/movie-editor/editor-scene-node-tree.vue";
import { useTranslate } from "@/hooks/useTranslate";
import type { SceneAnimationNode } from "@/interface/project";

const props = defineProps<{
  viewOnly?: boolean;
}>();

const $t = useTranslate();

const emit = defineEmits<{
  close: [];
  play: [chapter: SceneAnimationNode];
}>();

const drawerTitle = computed(() => $t("OpWeb.Editor.PresentationList", "展示列表"));

function onPlay(node: SceneAnimationNode) {
  emit("play", node);
}
</script>
