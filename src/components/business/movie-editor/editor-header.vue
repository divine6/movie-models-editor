<template>
  <header
    class="editor-topbar"
    :class="{
      'editor-topbar--view-only': editor.viewOnly,
      'editor-topbar--preview': editor.isPreviewMode && !editor.viewOnly,
      'editor-topbar--edit': routeMode === 'edit'
    }"
  >
    <!-- 展示模式 (mode=view) -->
    <div v-if="routeMode === 'view'" class="editor-topbar__brand">
      <span class="editor-topbar__brand-title">UltimateBox</span>
      <span class="editor-topbar__brand-subtitle">3D Explorer</span>
    </div>

    <!-- 预览模式 (mode=preview) -->
    <template v-else-if="routeMode === 'preview'">
      <div class="editor-topbar__brand">
        <span class="editor-topbar__brand-title">UltimateBox</span>
        <span class="editor-topbar__brand-subtitle">预览</span>
      </div>
      <div class="editor-topbar__preview-end">
        <button
          v-if="editor.hasVideo"
          type="button"
          class="editor-topbar__chapter-trigger"
          title="节点"
          @click="chapterDrawer?.show()"
        >
          <svg
            class="editor-topbar__chapter-trigger-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M3.33333 14C2.96667 14 2.65278 13.8694 2.39167 13.6083C2.13056 13.3472 2 13.0333 2 12.6667V3.33333C2 2.96667 2.13056 2.65278 2.39167 2.39167C2.65278 2.13056 2.96667 2 3.33333 2H12.6667C13.0333 2 13.3472 2.13056 13.6083 2.39167C13.8694 2.65278 14 2.96667 14 3.33333V12.6667C14 13.0333 13.8694 13.3472 13.6083 13.6083C13.3472 13.8694 13.0333 14 12.6667 14H3.33333ZM10.6667 12.6667H12.6667V3.33333H10.6667V12.6667ZM9.33333 12.6667V3.33333H3.33333V12.6667H9.33333Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <el-button
          class="editor-topbar__exit-preview"
          size="default"
          plain
          title="退出预览"
          @click.stop="editor.exitPreview"
        >
          <el-icon><Close /></el-icon>
          <span class="editor-topbar__exit-preview-label">退出预览</span>
        </el-button>
      </div>
    </template>

    <!-- 编辑模式 (默认) -->
    <template v-else>
      <div class="editor-topbar__logo">
        <img :src="projectLogo" alt="" />
      </div>
      <div class="editor-topbar__main">
        <div v-if="!isEditing" class="editor-topbar__title-view">
          <span class="editor-topbar__title-text">{{ displayTitle }}</span>
          <button type="button" class="editor-topbar__title-edit" title="编辑" @click="startEdit">
            <el-icon><Edit /></el-icon>
          </button>
        </div>
        <el-input
          v-else
          ref="titleInputRef"
          v-model="editor.projectTitle"
          class="editor-topbar__title-input"
          size="default"
          :placeholder="defaultTitle"
          @blur="finishEdit"
          @keyup.enter="finishEdit"
        />
      </div>
      <div class="editor-topbar__actions">
        <el-button v-if="showAdminButton" size="default" @click="openAdmin">
          <el-icon><Setting /></el-icon>
          后台管理
        </el-button>
        <el-button size="default" :disabled="!editor.hasVideo || editor.chapters.length === 0" @click="editor.togglePreview">
          <el-icon><View /></el-icon>
          预览
        </el-button>
        <el-button size="default" :disabled="!editor.modelSetCode" @click="sceneListVisible = true"> 场景列表 </el-button>
        <el-button
          class="editor-topbar__save-btn"
          type="primary"
          size="default"
          :loading="editor.savingScene"
          :disabled="!editor.hasVideo || editor.chapters.length === 0"
          @click="editor.saveSceneToServer"
        >
          {{ editor.sceneCode ? "更新" : "保存" }}
        </el-button>
      </div>
    </template>

    <!-- 展示模式右侧 -->
    <div v-if="routeMode === 'view'" class="editor-topbar__preview-end">
      <button
        v-if="editor.hasVideo"
        type="button"
        class="editor-topbar__chapter-trigger"
        title="节点"
        @click="chapterDrawer?.show()"
      >
        <svg
          class="editor-topbar__chapter-trigger-icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M3.33333 14C2.96667 14 2.65278 13.8694 2.39167 13.6083C2.13056 13.3472 2 13.0333 2 12.6667V3.33333C2 2.96667 2.13056 2.65278 2.39167 2.39167C2.65278 2.13056 2.96667 2 3.33333 2H12.6667C13.0333 2 13.3472 2.13056 13.6083 2.39167C13.8694 2.65278 14 2.96667 14 3.33333V12.6667C14 13.0333 13.8694 13.3472 13.6083 13.6083C13.3472 13.8694 13.0333 14 12.6667 14H3.33333ZM10.6667 12.6667H12.6667V3.33333H10.6667V12.6667ZM9.33333 12.6667V3.33333H3.33333V12.6667H9.33333Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  </header>
  <editor-scene-list-drawer v-model="sceneListVisible" />
</template>

<script setup lang="ts" name="editor-header">
import { Close, Edit, Setting, View } from "@element-plus/icons-vue";
import { computed, nextTick, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import projectLogo from "@/assets/images/common/logo.svg";
import EditorSceneListDrawer from "@/components/business/movie-editor/editor-scene-list-drawer.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { usePreviewChapterDrawerOptional } from "@/composables/usePreviewChapterDrawer";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const chapterDrawer = usePreviewChapterDrawerOptional();
const route = useRoute();
const router = useRouter();
const $t = useTranslate();

/** 带 ?code= 的编辑场景链接不显示后台管理入口 */
const showAdminButton = computed(() => !route.query.code);

const routeMode = computed(() => {
  if (editor.viewOnly) return "view";
  if (editor.isPreviewMode) return "preview";
  return "edit";
});

const isEditing = ref(false);
const sceneListVisible = ref(false);
const titleInputRef = ref<{ focus: () => void } | null>(null);
const defaultTitle = computed(() => $t("OpWeb.Project.Demo", "演示项目"));
const displayTitle = computed(() => editor.projectTitle.trim() || defaultTitle.value);

function openAdmin() {
  router.push({ path: "/project/admin" });
}

const startEdit = async () => {
  if (!editor.projectTitle.trim()) {
    editor.projectTitle = defaultTitle.value;
  }
  isEditing.value = true;
  await nextTick();
  titleInputRef.value?.focus();
};

const finishEdit = () => {
  if (!editor.projectTitle.trim()) {
    editor.projectTitle = defaultTitle.value;
  }
  editor.saveTitle();
  isEditing.value = false;
};
</script>
