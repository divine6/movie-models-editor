<template>
  <div
    class="chapter-list-panel"
    :class="{
      'is-preview': isPresentationTree,
      'is-view': editor.viewOnly,
      'is-drawer-open': isPresentationTree && presentationDrawerOpen
    }"
  >
    <div v-if="!isPresentationTree" class="panel-head">
      <span>{{ $t("OpWeb.Editor.Chapters", "视频编辑") }}</span>
    </div>

    <div v-if="isPresentationTree && !editor.viewOnly" class="chapter-preview-backdrop" @click="hideChapterDrawer()" />

    <div class="chapter-panel-body">
      <template v-if="isPresentationTree">
        <editor-chapter-preview-drawer
          :view-only="editor.viewOnly"
          @close="hideChapterDrawer()"
          @play="onPreviewChapterPlay"
        />
      </template>

      <template v-else>
        <div class="chapter-panel-list">
          <editor-scene-node-tree />
          <input
            id="scene-video-file-input"
            type="file"
            accept="video/*"
            class="scene-video-file-input"
            @change="onVideoNodeFileChange"
          />
        </div>

        <div v-if="selectedAnimationNode" class="chapter-panel-detail">
          <div class="chapter-detail-head">
            <span>动画信息</span>
            <span class="chapter-detail-sub">{{ selectedAnimationNode.name || "未命名动画" }}</span>
          </div>
          <editor-chapter-form />
        </div>

        <div v-else-if="selectedVideoNode" class="chapter-panel-detail">
          <div class="chapter-detail-head">
            <span>视频信息</span>
            <span class="chapter-detail-sub">{{ selectedVideoNode.name || "未命名视频" }}</span>
          </div>
          <div class="video-node-detail" data-testid="video-node-detail">
            <div class="chapter-form-field">
              <label class="chapter-field-label">{{ $t("OpWeb.Common.Name", "名称") }}</label>
              <el-input
                :model-value="selectedVideoNode.name"
                size="small"
                placeholder="视频名称"
                @update:model-value="editor.renameActiveVideoNode"
              />
            </div>
            <p class="video-node-detail-hint">上传视频、替换视频与添加动画请使用节点行右侧图标</p>
          </div>
        </div>

        <div v-else-if="selectedGroupNode" class="chapter-panel-detail">
          <div class="chapter-detail-head">
            <span>分组信息</span>
            <span class="chapter-detail-sub">{{ selectedGroupNode.name || "未命名分组" }}</span>
          </div>
          <div class="video-node-detail">
            <div class="chapter-form-field">
              <label class="chapter-field-label">{{ $t("OpWeb.Common.Name", "名称") }}</label>
              <el-input
                :model-value="selectedGroupNode.name"
                size="small"
                placeholder="分组名称"
                @update:model-value="editor.renameSelectedGroup"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-chapter-list">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import EditorChapterForm from "@/components/business/movie-editor/editor-chapter-form.vue";
import EditorChapterPreviewDrawer from "@/components/business/movie-editor/editor-chapter-preview-drawer.vue";
import EditorSceneNodeTree from "@/components/business/movie-editor/editor-scene-node-tree.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { usePreviewChapterDrawer } from "@/composables/usePreviewChapterDrawer";
import type { Chapter } from "@/interface/project";

const editor = useMovieEditorContext();
const { open: drawerOpen, hide: hideChapterDrawer } = usePreviewChapterDrawer();

const isPresentationTree = computed(() => editor.viewOnly || editor.isPreviewMode);
const isNarrowScreen = ref(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
const updateScreenState = () => {
  if (typeof window === "undefined") return;
  isNarrowScreen.value = window.innerWidth <= 768;
};
const presentationDrawerOpen = computed(() => {
  if (!editor.viewOnly) return drawerOpen.value;
  return isNarrowScreen.value ? drawerOpen.value : true;
});

const selectedNode = computed(() => {
  const id = editor.selectedNodeId;
  if (!id) return null;
  return editor.nodes.find(n => n.id === id) ?? null;
});
const selectedAnimationNode = computed(() =>
  selectedNode.value?.type === "animation" ? selectedNode.value : null
);
const selectedVideoNode = computed(() => (selectedNode.value?.type === "video" ? selectedNode.value : null));
const selectedGroupNode = computed(() => (selectedNode.value?.type === "group" ? selectedNode.value : null));

const onPreviewChapterPlay = (chapter: Chapter) => {
  if (editor.viewOnly || editor.isPreviewMode) {
    // 统一走 jump/seek，避免先 highlight 再跳转导致列表/进度条短暂不同步
    editor.jumpToChapter(chapter);
  } else {
    const wasPlaying = !!(editor.videoEl && (!editor.videoEl.paused || editor.isPlaying));
    void editor.startChapterPlayback(chapter, {
      autoplay: true,
      syncVideo: true,
      userGesture: true,
      keepPlaying: wasPlaying
    });
  }
  // Delay closing the drawer so the touch cannot click-through onto the play button
  // (which would immediately pause after a play jump). Keep short so切章体感更即时。
  if (!editor.viewOnly || (typeof window !== "undefined" && window.innerWidth <= 768)) {
    window.setTimeout(() => hideChapterDrawer(), 180);
  }
};

const onVideoNodeFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) editor.uploadVideo(file);
  input.value = "";
};

watch(
  () => editor.isPreviewMode,
  isPreview => {
    if (!isPreview) hideChapterDrawer();
  }
);

onMounted(() => {
  updateScreenState();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateScreenState);
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", updateScreenState);
  }
});

</script>

<style scoped>
.scene-video-file-input {
  display: none;
}
.video-node-detail {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-node-detail-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-color-3);
}
</style>
