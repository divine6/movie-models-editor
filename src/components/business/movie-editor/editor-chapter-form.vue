<template>
  <div v-if="activeChapter" class="chapter-detail-panel">
    <div class="chapter-detail-scroll">
      <div class="detail-section chapter-info-section">
        <div class="chapter-form-field">
          <label class="chapter-field-label">{{ $t("OpWeb.Common.Name", "名称") }}</label>
          <el-input v-model="chapterForm.name" size="small" :placeholder="$t('OpWeb.Common.Name', '名称')" />
        </div>
        <div class="chapter-form-row chapter-form-row--2">
          <div class="chapter-form-field">
            <label class="chapter-field-label">{{ $t("OpWeb.Editor.StartTime", "开始时间") }}</label>
            <el-input-number
              v-model="chapterForm.startTime"
              :min="editor.selectedChapterTimeBounds.startMin"
              :max="editor.selectedChapterTimeBounds.startMax"
              :step="0.1"
              :controls="false"
              size="small"
            />
          </div>
          <div class="chapter-form-field">
            <label class="chapter-field-label">{{ $t("OpWeb.Editor.EndTime", "结束时间") }}</label>
            <el-input-number
              v-model="chapterForm.endTime"
              :min="editor.selectedChapterTimeBounds.endMin"
              :max="editor.selectedChapterTimeBounds.endMax"
              :step="0.1"
              :controls="false"
              size="small"
            />
          </div>
        </div>
        <p v-if="isChildChapter" class="chapter-time-hint">
          {{ $t("OpWeb.Editor.ChildChapterTimeHint", "子节点时间限制在父节点范围内，且不能与同级节点重叠") }}
        </p>
      </div>

      <div class="detail-section chapter-camera-section is-collapsed-hint">
        <p class="chapter-cam-moved-hint">运镜请在下方各「片段」中捕获；此处仅保留动画在视频上的起止时间。</p>
      </div>
    </div>
  </div>
  <div v-else class="chapter-detail-empty">
    {{ $t("OpWeb.Editor.SelectChapterHint", "选择一个节点开始编辑") }}
  </div>
</template>

<script setup lang="ts" name="editor-chapter-form">
import { computed, reactive, unref, watch } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const $t = useTranslate();

const chapterForm = reactive({
  name: "",
  startTime: 0,
  endTime: 0
});

const cameraForm = reactive({
  posX: 0,
  posY: 0,
  posZ: 0,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  fov: 50,
  transitionSec: 0.5
});

let isSyncingChapterForm = false;
let isSyncingCameraForm = false;

const activeChapter = computed(() => {
  const chapterId = unref(editor.selectedChapterId) || unref(editor.selectedNodeId);
  if (!chapterId) return null;
  const fromChapters = editor.chapters.find(ch => ch.id === chapterId);
  if (fromChapters) return fromChapters;
  // 兜底：selectedChapterId 尚未跟上时，用树选中的动画节点
  const node = editor.nodes.find(n => n.id === chapterId);
  return node?.type === "animation" ? node : null;
});

const isChildChapter = computed(() => !!activeChapter.value?.parentId);
const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

const syncForms = () => {
  const ch = activeChapter.value;
  if (!ch) return;

  isSyncingChapterForm = true;
  isSyncingCameraForm = true;
  Object.assign(chapterForm, {
    name: ch.name,
    startTime: ch.startTime,
    endTime: ch.endTime
  });
  Object.assign(cameraForm, {
    posX: round3(ch.camera.position[0]),
    posY: round3(ch.camera.position[1]),
    posZ: round3(ch.camera.position[2]),
    targetX: round3(ch.camera.target[0]),
    targetY: round3(ch.camera.target[1]),
    targetZ: round3(ch.camera.target[2]),
    fov: Math.min(60, Math.max(10, ch.camera.fov)),
    transitionSec: ch.camera.transitionSec ?? cameraForm.transitionSec ?? 0.5
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        isSyncingChapterForm = false;
        isSyncingCameraForm = false;
      }, 80);
    });
  });
};

watch(() => [editor.selectedChapterId, editor.selectedNodeId, editor.chapterFormRevision, editor.cameraFormRevision] as const, syncForms, {
  immediate: true
});

watch(
  chapterForm,
  () => {
    if (isSyncingChapterForm || unref(editor.chapterNavLock)) return;
    editor.applyChapterFormSnapshot({ ...chapterForm });
    editor.saveChF();
  },
  { deep: true }
);
</script>
