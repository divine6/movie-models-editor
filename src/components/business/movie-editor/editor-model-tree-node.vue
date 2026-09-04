<template>
  <div class="model-tree-branch">
    <div
      class="model-tree-node"
      :class="{
        selected: isPrimarySelected,
        'multi-selected': isMultiSelected,
        hovered: editor.isModelNodeHovered(node.modelId, node.id),
        'is-mesh': node.objectType === 'mesh',
        'is-bone': node.objectType === 'bone'
      }"
      :style="{ paddingLeft: `${depth * 14 + 6}px` }"
      @mouseenter="editor.hoverModelInList(node.modelId, node.id)"
      @click.exact.stop="onSelectExact"
      @click.shift.exact.stop="onSelectShift"
      @click.ctrl.exact.stop="onSelectCtrl"
      @click.meta.exact.stop="onSelectCtrl"
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
      <span
        v-if="inActiveClip"
        class="edited-badge"
        title="已在当前动画片段中"
      >
        已改
      </span>
      <span
        v-else-if="isMultiSelected"
        class="sel-badge"
        title="多选中"
      >
        选中
      </span>
      <span
        v-else-if="!unref(editor.activeAnimClipId) && editor.modelNodeHasEdits(node.modelId, node.id)"
        class="edited-badge is-soft"
        title="该节点在当前选中动画下已编辑过"
      >
        已改
      </span>
      <span
        v-if="node.mergedNodeIds && node.mergedNodeIds.length > 1 && !node.materialGroupHost"
        class="tree-node-merged"
        title="同几何体多材质合并"
      >
        ×{{ node.mergedNodeIds.length }}
      </span>
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
import { computed, ref, unref, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import type { ModelHierarchyNode } from "@/interface/project";

const props = defineProps<{
  node: ModelHierarchyNode;
  depth: number;
}>();

const editor = useMovieEditorContext();
const expanded = ref(props.depth < 1);

const isPrimarySelected = computed(() => {
  unref(editor.selModelId);
  unref(editor.selModelNodeId);
  unref(editor.hierarchyRevision);
  return editor.isModelNodeSelected(props.node.modelId, props.node.id);
});

watch(
  () => unref(editor.modelTreeExpandRevision),
  () => {
    if (editor.isModelTreeNodeForceExpanded(props.node.id)) {
      expanded.value = true;
    }
  }
);

const isMultiSelected = computed(() => {
  unref(editor.activeClipSelectedKeySet);
  if (!unref(editor.activeAnimClipId)) return false;
  return editor.isClipTargetSelected(props.node.modelId, props.node.id);
});

const inActiveClip = computed(() => {
  unref(editor.activeClipEditedKeySet);
  if (!unref(editor.activeAnimClipId)) return false;
  return editor.isClipTargetInClip(props.node.modelId, props.node.id);
});

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

function pickNode(mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) {
  const multi = !!(mods.shiftKey || mods.ctrlKey || mods.metaKey);
  editor.selectModelNode(props.node.modelId, props.node.id, {
    focusCamera: !multi,
    shiftKey: !!mods.shiftKey,
    ctrlKey: !!mods.ctrlKey,
    metaKey: !!mods.metaKey
  });
}

function onSelectExact() {
  pickNode({});
}

function onSelectShift() {
  pickNode({ shiftKey: true });
}

function onSelectCtrl() {
  pickNode({ ctrlKey: true });
}
</script>
