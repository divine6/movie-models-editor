<template>
  <div v-if="editor.mAni && editor.animSegments.length" class="model-animation" :class="{ 'is-embedded': embedded, 'is-clip-bound': clipBound }">
    <div v-if="!embedded" class="md-section-divider" />
    <div class="md-group">
      <div class="md-group-title" v-if="!clipBound">
        <span>{{ embedded ? "当前轨道片段" : $t("OpWeb.Editor.Animation", "动画") }}</span>
        <div class="md-anim-actions">
          <button
            class="seg-btn seg-btn-play md-anim-play-btn"
            type="button"
            :disabled="isPlaying"
            @click="editor.playTrackOnce()"
          >
            {{ isPlaying ? "播放中..." : embedded ? "播放本轨" : "播放整轨" }}
          </button>
          <button
            v-if="!embedded"
            class="seg-btn seg-btn-play md-anim-play-btn md-anim-save-btn"
            type="button"
            :disabled="isPlaying || !editor.animDirty"
            @click="onSave"
          >
            {{ $t("OpWeb.Editor.Save", "保存") }}
          </button>
          <button class="seg-btn md-anim-reset-btn" type="button" :disabled="isPlaying" @click="onResetAnim">
            重置
          </button>
        </div>
      </div>

      <div v-if="clipBound && currentSeg" class="md-clip-bound-head">
        <span class="md-clip-bound-title">
          编辑
          <em v-if="multiSelectCount > 1" class="md-clip-multi">已选 {{ multiSelectCount }} · 同步改</em>
        </span>
        <button class="seg-btn md-anim-reset-btn" type="button" :disabled="isPlaying" @click="onResetAnim">重置</button>
      </div>

      <div v-if="!clipBound && embedded" class="md-anim-meta">
        <span>本轨 {{ trackDuration.toFixed(1) }}s</span>
        <span>动画 {{ animationDurationSec.toFixed(1) }}s</span>
      </div>
      <div v-else-if="!clipBound" class="md-anim-meta">
        <span>动画 {{ animationDurationSec.toFixed(1) }}s</span>
        <span>本轨 {{ trackDuration.toFixed(1) }}s</span>
      </div>

      <template v-if="!clipBound">
        <div class="kf-timeline-bar" :title="`0 – ${barScaleSec.toFixed(1)}s`">
          <div
            v-for="(seg, idx) in editor.animSegments"
            :key="seg.id + '-bar'"
            class="kf-timeline-clip"
            :class="{ 'is-active': selectedSegId === seg.id }"
            :style="clipBarStyle(seg)"
            @click="selectSeg(seg)"
          >
            {{ idx + 1 }}
          </div>
        </div>

        <div class="kf-timeline-toolbar">
          <button class="seg-btn md-anim-add-btn" type="button" :disabled="isPlaying" @click="onAddSegment">
            + 添加片段
          </button>
          <span v-if="currentSeg" class="kf-timeline-hint">编辑片段 {{ currentSegIndex + 1 }} / {{ editor.animSegments.length }}</span>
        </div>
      </template>

      <!-- 片段中心模式：外观置顶 + 起止切换，少点几下 -->
      <div v-if="clipBound && currentSeg" class="md-clip-editor">
        <div class="md-section">
          <div class="md-section-title">外观</div>
          <div class="md-visual-grid">
            <label class="md-visual-item">
              <span>显示</span>
              <el-switch
                :model-value="clipVisual.visible"
                size="small"
                :disabled="isPlaying"
                @update:model-value="v => onClipVisualField('visible', v)"
              />
            </label>
            <label class="md-visual-item">
              <span>轮廓</span>
              <el-switch
                :model-value="clipVisual.outline"
                size="small"
                :disabled="isPlaying"
                @update:model-value="v => onClipVisualField('outline', v)"
              />
            </label>
            <label class="md-visual-item">
              <span>线框</span>
              <el-switch
                :model-value="clipVisual.wireframe"
                size="small"
                :disabled="isPlaying"
                @update:model-value="v => onClipVisualField('wireframe', v)"
              />
            </label>
            <label class="md-visual-item">
              <span>高亮</span>
              <el-switch
                :model-value="clipVisual.highlight"
                size="small"
                :disabled="isPlaying"
                @update:model-value="v => onClipVisualField('highlight', v)"
              />
            </label>
          </div>
          <button type="button" class="seg-visual-more" @click="showExtraVisual = !showExtraVisual">
            {{ showExtraVisual ? "收起颜色 / 介绍" : "颜色与介绍…" }}
          </button>
          <div v-if="showExtraVisual" class="md-visual-extra">
            <div class="model-highlight-color-row">
              <span class="model-switch-label">轮廓色</span>
              <el-color-picker
                :model-value="clipVisual.outlineColor"
                size="small"
                :disabled="isPlaying || !clipVisual.outline"
                @update:model-value="v => onClipVisualField('outlineColor', v || clipVisual.outlineColor)"
              />
            </div>
            <div class="model-highlight-color-row">
              <span class="model-switch-label">线框色</span>
              <el-color-picker
                :model-value="clipVisual.wireframeColor"
                size="small"
                :disabled="isPlaying || !clipVisual.wireframe"
                @update:model-value="v => onClipVisualField('wireframeColor', v || clipVisual.wireframeColor)"
              />
            </div>
            <div class="model-highlight-color-row">
              <span class="model-switch-label">高亮色</span>
              <el-color-picker
                :model-value="clipVisual.modelHighlightColor"
                size="small"
                :disabled="isPlaying || !clipVisual.highlight"
                @update:model-value="v => onClipVisualField('modelHighlightColor', v || clipVisual.modelHighlightColor)"
              />
            </div>
            <div class="model-intro-field">
              <label class="model-intro-label">介绍</label>
              <el-input
                v-model="introDraft"
                type="textarea"
                :rows="2"
                resize="none"
                size="small"
                :disabled="isPlaying"
                placeholder="本片段播放时显示"
                @update:model-value="onIntroInput"
              />
            </div>
          </div>
        </div>

        <div class="md-section">
          <div class="md-section-title-row">
            <span class="md-section-title">姿态</span>
            <div class="md-pose-tabs" role="tablist">
              <button
                type="button"
                class="md-pose-tab"
                :class="{ 'is-active': poseMode === 'start' }"
                :disabled="isPlaying"
                @click="setPoseMode('start')"
              >
                起始
              </button>
              <button
                type="button"
                class="md-pose-tab"
                :class="{ 'is-active': poseMode === 'end' }"
                :disabled="isPlaying"
                @click="setPoseMode('end')"
              >
                结束
              </button>
            </div>
          </div>
          <div class="md-timing-row">
            <label class="md-timing-field">
              <span>间隔时间</span>
              <el-input-number
                :model-value="clipPauseTime"
                :min="0"
                :max="120"
                :step="0.1"
                :precision="2"
                :controls="false"
                size="small"
                :disabled="isPlaying"
                title="相对本片段起点的等待，与上方片段起止无关"
                @update:model-value="v => onClipTiming('pauseTime', v)"
              />
              <em>s</em>
            </label>
            <label class="md-timing-field">
              <span>起始→结束</span>
              <el-input-number
                :model-value="clipAnimTime"
                :min="0"
                :max="120"
                :step="0.1"
                :precision="2"
                :controls="false"
                size="small"
                :disabled="isPlaying"
                title="姿态插值时长（可与片段窗长不同）；可为 0（瞬移）"
                @update:model-value="v => onClipTiming('animTime', v)"
              />
              <em>s</em>
            </label>
          </div>
          <editor-segment-transform :seg="currentSeg" :mode="poseMode" />
        </div>

        <div class="md-section md-section-meta">
          <div class="md-meta-row">
            <label class="seg-transform-label">曲线</label>
            <el-select
              v-model="currentSeg.easing"
              size="small"
              class="seg-easing-select"
              :disabled="isPlaying"
              @change="onEasingChange(currentSeg)"
            >
              <el-option v-for="cv in editor.EASING_LIST" :key="cv" :label="editor.CURVE_LABELS[cv] || cv" :value="cv" />
            </el-select>
          </div>
          <div class="md-meta-row">
            <label class="seg-transform-label">旋转中心</label>
            <el-select v-model="currentSeg.pivot" size="small" :disabled="isPlaying" @change="onPivotChange(currentSeg)">
              <el-option :label="$t('OpWeb.Editor.PivotCenter', '中心')" value="center" />
              <el-option :label="$t('OpWeb.Editor.PivotTop', '上方')" value="top" />
              <el-option :label="$t('OpWeb.Editor.PivotBottom', '下方')" value="bottom" />
              <el-option :label="$t('OpWeb.Editor.PivotLeft', '左方')" value="left" />
              <el-option :label="$t('OpWeb.Editor.PivotRight', '右方')" value="right" />
              <el-option :label="$t('OpWeb.Editor.PivotFront', '前方')" value="front" />
              <el-option :label="$t('OpWeb.Editor.PivotBack', '后方')" value="back" />
            </el-select>
          </div>
        </div>

        <div v-if="currentSeg._playing" class="seg-progress">
          <div class="seg-progress-bar" :style="{ width: (currentSeg._progress || 0) * 100 + '%' }" />
        </div>
      </div>

      <!-- 非片段中心：保留原折叠编辑 -->
      <div v-else-if="currentSeg" class="kf-timeline">
        <div class="seg-card is-selected">
          <div class="seg-card-head">
            <div class="seg-card-head-row">
              <span class="seg-index">片段 {{ currentSegIndex + 1 }}</span>
              <span class="seg-info" @click.stop>
                开始
                <el-input-number
                  :model-value="currentSeg.start ?? 0"
                  :min="0"
                  :max="120"
                  :step="0.1"
                  :precision="1"
                  :controls="false"
                  size="small"
                  style="width: 52px"
                  :disabled="isPlaying"
                  @update:model-value="v => onTimeChange(currentSeg, 'start', v)"
                />s
              </span>
              <span class="seg-info" @click.stop>
                结束
                <el-input-number
                  :model-value="currentSeg.end ?? 0"
                  :min="0.1"
                  :max="120"
                  :step="0.1"
                  :precision="1"
                  :controls="false"
                  size="small"
                  style="width: 52px"
                  :disabled="isPlaying"
                  @update:model-value="v => onTimeChange(currentSeg, 'end', v)"
                />s
              </span>
              <span class="seg-info seg-easing-info" @click.stop>
                曲线
                <el-select
                  v-model="currentSeg.easing"
                  size="small"
                  class="seg-easing-select"
                  :disabled="isPlaying"
                  @change="onEasingChange(currentSeg)"
                >
                  <el-option v-for="cv in editor.EASING_LIST" :key="cv" :label="editor.CURVE_LABELS[cv] || cv" :value="cv" />
                </el-select>
              </span>
              <span class="seg-card-ops" @click.stop>
                <button
                  class="seg-icon-btn"
                  type="button"
                  title="上移"
                  :disabled="isPlaying || currentSegIndex <= 0"
                  @click="editor.moveAnimSegment(currentSeg.id, -1)"
                >
                  ↑
                </button>
                <button
                  class="seg-icon-btn"
                  type="button"
                  title="下移"
                  :disabled="isPlaying || currentSegIndex >= editor.animSegments.length - 1"
                  @click="editor.moveAnimSegment(currentSeg.id, 1)"
                >
                  ↓
                </button>
                <button
                  class="seg-icon-btn"
                  type="button"
                  title="播放此段"
                  :disabled="isPlaying"
                  @click="editor.playSegOnce(currentSeg)"
                >
                  ▶
                </button>
                <button
                  class="seg-icon-btn seg-icon-btn-danger"
                  type="button"
                  title="删除"
                  :disabled="isPlaying || editor.animSegments.length <= 1"
                  @click="onRemoveCurrent"
                >
                  ×
                </button>
              </span>
            </div>
          </div>

          <div class="seg-card-body">
            <el-collapse v-model="currentSeg._expandedPanels" class="seg-transform-collapse">
              <el-collapse-item name="start" title="起始姿态">
                <editor-segment-transform :seg="currentSeg" mode="start" />
              </el-collapse-item>
              <el-collapse-item name="end" title="结束姿态">
                <editor-segment-transform :seg="currentSeg" mode="end" />
              </el-collapse-item>
            </el-collapse>

            <div class="seg-clip-visual">
              <div class="seg-clip-visual-title">本片段外观</div>
              <div class="model-switch-row seg-clip-switch-row">
                <div class="model-switch-item">
                  <span class="model-switch-label">显示</span>
                  <el-switch
                    :model-value="clipVisual.visible"
                    size="small"
                    :disabled="isPlaying"
                    @update:model-value="v => onClipVisualField('visible', v)"
                  />
                </div>
                <div class="model-switch-item">
                  <span class="model-switch-label">轮廓</span>
                  <el-switch
                    :model-value="clipVisual.outline"
                    size="small"
                    :disabled="isPlaying"
                    @update:model-value="v => onClipVisualField('outline', v)"
                  />
                </div>
                <div class="model-switch-item">
                  <span class="model-switch-label">线框</span>
                  <el-switch
                    :model-value="clipVisual.wireframe"
                    size="small"
                    :disabled="isPlaying"
                    @update:model-value="v => onClipVisualField('wireframe', v)"
                  />
                </div>
                <div class="model-switch-item">
                  <span class="model-switch-label">高亮</span>
                  <el-switch
                    :model-value="clipVisual.highlight"
                    size="small"
                    :disabled="isPlaying"
                    @update:model-value="v => onClipVisualField('highlight', v)"
                  />
                </div>
              </div>
              <div class="model-highlight-color-row">
                <span class="model-switch-label">轮廓颜色</span>
                <el-color-picker
                  :model-value="clipVisual.outlineColor"
                  size="small"
                  :disabled="isPlaying || !clipVisual.outline"
                  @update:model-value="v => onClipVisualField('outlineColor', v || clipVisual.outlineColor)"
                />
              </div>
              <div class="model-highlight-color-row">
                <span class="model-switch-label">线框颜色</span>
                <el-color-picker
                  :model-value="clipVisual.wireframeColor"
                  size="small"
                  :disabled="isPlaying || !clipVisual.wireframe"
                  @update:model-value="v => onClipVisualField('wireframeColor', v || clipVisual.wireframeColor)"
                />
              </div>
              <div class="model-highlight-color-row">
                <span class="model-switch-label">高亮颜色</span>
                <el-color-picker
                  :model-value="clipVisual.modelHighlightColor"
                  size="small"
                  :disabled="isPlaying || !clipVisual.highlight"
                  @update:model-value="v => onClipVisualField('modelHighlightColor', v || clipVisual.modelHighlightColor)"
                />
              </div>
              <div class="model-intro-field">
                <label class="model-intro-label">模型介绍</label>
                <el-input
                  v-model="introDraft"
                  type="textarea"
                  :rows="2"
                  resize="none"
                  size="small"
                  :disabled="isPlaying"
                  placeholder="本片段播放时显示的介绍"
                  @update:model-value="onIntroInput"
                />
              </div>
            </div>

            <div class="seg-pivot-field">
              <label class="seg-transform-label">{{ $t("OpWeb.Editor.Pivot", "旋转中心点") }}</label>
              <el-select v-model="currentSeg.pivot" size="small" :disabled="isPlaying" @change="onPivotChange(currentSeg)">
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

          <div v-if="currentSeg._playing" class="seg-progress">
            <div class="seg-progress-bar" :style="{ width: (currentSeg._progress || 0) * 100 + '%' }" />
          </div>
        </div>
      </div>

      <div v-if="editor.totalPlaying" class="seg-progress seg-progress-track">
        <div class="seg-progress-bar" :style="{ width: (editor.totalProgress || 0) * 100 + '%' }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-model-animation">
import { ElMessageBox } from "element-plus";
import { computed, nextTick, ref, unref, watch } from "vue";

import EditorSegmentTransform from "@/components/business/movie-editor/editor-segment-transform.vue";
import {
  createDefaultClipVisual,
  type ClipVisualState
} from "@/composables/movie-editor/utils/animation";
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

const props = withDefaults(
  defineProps<{
    formData?: ModelTransformFormData;
    onApply?: (field: string) => void;
    /** 嵌在动画时间轴内时隐藏章节级分割线，文案改为轨道语境 */
    embedded?: boolean;
    /** 片段中心模式：隐藏多段时间轨，只编辑当前模型在本片段内的动作 */
    clipBound?: boolean;
  }>(),
  { embedded: false, clipBound: false }
);

const editor = useMovieEditorContext();
const $t = useTranslate();

const selectedSegId = ref<string | null>(null);
const showExtraVisual = ref(false);
const poseMode = ref<"start" | "end">("start");

const isPlaying = computed(
  () => !!unref(editor.totalPlaying) || editor.animSegments.some((s: any) => s._playing)
);

const currentSegIndex = computed(() =>
  editor.animSegments.findIndex((s: any) => s.id === selectedSegId.value)
);
const currentSeg = computed(() => {
  const idx = currentSegIndex.value;
  return idx >= 0 ? editor.animSegments[idx] : editor.animSegments[0] ?? null;
});

const clipVisual = computed<ClipVisualState>(() => {
  unref(editor.animClipListRevision);
  const seg = currentSeg.value;
  if (!seg) return createDefaultClipVisual();
  if (!seg.clipVisual) seg.clipVisual = createDefaultClipVisual();
  return createDefaultClipVisual(seg.clipVisual);
});

const introDraft = ref("");
watch(
  () => `${unref(editor.activeAnimClipId) ?? ""}:${currentSeg.value?.id ?? ""}`,
  () => {
    introDraft.value = currentSeg.value?.clipVisual?.intro ?? "";
  },
  { immediate: true }
);

const onIntroInput = (value: string) => {
  introDraft.value = value ?? "";
  editor.onAnimClipIntroChange(introDraft.value);
};

const multiSelectCount = computed(() => {
  unref(editor.activeClipSelectedKeySet);
  const keys = unref(editor.activeClipTargetKeys) || [];
  return keys.length || (unref(editor.activeClipTargetKey) ? 1 : 0);
});

const clipPauseTime = computed(() => {
  const seg = currentSeg.value;
  if (!seg) return 0;
  return typeof seg.pauseTime === "number" ? seg.pauseTime : 0;
});

const clipAnimTime = computed(() => {
  const seg = currentSeg.value;
  if (!seg) return 0.5;
  if (typeof seg.animTime === "number") return seg.animTime;
  return 0.5;
});

const onClipTiming = (field: "pauseTime" | "animTime", v: number | undefined) => {
  editor.updateActiveClipTiming(field, Number(v) || 0);
};

const animationDurationSec = computed(() => {
  unref(editor.animTrackListRevision);
  return editor.getAnimationContentDuration();
});
const trackDuration = computed(() => {
  const segs = editor.animSegments;
  if (!segs.length) return 0;
  const last = segs[segs.length - 1];
  return typeof last.end === "number" ? last.end : Number(unref(editor.animDuration)) || 0;
});
const barScaleSec = computed(() => Math.max(animationDurationSec.value, trackDuration.value, 0.1));

let lastUserSig = "";
let sigReady = false;
let baselineToken = 0;

const buildUserSig = () => {
  const segs = editor.animSegments;
  if (!segs.length) return "";
  return JSON.stringify(
    segs.map((seg: any) => ({
      id: seg.id,
      start: seg.start ?? 0,
      end: seg.end ?? 0,
      pauseTime: seg.pauseTime ?? 0,
      animTime: seg.animTime ?? 3,
      easing: seg.easing ?? "easeInOut",
      pivot: seg.pivot ?? "center",
      startPos: seg.startPos ?? [0, 0, 0],
      endPos: seg.endPos ?? [0, 0, 0],
      startScale: seg.startScale ?? 1,
      endScale: seg.endScale ?? 1,
      startRot: seg.startRot ?? [0, 0, 0],
      endRot: seg.endRot ?? [0, 0, 0],
      clipVisual: seg.clipVisual
        ? {
            visible: seg.clipVisual.visible,
            outline: seg.clipVisual.outline,
            wireframe: seg.clipVisual.wireframe,
            highlight: seg.clipVisual.highlight,
            outlineColor: seg.clipVisual.outlineColor,
            wireframeColor: seg.clipVisual.wireframeColor,
            modelHighlightColor: seg.clipVisual.modelHighlightColor
          }
        : null
    }))
  );
};

const resetDirtyBaseline = () => {
  const token = ++baselineToken;
  sigReady = false;
  lastUserSig = buildUserSig();
  nextTick(() => {
    if (token !== baselineToken) return;
    lastUserSig = buildUserSig();
    sigReady = true;
  });
};

watch(
  () => editor.animSegments.map((s: any) => s.id).join(","),
  () => {
    for (const seg of editor.animSegments) {
      if (!seg._expandedPanels) seg._expandedPanels = ["start", "end"];
      if (!seg.easing) seg.easing = "easeInOut";
    }
    if (!selectedSegId.value || !editor.animSegments.some((s: any) => s.id === selectedSegId.value)) {
      selectedSegId.value = editor.animSegments[0]?.id ?? null;
    }
    resetDirtyBaseline();
  },
  { immediate: true }
);

watch(
  () => unref(editor.animSegmentRevision),
  () => {
    resetDirtyBaseline();
    if (!selectedSegId.value || !editor.animSegments.some((s: any) => s.id === selectedSegId.value)) {
      selectedSegId.value = editor.animSegments[0]?.id ?? null;
    }
  }
);

watch(
  () => buildUserSig(),
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
    if (!dirty) lastUserSig = buildUserSig();
  }
);

const selectSeg = (seg: any) => {
  selectedSegId.value = seg.id;
  poseMode.value = "start";
  editor.focusSegTransform(seg, "start");
};

const setPoseMode = (mode: "start" | "end") => {
  poseMode.value = mode;
  const seg = currentSeg.value;
  if (seg) editor.focusSegTransform(seg, mode);
};

watch(
  () => unref(editor.editingSegMode),
  mode => {
    if (mode === "start" || mode === "end") poseMode.value = mode;
  }
);

const onAddSegment = () => {
  editor.addAnimSegment();
  const last = editor.animSegments[editor.animSegments.length - 1];
  if (last) selectSeg(last);
};

const onRemoveCurrent = () => {
  const seg = currentSeg.value;
  if (!seg) return;
  editor.removeAnimSegment(seg.id);
};

const clipBarStyle = (seg: any) => {
  const scale = barScaleSec.value || 1;
  const start = Math.max(0, seg.start ?? 0);
  const end = Math.max(start + 0.05, seg.end ?? start + 0.1);
  const left = (start / scale) * 100;
  const width = ((end - start) / scale) * 100;
  return {
    left: `${left}%`,
    width: `${Math.max(width, 1.5)}%`
  };
};

const onTimeChange = (seg: any, field: "start" | "end", value: number | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return;
  editor.onAnimClipTimeChange(seg, field, Number(value));
};

const onClipVisualField = (field: keyof ClipVisualState, value: any) => {
  if (field === "intro") {
    onIntroInput(value);
    return;
  }
  const seg = currentSeg.value;
  if (!seg) return;
  if (!seg.clipVisual) seg.clipVisual = createDefaultClipVisual();
  (seg.clipVisual as any)[field] = value;
  // 写回后再通知，保证 commit 读到最新值
  editor.onAnimClipVisualChange(seg);
};

const onEasingChange = (seg: Record<string, any>) => {
  if (!seg.easing) seg.easing = "easeInOut";
  editor.markAnimDirty();
};

const onPivotChange = (seg: Record<string, any>) => {
  const editingSeg = unref(editor.editingSeg);
  const mode = editingSeg?.id === seg.id ? (unref(editor.editingSegMode) as "start" | "end") : "start";
  editor.onPivotChange(seg, mode);
};

const onSave = () => {
  if (props.embedded) editor.saveActiveAnimTrack();
  else editor.saveAnimConfig();
};

const onResetAnim = async () => {
  if (isPlaying.value) return;
  try {
    await ElMessageBox.confirm("确认重置当前目标的全部片段？未保存的修改将丢失。", "提示", {
      type: "warning",
      confirmButtonText: "确认重置",
      cancelButtonText: "取消"
    });
    editor.resetAnimConfig();
    selectedSegId.value = editor.animSegments[0]?.id ?? null;
  } catch {
    // cancelled
  }
};
</script>

<style lang="scss">
.movie-editor .model-animation {
  .md-group-title {
    margin-bottom: 8px;
  }

  .md-anim-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .md-anim-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 11px;
    color: var(--text-color-3);

    .md-anim-meta-warn {
      color: #f59e0b;
    }
  }

  .md-clip-bound-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .md-clip-bound-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-1);

    .md-clip-multi {
      margin-left: 6px;
      font-style: normal;
      font-weight: 500;
      font-size: 11px;
      color: #86efac;
    }
  }

  .md-clip-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .md-section {
    padding: 8px;
    border-radius: 8px;
    background: rgb(255 255 255 / 4%);
    border: 1px solid rgb(255 255 255 / 7%);
  }

  .md-section-title {
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-color-3);
  }

  .md-section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;

    .md-section-title {
      margin-bottom: 0;
    }
  }

  .md-timing-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .md-timing-field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 11px;
    color: var(--text-color-3);

    > span {
      flex-shrink: 0;
      white-space: nowrap;
    }

    em {
      font-style: normal;
      color: var(--text-color-3);
    }

    .el-input-number {
      width: 64px;
    }

    &.md-timing-field-wide .el-input-number {
      width: 72px;
    }
  }

  .md-visual-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
  }

  .md-visual-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 30px;
    padding: 0 8px;
    border-radius: 6px;
    background: rgb(0 0 0 / 18%);
    font-size: 12px;
    color: var(--text-color-2);
    cursor: pointer;
  }

  .md-visual-extra {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .md-pose-tabs {
    display: inline-flex;
    padding: 2px;
    border-radius: 6px;
    background: rgb(0 0 0 / 25%);
    border: 1px solid rgb(255 255 255 / 10%);
  }

  .md-pose-tab {
    min-width: 52px;
    height: 26px;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 600;
    color: rgb(255 255 255 / 65%);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover:not(:disabled):not(.is-active) {
      color: #fff;
      background: rgb(255 255 255 / 8%);
    }

    &.is-active {
      color: #052e16;
      background: #4ade80;
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  .md-section-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .md-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .seg-transform-label {
      flex-shrink: 0;
      width: 56px;
      margin: 0;
    }

    .el-select {
      flex: 1;
    }
  }

  .seg-visual-more {
    margin-top: 6px;
    padding: 0;
    font-size: 11px;
    color: var(--text-color-3);
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: underline;

    &:hover {
      color: #4ade80;
    }
  }

  &.is-clip-bound {
    .seg-card {
      padding: 0;
      border: none;
      background: transparent;
    }
  }

  .kf-timeline-bar {
    position: relative;
    height: 22px;
    margin-bottom: 8px;
    border-radius: 4px;
    background: rgb(255 255 255 / 6%);
    border: 1px solid rgb(255 255 255 / 10%);
    overflow: hidden;
  }

  .kf-timeline-clip {
    position: absolute;
    top: 2px;
    bottom: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 14px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    color: rgb(255 255 255 / 45%);
    border-radius: 3px;
    background: rgb(255 255 255 / 8%);
    border: 1px solid rgb(255 255 255 / 12%);
    cursor: pointer;
    z-index: 1;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;

    &:hover:not(.is-active) {
      color: rgb(255 255 255 / 75%);
      background: rgb(255 255 255 / 14%);
      border-color: rgb(255 255 255 / 22%);
    }

    &.is-active {
      z-index: 2;
      color: #052e16;
      font-weight: 700;
      background: #4ade80;
      border-color: #86efac;
      box-shadow: 0 0 0 1px rgb(74 222 128 / 55%), 0 0 8px rgb(74 222 128 / 35%);
    }
  }

  .kf-timeline-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .kf-timeline-hint {
    font-size: 11px;
    color: var(--text-color-3);
  }

  .md-anim-add-btn {
    min-width: 72px;
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 500;
    line-height: 22px;
    color: rgb(255 255 255 / 85%);
    border: 1px solid rgb(255 255 255 / 16%);
    background: rgb(255 255 255 / 6%);

    &:hover:not(:disabled) {
      color: #fff;
      border-color: rgb(255 255 255 / 28%);
      background: rgb(255 255 255 / 10%);
    }
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

  .seg-card {
    margin-bottom: 8px;
    border: 1px solid var(--border-color-1);
    border-radius: 6px;
    background: rgb(255 255 255 / 3%);

    &.is-selected {
      border-color: rgb(74 222 128 / 35%);
    }
  }

  .seg-index {
    font-weight: 600;
    color: var(--text-color-2);
    margin-right: 4px;
  }

  .seg-card-ops {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }

  .seg-icon-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 12px;
    line-height: 20px;
    color: rgb(255 255 255 / 70%);
    border: 1px solid rgb(255 255 255 / 12%);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: #fff;
      border-color: rgb(255 255 255 / 28%);
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  .seg-icon-btn-danger:hover:not(:disabled) {
    color: #fca5a5;
    border-color: rgb(248 113 113 / 40%);
  }

  .seg-progress-track {
    margin-top: 6px;
  }

  .seg-clip-visual {
    margin-bottom: 10px;
    padding: 8px;
    border-radius: 6px;
    background: rgb(255 255 255 / 4%);
    border: 1px solid rgb(255 255 255 / 8%);
  }

  .seg-clip-visual-title {
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-color-2);
  }

  .seg-clip-switch-row {
    margin-bottom: 8px;
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
