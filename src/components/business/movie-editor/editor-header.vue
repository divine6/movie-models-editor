<template>
  <header class="editor-topbar" :class="{ 'editor-topbar--view-only': editor.viewOnly }">
    <div class="editor-topbar__logo">
      <img :src="projectLogo" alt="" />
    </div>
    <div v-if="!editor.viewOnly" class="editor-topbar__main">
      <div v-if="!isEditing" class="editor-topbar__title-view">
        <span class="editor-topbar__title-text">{{ displayTitle }}</span>
        <button type="button" class="editor-topbar__title-edit" :title="$t('OpWeb.Common.Edit', '编辑')" @click="startEdit">
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
    <div v-if="!editor.viewOnly" class="editor-topbar__actions">
      <el-button v-if="editor.isPreviewMode" size="default" type="primary" plain @click="editor.togglePreview">
        <el-icon><Close /></el-icon>
        {{ $t("OpWeb.Editor.ExitPreview", "退出预览") }}
      </el-button>
      <el-button v-else size="default" :disabled="!editor.hasVideo || editor.chapters.length === 0" @click="editor.togglePreview">
        <el-icon><View /></el-icon>
        {{ $t("OpWeb.Editor.Preview", "预览") }}
      </el-button>
      <el-button size="default" :disabled="!editor.modelSetCode" @click="sceneListVisible = true">
        场景列表
      </el-button>
      <el-button
        type="primary"
        size="default"
        :loading="editor.savingScene"
        :disabled="!editor.hasVideo || editor.chapters.length === 0"
        @click="editor.saveSceneToServer"
      >
        {{ editor.sceneCode ? $t("OpWeb.Editor.Update", "更新") : $t("OpWeb.Editor.Save", "保存") }}
      </el-button>
    </div>
  </header>
  <editor-scene-list-drawer v-model="sceneListVisible" />
</template>

<script setup lang="ts" name="editor-header">
import { Close, Edit, View } from "@element-plus/icons-vue";
import { computed, nextTick, ref } from "vue";

import projectLogo from "@/assets/images/common/logo.svg";
import EditorSceneListDrawer from "@/components/business/movie-editor/editor-scene-list-drawer.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const $t = useTranslate();

const isEditing = ref(false);
const sceneListVisible = ref(false);
const titleInputRef = ref<{ focus: () => void } | null>(null);
const defaultTitle = computed(() => $t("OpWeb.Project.Demo", "演示项目"));
const displayTitle = computed(() => editor.projectTitle.trim() || defaultTitle.value);

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
