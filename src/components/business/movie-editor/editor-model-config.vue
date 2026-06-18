<template>
  <div v-if="editor.selModel" class="model-config">
    <div class="model-config-header">
      <span class="md-dot" :style="{ background: editor.selModel.color }" />
      <span class="md-name">{{ editor.modelDisplayName }}</span>
      <span v-if="editor.selModelNode" class="md-node-path" :title="editor.selModelNode.path">
        {{ editor.selModelNode.objectType }}
      </span>
      <span v-if="editor.selectedChapter" class="md-chapter">{{ editor.selectedChapter.name }}</span>
    </div>

    <div class="model-switch-row">
      <div class="model-switch-item">
        <span class="model-switch-label">{{ $t("OpWeb.Editor.ModelVisible", "显示") }}</span>
        <el-switch v-model="formData.visible" size="small" />
      </div>
      <div class="model-switch-item">
        <span class="model-switch-label">{{ $t("OpWeb.Editor.ModelOutline", "轮廓") }}</span>
        <el-switch v-model="formData.outline" size="small" />
      </div>
      <div class="model-switch-item">
        <span class="model-switch-label">{{ $t("OpWeb.Editor.ModelHighlight", "高亮") }}</span>
        <el-switch v-model="formData.highlight" size="small" />
      </div>
      <div class="model-switch-item">
        <span class="model-switch-label">{{ $t("OpWeb.Editor.PlayAnimation", "动画") }}</span>
        <el-switch v-model="formData.animation" size="small" />
      </div>
    </div>

    <div class="model-highlight-color-row">
      <span class="model-switch-label">{{ $t("OpWeb.Editor.HighlightColor", "高亮颜色") }}</span>
      <el-color-picker
        v-model="formData.highlightColor"
        size="small"
        :disabled="!formData.highlight"
        @change="onHighlightColorChange"
      />
    </div>

    <div class="model-intro-field">
      <label class="model-intro-label">{{ $t("OpWeb.Editor.ModelIntro", "模型介绍") }}</label>
      <el-input
        v-model="formData.intro"
        type="textarea"
        :rows="3"
        resize="none"
        size="small"
        :placeholder="$t('OpWeb.Editor.ModelIntroPlaceholder', '播放当前节点时，在模型旁显示此介绍')"
      />
    </div>

    <editor-model-animation :form-data="formData" :on-apply="applyLive" />
  </div>
  <div v-else-if="editor.selectedChapter" class="model-config-empty">
    <base-empty size="small" :text="$t('OpWeb.Editor.NoChapterModel', '当前节点未配置模型')">
      <template #desc>
        <span class="model-config-empty-desc">
          {{ $t("OpWeb.Editor.NoChapterModelHint", "请先在上方添加模型，或从模型列表中选择进行配置") }}
        </span>
      </template>
    </base-empty>
  </div>
</template>

<script setup lang="ts" name="editor-model-config">
import { reactive, unref, watch } from "vue";

import EditorModelAnimation from "@/components/business/movie-editor/editor-model-animation.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const $t = useTranslate();

const formData = reactive({
  visible: true,
  outline: false,
  highlight: false,
  highlightColor: "var(--success-color-6)",
  posOffsetX: 0,
  posOffsetY: 0,
  posOffsetZ: 0,
  scale: 1,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  animation: true,
  intro: ""
});

let isSyncingModelForm = false;

const syncFromEditor = () => {
  if (!unref(editor.selModelId)) return;

  isSyncingModelForm = true;
  Object.assign(formData, editor.getModelFormSnapshot());
  isSyncingModelForm = false;
};

watch(
  () => [editor.selModelId, editor.selectedChapterId, editor.modelFormRevision] as const,
  () => syncFromEditor(),
  { immediate: true }
);

const applyLive = (field: string) => {
  if (isSyncingModelForm || !unref(editor.selModelId)) return;

  editor.applyModelFormSnapshot({ ...formData });
  editor.applyMCfgLive(field);
};

watch(
  () => formData.visible,
  () => applyLive("visible")
);
watch(
  () => formData.outline,
  () => applyLive("outline")
);
watch(
  () => formData.highlight,
  () => applyLive("highlight")
);
watch(
  () => formData.animation,
  () => applyLive("animation")
);
watch(
  () => formData.intro,
  () => applyLive("intro")
);

const onHighlightColorChange = () => {
  if (!formData.highlight) return;
  applyLive("highlightColor");
};
</script>

<style lang="scss">
.movie-editor .model-config-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color-1);

  .md-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .md-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color-1);
  }

  .md-chapter {
    font-size: 11px;
    color: var(--text-color-3);
    margin-left: auto;
  }
}

.movie-editor .model-switch-row {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;

  .model-switch-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .model-switch-label {
    font-size: 12px;
    line-height: 20px;
    color: var(--text-color-2);
  }
}

.movie-editor .model-highlight-color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 0 2px;

  .model-switch-label {
    font-size: 12px;
    line-height: 20px;
    color: var(--text-color-2);
  }
}

.movie-editor .model-intro-field {
  margin-bottom: 14px;

  .model-intro-label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    line-height: 20px;
    color: var(--text-color-2);
  }
}
</style>
