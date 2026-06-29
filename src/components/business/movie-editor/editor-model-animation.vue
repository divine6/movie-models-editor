<template>
  <div v-if="editor.mAni && currentSegment" class="model-animation">
    <div class="md-section-divider" />
    <div class="md-group">
      <div class="md-group-title">
        <span>{{ $t("OpWeb.Editor.Animation", "动画") }}</span>
        <div class="md-anim-actions">
          <button
            class="seg-btn seg-btn-play md-anim-play-btn"
            type="button"
            :disabled="currentSegment._playing"
            @click="editor.playSegOnce(currentSegment)"
          >
            {{ currentSegment._playing ? "播放中..." : "播放" }}
          </button>
          <button
            class="seg-btn seg-btn-play md-anim-play-btn md-anim-save-btn"
            type="button"
            :disabled="currentSegment._playing || !editor.animDirty"
            @click="editor.saveAnimConfig"
          >
            {{ $t("OpWeb.Editor.Save", "保存") }}
          </button>
          <button class="seg-btn md-anim-reset-btn" type="button" :disabled="currentSegment._playing" @click="onResetAnim">
            重置
          </button>
        </div>
      </div>

      <div class="kf-timeline">
        <div class="seg-card">
          <div class="seg-card-head">
            <div class="seg-card-head-row">
              <span class="seg-info" @click.stop>
                待机
                <el-input-number
                  v-model="currentSegment.pauseTime"
                  :min="0"
                  :max="10"
                  :step="0.5"
                  :controls="false"
                  size="small"
                  style="width: 50px"
                />s
              </span>
              <span class="seg-info" @click.stop>
                动画
                <el-input-number
                  v-model="currentSegment.animTime"
                  :min="0.5"
                  :max="30"
                  :step="0.5"
                  :controls="false"
                  size="small"
                  style="width: 50px"
                />s
              </span>
              <span class="seg-info seg-easing-info" @click.stop>
                曲线
                <el-select
                  v-model="currentSegment.easing"
                  size="small"
                  class="seg-easing-select"
                  @change="onEasingChange(currentSegment)"
                >
                  <el-option v-for="cv in editor.EASING_LIST" :key="cv" :label="editor.CURVE_LABELS[cv] || cv" :value="cv" />
                </el-select>
              </span>
            </div>
          </div>

          <div class="seg-card-body">
            <el-collapse v-model="currentSegment._expandedPanels" class="seg-transform-collapse">
              <el-collapse-item name="start" title="起始状态">
                <editor-segment-transform :seg="currentSegment" mode="start" />
              </el-collapse-item>
              <el-collapse-item name="end" title="结束状态">
                <editor-segment-transform :seg="currentSegment" mode="end" />
              </el-collapse-item>
            </el-collapse>

            <div class="seg-pivot-field">
              <label class="seg-transform-label">{{ $t("OpWeb.Editor.Pivot", "旋转中心点") }}</label>
              <el-select v-model="currentSegment.pivot" size="small" @change="onPivotChange(currentSegment)">
                <el-option :label="$t('OpWeb.Editor.PivotCenter', '中心 Center')" value="center" />
                <el-option :label="$t('OpWeb.Editor.PivotTop', '上方 Top')" value="top" />
                <el-option :label="$t('OpWeb.Editor.PivotBottom', '下方 Bottom')" value="bottom" />
                <el-option :label="$t('OpWeb.Editor.PivotLeft', '左方 Left')" value="left" />
                <el-option :label="$t('OpWeb.Editor.PivotRight', '右方 Right')" value="right" />
                <el-option :label="$t('OpWeb.Editor.PivotFront', '前方 Front')" value="front" />
                <el-option :label="$t('OpWeb.Editor.PivotBack', '后方 Back')" value="back" />
              </el-select>
            </div>
          </div>

          <div v-if="currentSegment._playing" class="seg-progress">
            <div class="seg-progress-bar" :style="{ width: (currentSegment._progress || 0) * 100 + '%' }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-model-animation">
import { ElMessageBox } from "element-plus";
import { computed, unref, watch } from "vue";

import EditorSegmentTransform from "@/components/business/movie-editor/editor-segment-transform.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

export interface ModelTransformFormData {
  posOffsetX: number;
  posOffsetY: number;
  posOffsetZ: number;
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

const props = defineProps<{
  formData: ModelTransformFormData;
  onApply: (field: string) => void;
}>();

const editor = useMovieEditorContext();
const $t = useTranslate();

const currentSegment = computed(() => editor.animSegments[0] ?? null);

let lastUserSig = "";
let sigReady = false;
const buildUserSig = (seg: any) => {
  if (!seg) return "";
  return JSON.stringify({
    pauseTime: seg.pauseTime ?? 0,
    animTime: seg.animTime ?? 3,
    easing: seg.easing ?? "easeInOut",
    pivot: seg.pivot ?? "center",
    startPos: seg.startPos ?? [0, 0, 0],
    endPos: seg.endPos ?? [0, 0, 0],
    startScale: seg.startScale ?? 1,
    endScale: seg.endScale ?? 1,
    startRot: seg.startRot ?? [0, 0, 0],
    endRot: seg.endRot ?? [0, 0, 0]
  });
};

watch(
  currentSegment,
  seg => {
    if (!seg) return;
    if (!seg._expandedPanels) seg._expandedPanels = ["start", "end"];
    if (!seg.easing) seg.easing = "easeInOut";

    // baseline signature for dirty detection
    lastUserSig = buildUserSig(seg);
    sigReady = true;
  },
  { immediate: true }
);

watch(
  () => unref(editor.animSegmentRevision),
  () => {
    sigReady = false;
    lastUserSig = buildUserSig(unref(currentSegment));
    sigReady = true;
  }
);

watch(
  () => buildUserSig(unref(currentSegment)),
  sig => {
    if (!sigReady) return;
    if (!sig || sig === lastUserSig) return;
    lastUserSig = sig;
    editor.markAnimDirty();
  }
);

watch(
  () => unref(editor.animDirty),
  dirty => {
    // 保存后（dirty=false）把当前值作为新的基线，避免再次误判
    if (!dirty) lastUserSig = buildUserSig(unref(currentSegment));
  }
);

const onEasingChange = (seg: Record<string, any>) => {
  if (!seg.easing) seg.easing = "easeInOut";
  editor.markAnimDirty();
};

const onPivotChange = (seg: Record<string, any>) => {
  const editingSeg = unref(editor.editingSeg);
  const mode = editingSeg?.id === seg.id ? (unref(editor.editingSegMode) as "start" | "end") : "start";
  editor.onPivotChange(seg, mode);
};

const onResetAnim = async () => {
  const seg = unref(currentSegment);
  if (!seg || seg._playing) return;
  try {
    await ElMessageBox.confirm("确认重置当前动画？未保存的修改将丢失。", "提示", {
      type: "warning",
      confirmButtonText: "确认重置",
      cancelButtonText: "取消"
    });
    editor.resetAnimConfig();
  } catch {
    // cancelled
  }
};
</script>

<style lang="scss">
.movie-editor .model-animation {
  .md-group-title {
    margin-bottom: 10px;
  }

  .md-anim-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .md-anim-play-btn {
    flex-shrink: 0;
    min-width: 56px;
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 500;
    line-height: 22px;
    color: #4ade80;
    border-color: rgb(74 222 128 / 35%);
    background: #143024;

    &:hover:not(:disabled) {
      color: #6ee7a0;
      background: rgb(20 48 36 / 92%);
      border-color: rgb(74 222 128 / 50%);
    }

    &:disabled {
      opacity: 0.72;
      cursor: default;
    }
  }

      .md-anim-reset-btn {
    flex-shrink: 0;
    min-width: 56px;
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 500;
    line-height: 22px;
    color: rgb(255 255 255 / 72%);
    border: 1px solid rgb(255 255 255 / 14%);
    background: rgb(255 255 255 / 6%);

    &:hover:not(:disabled) {
      color: #fff;
      border-color: rgb(255 255 255 / 22%);
      background: rgb(255 255 255 / 10%);
    }

    &:disabled {
      opacity: 0.72;
      cursor: default;
    }
  }

  .anim-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
    padding: 0 12px 12px;

    .el-button {
      flex: 1;
    }
  }

  .seg-transform-collapse {
    border: none;

    .el-collapse-item__header {
      height: 32px;
      min-height: 32px;
      padding: 0 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-color-2);
      background: transparent;
      border: none;
    }

    .el-collapse-item__wrap {
      border: none;
    }

    .el-collapse-item__content {
      padding: 0 2px 8px;
    }
  }

  .seg-pivot-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 6px;
  }

  .seg-transform-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-color-3);
  }

  .seg-card-head {
    padding: 8px;
    cursor: pointer;
    font-size: 11px;

    &:hover {
      background: var(--fill-color-2);
    }
  }

  .seg-card-head-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding-right: 2px;
  }

  .seg-card-body {
    padding: 0 8px 8px;
    border-top: 1px solid var(--border-color-1);
  }

  .seg-easing-info {
    align-items: center;
  }

  .seg-easing-select {
    width: 88px;
  }
}
</style>
