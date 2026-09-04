<template>
  <div class="scene-node-branch">
    <div
      class="scene-node-row"
      :data-testid="'scene-node-' + node.type"
      :data-node-id="node.id"
      :data-node-type="node.type"
      :class="rowClasses"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      :draggable="isDraggable"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="onRowClick"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="scene-node-toggle"
        :aria-expanded="isExpanded"
        @click.stop="toggleExpand"
      >
        {{ isExpanded ? "▾" : "▸" }}
      </button>
      <span v-else class="scene-node-toggle-placeholder" />

      <span class="scene-node-icon" :class="`scene-node-icon--${node.type}`">{{ typeIcon }}</span>

      <span class="scene-node-body">
        <span class="scene-node-name" :title="node.name">{{ node.name || defaultName }}</span>
        <span v-if="node.type === 'animation' && !preview" class="scene-node-meta">
          {{ editor.fmt(node.startTime) }} → {{ editor.fmt(node.endTime) }}
        </span>
        <span v-else-if="node.type === 'video' && !preview && !videoHasSrc" class="scene-node-meta scene-node-meta--warn">
          未上传视频
        </span>
        <!-- 仅编辑页：每个动画一条小进度条 -->
        <div
          v-if="node.type === 'animation' && !preview"
          class="scene-node-segment-track"
          :class="{ 'is-active': isAnimPlaying }"
        >
          <div class="scene-node-segment-fill" :style="{ width: `${animFillPct}%` }" />
        </div>
      </span>

      <span v-if="isDropForbidden" class="scene-node-drop-forbid" title="不可拖入此处" aria-hidden="true">🚫</span>
      <span v-else-if="isDropAllowed" class="scene-node-drop-allow" title="可放入此分组" aria-hidden="true">⬇</span>

      <span v-if="!preview" class="scene-node-actions" @click.stop>
        <el-dropdown v-if="node.type === 'group'" trigger="click" @command="(cmd: string) => onMenuCommand(cmd)">
          <el-button text type="primary" size="small" class="scene-node-action-btn">
            <el-icon><Plus /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="add-group">添加分组</el-dropdown-item>
              <el-dropdown-item command="add-video">添加视频</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <template v-if="node.type === 'video'">
          <el-tooltip :content="videoHasSrc ? '替换视频' : '上传视频'" placement="top" :show-after="400">
            <el-button
              text
              type="primary"
              size="small"
              class="scene-node-action-btn"
              data-testid="video-upload-btn"
              @click="editor.triggerVideoNodeUpload(node.id)"
            >
              <el-icon><Upload /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="videoHasSrc" content="添加动画节点" placement="top" :show-after="400">
            <el-button
              text
              type="primary"
              size="small"
              class="scene-node-action-btn"
              data-testid="video-add-animation-btn"
              @click="editor.addAnimationNode(node.id)"
            >
              <el-icon><CirclePlus /></el-icon>
            </el-button>
          </el-tooltip>
        </template>

        <el-tooltip
          v-if="node.type === 'animation'"
          :content="isAnimPlaying ? '暂停' : '播放'"
          placement="top"
          :show-after="400"
        >
          <el-button
            text
            type="primary"
            size="small"
            class="scene-node-action-btn"
            :class="{ 'is-playing': isAnimPlaying }"
            @click.stop="onPlayAnimation(node)"
          >
            <el-icon>
              <VideoPause v-if="isAnimPlaying" />
              <VideoPlay v-else />
            </el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip content="删除" placement="top" :show-after="400">
          <el-button text type="danger" size="small" class="scene-node-action-btn" @click="editor.deleteSceneNode(node)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </span>
    </div>

    <div v-show="isExpanded && hasChildren" class="scene-node-children">
      <editor-scene-node-tree-item
        v-for="child in children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :preview="preview"
        :visible-node-ids="visibleNodeIds"
        :searching="searching"
        @play="emit('play', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-scene-node-tree-item">
import { CirclePlus, Delete, Plus, Upload, VideoPause, VideoPlay } from "@element-plus/icons-vue";
import { computed } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import type { SceneAnimationNode, SceneNode, SceneVideoNode } from "@/interface/project";

const props = defineProps<{
  node: SceneNode;
  depth: number;
  preview?: boolean;
  visibleNodeIds?: Set<string> | null;
  searching?: boolean;
}>();

const emit = defineEmits<{
  play: [node: SceneAnimationNode];
}>();

const editor = useMovieEditorContext();

const children = computed(() => {
  const list = editor.getSceneNodeChildren(props.node.id);
  if (!props.visibleNodeIds) return list;
  return list.filter(child => props.visibleNodeIds!.has(child.id));
});
const hasChildren = computed(
  () => children.value.length > 0 || props.node.type === "group" || props.node.type === "video"
);
const isExpanded = computed(() => (props.searching ? true : editor.isSceneNodeExpanded(props.node.id)));
const isDraggable = computed(() => !props.preview && props.node.type === "video");
const isDropTarget = computed(() => editor.sceneNodeDropTargetId === props.node.id);
const isDropAllowed = computed(() => isDropTarget.value && editor.sceneNodeDropKind === "allow");
const isDropForbidden = computed(() => isDropTarget.value && editor.sceneNodeDropKind === "forbid");
const videoHasSrc = computed(() => props.node.type === "video" && !!editor.getVideoNodeSrc(props.node));
const defaultName = computed(() => {
  if (props.node.type === "video") return "未命名视频";
  if (props.node.type === "group") return "未命名分组";
  if (props.node.type === "animation") return "未命名动画";
  return "未命名";
});

const isAnimPlaying = computed(() => {
  if (props.preview || props.node.type !== "animation") return false;
  return editor.isChapterPlaying(props.node as SceneAnimationNode);
});

const animFillPct = computed(() => {
  if (props.preview || props.node.type !== "animation") return 0;
  return editor.chapterListFillPct(props.node as SceneAnimationNode);
});

const typeIcon = computed(() => {
  switch (props.node.type) {
    case "group":
      return "📁";
    case "video":
      return "🎬";
    case "animation":
      return "✨";
    default:
      return "•";
  }
});

const rowClasses = computed(() => {
  void editor.presentationUiChapterId;
  void editor.presentationNavIndex;
  void editor.presentationUiRevision;
  void editor.presentationPlaybackSession?.navChapterId;
  void editor.presentationPlaybackSession?.requestId;
  void editor.presentationPlaybackSession?.phase;
  void editor.currentTime;
  void editor.selectedNodeId;
  void editor.selectedChapterId;
  void editor.activeVideoId;
  void editor.isPlaying;
  void editor.totalPlaying;
  void editor.clipPlayElapsed;
  const active = editor.isSceneNodeSelected(props.node);
  return {
    // 高亮只跟当前播放/选中章，禁止 selected||playing 叠出两条绿
    active,
    playing: false,
    "is-group": props.node.type === "group",
    "is-video": props.node.type === "video",
    "is-animation": props.node.type === "animation",
    "is-drop-target": isDropAllowed.value,
    "is-drop-forbidden": isDropForbidden.value,
    "is-dragging": editor.sceneNodeDraggingId === props.node.id
  };
});

function toggleExpand() {
  editor.toggleSceneNodeExpanded(props.node.id, { accordion: !!props.preview });
}

function onPlayAnimation(node: SceneAnimationNode) {
  editor.toggleChapterPlayback(node);
}

function onRowClick() {
  if (props.preview) {
    if (props.node.type === "animation") {
      // Presentation/preview: only emit play → jumpToChapter. Do not highlight first
      // (that used to rewrite UI/session from the current clock before seek).
      emit("play", props.node);
    } else if (props.node.type === "video") {
      // 预览/展示：点视频节点也要加载对应视频
      editor.activatePresentationVideoNode(props.node as SceneVideoNode);
      toggleExpand();
    } else if (props.node.type === "group") {
      toggleExpand();
    }
    return;
  }
  editor.selectSceneNode(props.node);
}

function onDragStart(e: DragEvent) {
  if (props.node.type !== "video") return;
  editor.startDragSceneVideo(props.node.id);
  e.dataTransfer?.setData("text/scene-video-id", props.node.id);
  e.dataTransfer!.effectAllowed = "move";
}

function onDragEnd() {
  editor.endDragSceneVideo();
}

function onDragOver(e: DragEvent) {
  if (!editor.sceneNodeDraggingId) return;
  e.preventDefault();
  e.stopPropagation();

  if (props.node.type === "group" && editor.canDropDraggedVideoTo(props.node.id)) {
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    editor.setSceneNodeDropTarget(props.node.id, "allow");
    return;
  }

  if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
  editor.setSceneNodeDropTarget(props.node.id, "forbid");
}

function onDragLeave(e: DragEvent) {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  if (editor.sceneNodeDropTargetId === props.node.id) {
    editor.setSceneNodeDropTarget(null);
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  const videoId = editor.sceneNodeDraggingId;
  if (videoId && props.node.type === "group" && editor.canDropDraggedVideoTo(props.node.id)) {
    editor.moveSceneVideoToGroup(videoId, props.node.id);
  }
  editor.endDragSceneVideo();
}

function onMenuCommand(cmd: string) {
  switch (cmd) {
    case "add-group":
      editor.addGroupNode(props.node.type === "group" ? props.node.id : props.node.parentId);
      break;
    case "add-video":
      editor.addVideoNode(props.node.type === "group" ? props.node.id : undefined);
      break;
  }
}
</script>
