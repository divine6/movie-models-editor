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
              :min="0"
              :max="editor.duration"
              :step="0.1"
              :controls="false"
              size="small"
            />
          </div>
          <div class="chapter-form-field">
            <label class="chapter-field-label">{{ $t("OpWeb.Editor.EndTime", "结束时间") }}</label>
            <el-input-number
              v-model="chapterForm.endTime"
              :min="0"
              :max="editor.duration"
              :step="0.1"
              :controls="false"
              size="small"
            />
          </div>
        </div>
        <div class="chapter-form-field">
          <label class="chapter-field-label">{{ $t("OpWeb.Editor.ParentChapter", "父节点") }}</label>
          <el-select
            v-model="chapterForm.parentId"
            clearable
            filterable
            size="small"
            :placeholder="$t('OpWeb.Editor.NoParentChapter', '无（顶层节点）')"
          >
            <el-option
              v-for="opt in parentOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
        </div>
      </div>

      <div class="detail-section chapter-camera-section">
        <div class="detail-section-title">{{ $t("OpWeb.Editor.Camera", "镜头") }}</div>

        <div class="chapter-cam-group">
          <div class="chapter-cam-group-label">{{ $t("OpWeb.Editor.CameraPosition", "相机位置") }}</div>
          <div class="chapter-cam-grid chapter-cam-grid--3">
            <div class="chapter-cam-field">
              <label class="chapter-axis-label">X</label>
              <el-input-number v-model="cameraForm.posX" :step="0.05" :controls="false" size="small" />
            </div>
            <div class="chapter-cam-field">
              <label class="chapter-axis-label">Y</label>
              <el-input-number v-model="cameraForm.posY" :step="0.05" :controls="false" size="small" />
            </div>
            <div class="chapter-cam-field">
              <label class="chapter-axis-label">Z</label>
              <el-input-number v-model="cameraForm.posZ" :step="0.05" :controls="false" size="small" />
            </div>
          </div>
        </div>

        <div class="chapter-cam-group">
          <div class="chapter-cam-group-label">{{ $t("OpWeb.Editor.CameraTarget", "观察目标") }}</div>
          <div class="chapter-cam-grid chapter-cam-grid--3">
            <div class="chapter-cam-field">
              <label class="chapter-axis-label">X</label>
              <el-input-number v-model="cameraForm.targetX" :step="0.05" :controls="false" size="small" />
            </div>
            <div class="chapter-cam-field">
              <label class="chapter-axis-label">Y</label>
              <el-input-number v-model="cameraForm.targetY" :step="0.05" :controls="false" size="small" />
            </div>
            <div class="chapter-cam-field">
              <label class="chapter-axis-label">Z</label>
              <el-input-number v-model="cameraForm.targetZ" :step="0.05" :controls="false" size="small" />
            </div>
          </div>
        </div>

        <div class="chapter-fov-field">
          <label class="chapter-field-label">{{ $t("OpWeb.Editor.Fov", "FOV") }}</label>
          <div class="chapter-fov-row">
            <el-slider v-model="cameraForm.fov" :min="20" :max="120" :step="1" size="small" />
            <el-input-number
              v-model="cameraForm.fov"
              :min="20"
              :max="120"
              :step="1"
              :controls="false"
              size="small"
              class="chapter-fov-input"
            />
          </div>
        </div>

        <div class="chapter-form-field chapter-transition-field">
          <label class="chapter-field-label">{{ $t("OpWeb.Editor.CameraTransitionSec", "运镜时长（秒）") }}</label>
          <el-input-number
            v-model="cameraForm.transitionSec"
            :min="0.1"
            :max="10"
            :step="0.1"
            :precision="1"
            :controls="false"
            size="small"
          />
        </div>

        <el-button class="chapter-capture-btn" size="small" type="primary" plain @click="editor.captureCam">
          {{ $t("OpWeb.Editor.CaptureCamera", "捕获当前视角") }}
        </el-button>
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
  endTime: 0,
  parentId: undefined as string | undefined
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
  const chapterId = unref(editor.selectedChapterId);
  if (!chapterId) return null;
  return editor.chapters.find(ch => ch.id === chapterId) ?? null;
});

const parentOptions = computed(() => {
  const ch = activeChapter.value;
  if (!ch) return [];
  return editor.getChapterParentOptions(ch.id);
});

const syncForms = () => {
  const ch = activeChapter.value;
  if (!ch) return;

  isSyncingChapterForm = true;
  isSyncingCameraForm = true;
  Object.assign(chapterForm, {
    name: ch.name,
    startTime: ch.startTime,
    endTime: ch.endTime,
    parentId: ch.parentId
  });
  Object.assign(cameraForm, {
    posX: ch.camera.position[0],
    posY: ch.camera.position[1],
    posZ: ch.camera.position[2],
    targetX: ch.camera.target[0],
    targetY: ch.camera.target[1],
    targetZ: ch.camera.target[2],
    fov: ch.camera.fov,
    transitionSec: ch.camera.transitionSec ?? 0.5
  });
  queueMicrotask(() => {
    isSyncingChapterForm = false;
    isSyncingCameraForm = false;
  });
};

watch(() => [editor.selectedChapterId, editor.chapterFormRevision, editor.cameraFormRevision] as const, syncForms, {
  immediate: true
});

watch(
  chapterForm,
  () => {
    if (isSyncingChapterForm || editor.chapterNavLock) return;
    editor.applyChapterFormSnapshot({ ...chapterForm });
    editor.saveChF();
  },
  { deep: true }
);

watch(
  cameraForm,
  () => {
    if (isSyncingCameraForm) return;
    editor.applyCameraFormSnapshot({ ...cameraForm });
    const ch = activeChapter.value;
    if (ch) {
      ch.camera.position = [cameraForm.posX, cameraForm.posY, cameraForm.posZ];
      ch.camera.target = [cameraForm.targetX, cameraForm.targetY, cameraForm.targetZ];
      ch.camera.fov = cameraForm.fov;
      ch.camera.transitionSec = cameraForm.transitionSec;
    }
  },
  { deep: true }
);
</script>
