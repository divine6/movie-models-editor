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

      @dragover.prevent="onDragOver"

      @dragleave="onDragLeave"

      @drop.prevent="onDrop"

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

        <span class="scene-node-name" :title="node.name">{{ node.name }}</span>

        <span v-if="node.type === 'animation' && !preview" class="scene-node-meta">

          {{ editor.fmt(node.startTime) }} → {{ editor.fmt(node.endTime) }}

        </span>

        <span v-else-if="node.type === 'video' && !preview && !videoHasSrc" class="scene-node-meta scene-node-meta--warn">

          未上传视频

        </span>

      </span>



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



        <el-tooltip v-if="node.type === 'animation'" content="播放" placement="top" :show-after="400">

          <el-button text type="primary" size="small" class="scene-node-action-btn" @click.stop="onPlayAnimation(node)">

            <el-icon><VideoPlay /></el-icon>

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

import { CirclePlus, Delete, Plus, Upload, VideoPlay } from "@element-plus/icons-vue";

import { computed } from "vue";



import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

import type { SceneAnimationNode, SceneNode } from "@/interface/project";



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

const hasChildren = computed(() => children.value.length > 0 || props.node.type === "group" || props.node.type === "video");

const isExpanded = computed(() => (props.searching ? true : editor.isSceneNodeExpanded(props.node.id)));

const isDraggable = computed(() => !props.preview && props.node.type === "video");

const isDropTarget = computed(() => editor.sceneNodeDropTargetId === props.node.id);

const videoHasSrc = computed(() => props.node.type === "video" && !!editor.getVideoNodeSrc(props.node));



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



const rowClasses = computed(() => ({

  active: editor.isSceneNodeSelected(props.node),

  "is-group": props.node.type === "group",

  "is-video": props.node.type === "video",

  "is-animation": props.node.type === "animation",

  "is-drop-target": isDropTarget.value,

  "is-dragging": editor.sceneNodeDraggingId === props.node.id

}));



function toggleExpand() {

  editor.toggleSceneNodeExpanded(props.node.id, { accordion: !!props.preview });

}



function onPlayAnimation(node: SceneAnimationNode) {

  editor.playChapter(node);

}



function onRowClick() {

  if (props.preview) {

    if (props.node.type === "animation") {

      editor.highlightSceneNode(props.node.id);

      emit("play", props.node);

    } else if (props.node.type === "video" || props.node.type === "group") {

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



function onDragOver() {

  if (props.node.type === "group") {

    editor.setSceneNodeDropTarget(props.node.id);

  }

}



function onDragLeave() {

  if (editor.sceneNodeDropTargetId === props.node.id) {

    editor.setSceneNodeDropTarget(null);

  }

}



function onDrop() {

  const videoId = editor.sceneNodeDraggingId;

  const targetParentId = props.node.type === "group" ? props.node.id : null;

  if (videoId) editor.moveSceneVideoToGroup(videoId, targetParentId);

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


