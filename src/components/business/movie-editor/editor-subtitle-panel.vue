<template>
  <div class="subtitle-editor-panel">
    <div class="subtitle-form-card">
      <div class="subtitle-form-title">
        {{ editingId ? $t("OpWeb.Editor.EditSubtitle", "编辑字幕") : $t("OpWeb.Editor.AddSubtitle", "添加字幕") }}
      </div>

      <div class="subtitle-form-row subtitle-form-row--2">
        <div class="subtitle-form-field">
          <label class="subtitle-field-label">{{ $t("OpWeb.Editor.StartTime", "开始时间") }}</label>
          <el-input-number
            v-model="subForm.startTime"
            :min="0"
            :max="editor.duration"
            :step="0.1"
            :controls="false"
            size="small"
          />
        </div>
        <div class="subtitle-form-field">
          <label class="subtitle-field-label">{{ $t("OpWeb.Editor.EndTime", "结束时间") }}</label>
          <el-input-number v-model="subForm.endTime" :min="0" :max="editor.duration" :step="0.1" :controls="false" size="small" />
        </div>
      </div>

      <div class="subtitle-form-field subtitle-form-field--text">
        <label class="subtitle-field-label">{{ $t("OpWeb.Editor.SubtitleText", "字幕文本") }}</label>
        <el-input
          v-model="subForm.text"
          type="textarea"
          :rows="2"
          resize="none"
          size="small"
          :maxlength="SUBTITLE_TEXT_MAX_LENGTH"
          show-word-limit
          :placeholder="$t('OpWeb.Editor.SubtitlePlaceholder', '输入字幕文本内容...')"
        />
      </div>

      <div class="subtitle-form-row subtitle-form-row--2 subtitle-form-row--colors">
        <div class="subtitle-form-field subtitle-form-field--color">
          <label class="subtitle-field-label">{{ $t("OpWeb.Editor.SubtitleColor", "文字颜色") }}</label>
          <el-color-picker v-model="subForm.color" size="small" />
        </div>
        <div class="subtitle-form-field subtitle-form-field--color">
          <label class="subtitle-field-label">{{ $t("OpWeb.Editor.SubtitleBgColor", "背景颜色") }}</label>
          <el-color-picker v-model="subForm.backgroundColor" size="small" show-alpha />
        </div>
      </div>

      <el-button class="subtitle-submit-btn" type="primary" size="small" @click="handleSubmit">
        {{ editingId ? $t("OpWeb.Common.Confirm", "确认修改") : "＋ " + $t("OpWeb.Editor.AddSubtitle", "添加字幕") }}
      </el-button>
    </div>

    <div class="subtitle-list-section">
      <div class="subtitle-list-head">
        <span class="subtitle-list-title">{{ $t("OpWeb.Editor.SubtitleList", "已添加的字幕") }}</span>
        <span class="subtitle-list-count">{{ editor.subtitles.length }}</span>
      </div>

      <div class="subtitle-list" :class="{ 'is-empty': editor.subtitles.length === 0 }">
        <div v-if="editor.subtitles.length === 0" class="subtitle-list-empty">
          <base-empty size="small" :text="$t('OpWeb.Editor.NoSubtitles', '暂无字幕')">
            <template #desc>
              <span class="subtitle-empty-desc">
                {{ $t("OpWeb.Editor.SubtitleEmptyHint", "在上方填写内容并添加字幕") }}
              </span>
            </template>
          </base-empty>
        </div>
        <div
          v-for="s in editor.sortedSubtitles"
          :key="s.id"
          class="subtitle-item"
          :class="{ 'is-editing': editingId === s.id }"
          @click="handleEdit(s)"
        >
          <div class="subtitle-item-main">
            <span class="subtitle-item-time">{{ editor.fmt(s.startTime) }} – {{ editor.fmt(s.endTime) }}</span>
            <p
              class="subtitle-item-text"
              :style="{
                color: s.color,
                backgroundColor: s.backgroundColor ?? SUBTITLE_DEFAULT_BACKGROUND
              }"
            >
              {{ s.text }}
            </p>
          </div>
          <el-tooltip :content="$t('OpWeb.Common.Delete', '删除')" placement="top">
            <button class="subtitle-item-del" type="button" @click.stop="editor.delSub(s)">
              <el-icon><Delete /></el-icon>
            </button>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-subtitle-panel">
import { Delete } from "@element-plus/icons-vue";
import { reactive, ref, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";
import { type Subtitle, SUBTITLE_DEFAULT_BACKGROUND, SUBTITLE_TEXT_MAX_LENGTH } from "@/interface/project";

const editor = useMovieEditorContext();
const $t = useTranslate();
const editingId = ref<string | null>(null);

const subForm = reactive({
  startTime: editor.subForm.startTime,
  endTime: editor.subForm.endTime,
  text: editor.subForm.text,
  color: editor.subForm.color,
  backgroundColor: editor.subForm.backgroundColor
});

const syncToEditor = () => {
  editor.subForm.startTime = subForm.startTime;
  editor.subForm.endTime = subForm.endTime;
  editor.subForm.text = subForm.text;
  editor.subForm.color = subForm.color;
  editor.subForm.backgroundColor = subForm.backgroundColor;
  editor.subForm.displayMode = "fadeIn";
};

const handleSubmit = () => {
  syncToEditor();
  editor.addOrUpdateSub();
  subForm.startTime = editor.subForm.startTime;
  subForm.endTime = editor.subForm.endTime;
  subForm.text = editor.subForm.text;
  subForm.color = editor.subForm.color;
  subForm.backgroundColor = editor.subForm.backgroundColor;
  editingId.value = null;
};

const handleEdit = (s: Subtitle) => {
  editingId.value = s.id;
  subForm.startTime = s.startTime;
  subForm.endTime = s.endTime;
  subForm.text = s.text;
  subForm.color = s.color;
  subForm.backgroundColor = s.backgroundColor ?? SUBTITLE_DEFAULT_BACKGROUND;
  editor.editSub(s);
};

watch(subForm, syncToEditor, { deep: true });
</script>
