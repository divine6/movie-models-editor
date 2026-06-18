<template>
  <div class="model-tree-branch">
    <div
      class="model-tree-node"
      :class="{
        selected: editor.selModelNodeId === node.id,
        hovered: editor.isModelNodeHovered(node.modelId, node.id),
        'is-mesh': node.objectType === 'mesh',
        'is-bone': node.objectType === 'bone'
      }"
      :style="{ paddingLeft: `${depth * 14 + 6}px` }"
      @mouseenter="editor.hoverModelInList(node.modelId, node.id)"
      @click.stop="onSelect"
    >
      <button
        v-if="node.children.length"
        type="button"
        class="tree-toggle"
        :aria-expanded="expanded"
        @click.stop="expanded = !expanded"
      >
        {{ expanded ? "▾" : "▸" }}
      </button>
      <span v-else class="tree-toggle-placeholder" />
      <span class="tree-node-icon">{{ typeIcon }}</span>
      <span class="tree-node-name" :title="node.path">{{ node.name }}</span>
      <span v-if="node.mergedNodeIds && node.mergedNodeIds.length > 1 && !node.materialGroupHost" class="tree-node-merged" title="同几何体多材质合并">×{{ node.mergedNodeIds.length }}</span>
      <span class="tree-node-type">{{ typeLabel }}</span>
    </div>
    <div v-show="expanded && node.children.length" class="model-tree-children">
      <editor-model-tree-node
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-model-tree-node">
import { computed, ref } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import type { ModelHierarchyNode } from "@/interface/project";

const props = defineProps<{
  node: ModelHierarchyNode;
  depth: number;
}>();

const editor = useMovieEditorContext();
const expanded = ref(props.depth < 2);

const typeIcon = computed(() => {
  switch (props.node.objectType) {
    case "mesh":
      return "◆";
    case "bone":
      return "◎";
    case "group":
      return "▣";
    default:
      return "○";
  }
});

const typeLabel = computed(() => {
  switch (props.node.objectType) {
    case "mesh":
      return "Mesh";
    case "bone":
      return "Bone";
    case "group":
      return "Group";
    default:
      return "Node";
  }
});

function onSelect() {
  editor.selectModelNode(props.node.modelId, props.node.id, { focusCamera: true });
}
</script>
