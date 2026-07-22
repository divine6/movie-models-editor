<template>
  <div
    class="scene-node-tree"
    data-testid="scene-node-tree"
    :class="{
      'is-preview': preview,
      'is-empty': displayedRootNodes.length === 0,
      'is-root-drop-allow': isRootDropTarget,
      'is-root-drop-forbid': isRootDropForbidden
    }"
    @dragover.prevent="onRootDragOver"
    @dragleave="onRootDragLeave"
    @drop.prevent="onRootDrop"
  >
    <div class="scene-node-tree-toolbar" :class="{ 'scene-node-tree-toolbar--preview': preview }">
      <el-input
        v-model="keyword"
        class="scene-node-tree-search"
        size="small"
        clearable
        placeholder="搜索名称"
      />
      <el-dropdown v-if="!preview" trigger="click" @command="onRootMenu">
        <el-button type="primary" size="small" plain>＋ 添加</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="group">分组</el-dropdown-item>
            <el-dropdown-item command="video">视频</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <editor-scene-node-tree-item
      v-for="node in displayedRootNodes"
      :key="node.id"
      :node="node"
      :depth="0"
      :preview="preview"
      :visible-node-ids="matchedVisibleNodeIds"
      :searching="isSearching"
      @play="emit('play', $event)"
    />

    <div
      v-if="displayedRootNodes.length === 0"
      class="scene-node-tree-empty"
      :class="{
        'scene-node-tree-empty--root-drop': isRootDropTarget,
        'scene-node-tree-empty--root-forbid': isRootDropForbidden
      }"
    >
      <base-empty :size="isSearching ? 'default' : 'small'" :text="isSearching ? '未找到匹配节点' : '暂无节点'">
        <template #desc>
          <span>{{ isSearching ? "请尝试其他关键词" : "点击上方添加分组或视频" }}</span>
        </template>
      </base-empty>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-scene-node-tree">
import { computed, ref } from "vue";

import EditorSceneNodeTreeItem from "@/components/business/movie-editor/editor-scene-node-tree-item.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import type { SceneAnimationNode } from "@/interface/project";

defineProps<{
  preview?: boolean;
}>();

const emit = defineEmits<{
  play: [node: SceneAnimationNode];
}>();

const editor = useMovieEditorContext();
const rootNodes = computed(() => editor.rootSceneNodes);
const isRootDropTarget = computed(
  () => editor.sceneNodeDropTargetId === "__root__" && editor.sceneNodeDropKind === "allow"
);
const isRootDropForbidden = computed(
  () => editor.sceneNodeDropTargetId === "__root__" && editor.sceneNodeDropKind === "forbid"
);
const keyword = ref("");
const isSearching = computed(() => keyword.value.trim().length > 0);

const matchedVisibleNodeIds = computed<Set<string> | null>(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return null;

  const nodeMap = new Map(editor.nodes.map(node => [node.id, node]));
  const childrenMap = new Map<string, string[]>();
  for (const node of editor.nodes) {
    if (!node.parentId) continue;
    const list = childrenMap.get(node.parentId) ?? [];
    list.push(node.id);
    childrenMap.set(node.parentId, list);
  }

  const markDescendants = (startId: string, visible: Set<string>) => {
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = childrenMap.get(current);
      if (!children || children.length === 0) continue;
      for (const childId of children) {
        if (!visible.has(childId)) visible.add(childId);
        stack.push(childId);
      }
    }
  };

  const visible = new Set<string>();
  for (const node of editor.nodes) {
    const name = (node.name || "").toLowerCase();
    if (!name.includes(q)) continue;
    visible.add(node.id);
    let currentId: string | undefined | null = node.parentId;
    while (currentId) {
      if (visible.has(currentId)) break;
      visible.add(currentId);
      const current = nodeMap.get(currentId);
      currentId = current?.parentId ?? null;
    }
    markDescendants(node.id, visible);
  }
  return visible;
});

const displayedRootNodes = computed(() => {
  const visible = matchedVisibleNodeIds.value;
  if (!visible) return rootNodes.value;
  return rootNodes.value.filter(node => visible.has(node.id));
});

function onRootMenu(cmd: string) {
  if (cmd === "group") editor.addGroupNode();
  else if (cmd === "video") editor.addVideoNode();
}

function onRootDragOver(e: DragEvent) {
  if (!editor.sceneNodeDraggingId) return;
  e.preventDefault();
  if (editor.canDropDraggedVideoTo(null)) {
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    editor.setSceneNodeDropTarget("__root__", "allow");
  } else {
    if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    editor.setSceneNodeDropTarget("__root__", "forbid");
  }
}

function onRootDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  if (editor.sceneNodeDropTargetId === "__root__") editor.setSceneNodeDropTarget(null);
}

function onRootDrop(e: DragEvent) {
  e.preventDefault();
  const videoId = editor.sceneNodeDraggingId;
  if (videoId && editor.canDropDraggedVideoTo(null)) {
    editor.moveSceneVideoToGroup(videoId, null);
  }
  editor.endDragSceneVideo();
}
</script>
