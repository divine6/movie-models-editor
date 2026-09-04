<template>
  <div class="animation-timeline" data-testid="animation-timeline">
    <!-- 顶栏：主操作一排搞定 -->
    <div class="at-toolbar">
      <button class="at-btn at-btn-play" type="button" :disabled="isBusy" @click="editor.playAnimationClipsOnce()">
        ▶ 播放
      </button>
      <button
        class="at-btn at-btn-save"
        type="button"
        :disabled="isBusy || (!editor.animDirty && !savingClips)"
        @click="editor.saveAnimationClips()"
      >
        {{ savingClips ? `保存中 ${clipSavePct}%` : "保存" }}
      </button>
      <span class="at-toolbar-meta">
        <strong>{{ animDurationSec.toFixed(1) }}s</strong>
        <em v-if="editor.animDirty">未保存</em>
      </span>
    </div>

    <div v-if="isBusy" class="at-playhead">
      <div class="at-playhead-track">
        <div class="at-playhead-bar" :style="{ width: `${playProgressPct}%` }" />
      </div>
      <span class="at-playhead-time">{{ playElapsedLabel }} / {{ playDurationLabel }}</span>
    </div>

    <!-- 片段条：统一轨道，避免散落按钮 + 粗滚动条 -->
    <div class="at-clips">
      <div class="at-clips-label">片段</div>
      <div class="at-strip" title="点击切换 · + 新建">
        <button
          v-for="(c, idx) in clips"
          :key="c.id"
          type="button"
          class="at-chip"
          :class="{
            'is-active': c.id === activeClipId && !isBusy,
            'is-playing': isBusy && c.id === playingClipId
          }"
          :title="formatClipRange(c)"
          @click="editor.selectAnimationClip(c.id)"
        >
          <span class="at-chip-idx">{{ idx + 1 }}</span>
          <span
            v-if="(c.targetCount || 0) > 0"
            class="at-chip-n"
            :title="`${c.targetCount} 个已改模型`"
          >{{ c.targetCount }}</span>
          <span class="at-chip-x" title="删除" @click.stop="onRemoveClip(c)">×</span>
        </button>
        <button
          class="at-chip-add"
          type="button"
          :disabled="isBusy"
          title="添加片段"
          @click="editor.addAnimationClip()"
        >
          +
        </button>
      </div>
    </div>

    <div v-if="activeClip" class="at-edit">
      <!-- 当前片段：时间 + 运镜（运镜只在这里编辑，避免和模型面板重复） -->
      <div class="at-card at-card-clip">
        <div class="at-card-label">当前片段</div>
        <div class="at-row at-row-time">
          <label class="at-field-label">起</label>
          <el-input-number
            class="at-num"
            :model-value="activeClip.start"
            :min="0"
            :max="120"
            :step="0.1"
            :precision="2"
            :controls="false"
            size="small"
            :disabled="isBusy"
            title="片段在时间轴上的起点"
            @update:model-value="v => onClipTime('start', v)"
          />
          <span class="at-sep">→</span>
          <label class="at-field-label">止</label>
          <el-input-number
            class="at-num"
            :model-value="activeClip.end"
            :min="0"
            :max="120"
            :step="0.1"
            :precision="2"
            :controls="false"
            size="small"
            :disabled="isBusy"
            title="片段窗长结束时刻；必须播完本窗才进入下一片段"
            @update:model-value="v => onClipTime('end', v)"
          />
          <span class="at-unit">s</span>
        </div>

        <div class="at-cam">
          <div class="at-cam-head">
            <div class="at-cam-head-text">
              <span class="at-cam-title">运镜</span>
              <span class="at-cam-hint">播放时从上一段过渡到此镜头</span>
            </div>
            <button
              class="at-btn at-btn-cam"
              type="button"
              :disabled="isBusy"
              title="把当前视口写入本片段镜头"
              @click="editor.captureCameraToActiveClip()"
            >
              捕获视口
            </button>
          </div>
          <div class="at-cam-row">
            <label class="at-cam-field">
              <span>过渡</span>
              <el-input-number
                class="at-num at-num-cam"
                :model-value="clipCam.transitionSec"
                :min="0"
                :max="30"
                :step="0.1"
                :precision="2"
                :controls="false"
                size="small"
                :disabled="isBusy"
                title="本片段内镜头过渡时长，0 为瞬切"
                @update:model-value="v => onClipCam('transitionSec', v)"
              />
              <em>s</em>
            </label>
            <label class="at-cam-field">
              <span>FOV</span>
              <el-input-number
                class="at-num at-num-cam"
                :model-value="clipCam.fov"
                :min="20"
                :max="120"
                :step="1"
                :precision="0"
                :controls="false"
                size="small"
                :disabled="isBusy"
                @update:model-value="v => onClipCam('fov', v)"
              />
            </label>
          </div>
          <div class="at-cam-xyz">
            <span class="at-cam-xyz-label">位置</span>
            <label v-for="(axis, i) in camAxes" :key="'p' + axis" class="at-cam-axis">
              <span>{{ axis }}</span>
              <el-input-number
                class="at-num at-num-xyz"
                :model-value="clipCam.position[i]"
                :step="0.1"
                :precision="3"
                :controls="false"
                size="small"
                :disabled="isBusy"
                @update:model-value="v => onClipCamAxis('position', i, v)"
              />
            </label>
          </div>
          <div class="at-cam-xyz">
            <span class="at-cam-xyz-label">目标</span>
            <label v-for="(axis, i) in camAxes" :key="'t' + axis" class="at-cam-axis">
              <span>{{ axis }}</span>
              <el-input-number
                class="at-num at-num-xyz"
                :model-value="clipCam.target[i]"
                :step="0.1"
                :precision="3"
                :controls="false"
                size="small"
                :disabled="isBusy"
                @update:model-value="v => onClipCamAxis('target', i, v)"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- 模型列表 -->
      <div class="at-card at-card-models">
        <div class="at-models-head">
          <span class="at-models-title">
            本片段模型
            <em v-if="selectedCount > 0" class="at-sel-count">{{ selectedCount }} 选中</em>
          </span>
          <button
            v-if="selectedCount > 0"
            type="button"
            class="at-link-btn"
            :disabled="isBusy"
            @click="editor.removeSelectedClipTargets()"
          >
            移除
          </button>
        </div>

        <div v-if="listItems.length" class="at-model-list">
          <button
            v-for="item in visibleListItems"
            :key="item.key"
            type="button"
            class="at-model-row"
            :class="{
              'is-active': item.key === activeTargetKey,
              'is-selected': item.selected,
              'is-draft': item.draft && !item.committed,
              'is-model-root': item.isModelRoot
            }"
            :style="{ paddingLeft: `${10 + item.depth * 12}px` }"
            :title="item.fullLabel + (item.depth ? '' : ' · Shift多选 / Ctrl点选')"
            @click="onTargetClick(item, $event)"
          >
            <span class="at-model-check" :class="{ on: item.selected }" />
            <span class="at-model-name">{{ item.label }}</span>
            <span v-if="item.committed" class="at-badge">已改</span>
            <span v-else-if="item.draft" class="at-badge at-badge-draft">编辑中</span>
            <span v-else-if="item.selected" class="at-badge at-badge-sel">选中</span>
            <span
              v-if="item.committed"
              class="at-chip-x"
              title="移出本片段"
              @click.stop="editor.removeClipTarget(item.modelId, item.nodeId)"
            >
              ×
            </span>
          </button>
          <button
            v-if="committedTargetCount > LIST_SOFT_CAP && !listExpanded"
            type="button"
            class="at-link-btn at-list-more"
            @click="listExpanded = true"
          >
            展开全部 {{ committedTargetCount }} 项（当前仅显示 {{ LIST_SOFT_CAP }}）
          </button>
        </div>
        <p v-else class="at-hint-empty">在视口或右侧树点选模型，改姿态/外观后会标「已改」</p>
      </div>

      <!-- 姿态 / 外观编辑 -->
      <div v-if="showEditor" class="at-card at-card-editor">
        <editor-model-animation embedded clip-bound />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-animation-timeline">
import { ElMessageBox } from "element-plus";
import { computed, ref, unref, watch } from "vue";

import EditorModelAnimation from "@/components/business/movie-editor/editor-model-animation.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();
const LIST_SOFT_CAP = 40;
const listExpanded = ref(false);

const savingClips = computed(() => !!unref(editor.savingClips));
const clipSavePct = computed(() => Math.max(0, Math.min(100, Number(unref(editor.persistPercent) || 0))));
const isBusy = computed(
  () =>
    !!unref(editor.totalPlaying) ||
    savingClips.value ||
    !!unref(editor.savingScene) ||
    editor.animSegments.some((s: any) => s._playing)
);

const playProgressPct = computed(() => {
  const p = Number(unref(editor.totalProgress) || 0);
  return Math.max(0, Math.min(100, p * 100));
});

const playElapsedLabel = computed(() => {
  const t = Number(unref(editor.clipPlayElapsed) || 0);
  return `${t.toFixed(1)}s`;
});

const playDurationLabel = computed(() => {
  const t = Number(unref(editor.clipPlayDuration) || animDurationSec.value || 0);
  return `${Math.max(0.1, t).toFixed(1)}s`;
});

const playingClipId = computed(() => {
  if (!isBusy.value) return null;
  unref(editor.animClipListRevision);
  const elapsed = Number(unref(editor.clipPlayElapsed) || 0);
  const list = clips.value || [];
  if (!list.length) return null;
  const sorted = list.map((c, i) => ({ c, i })).sort((a, b) => (a.c.start ?? 0) - (b.c.start ?? 0) || a.i - b.i);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i].c;
    const start = c.start ?? 0;
    const end = c.end ?? start;
    const isLast = i === sorted.length - 1;
    if (end - start <= 1e-8) continue;
    if (elapsed + 1e-8 >= start && (isLast ? elapsed <= end + 1e-8 : elapsed < end - 1e-8)) return c.id;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const c = sorted[i].c;
    if ((c.end ?? 0) - (c.start ?? 0) > 1e-8) return c.id;
  }
  return sorted[0]?.c.id ?? null;
});

const animDurationSec = computed(() => {
  unref(editor.animClipListRevision);
  return editor.getAnimationContentDuration();
});

const clips = computed(() => {
  unref(editor.animClipListRevision);
  return editor.listAnimationClips();
});

const activeClipId = computed(() => unref(editor.activeAnimClipId));
const activeTargetKey = computed(() => unref(editor.activeClipTargetKey));
const selectedKeys = computed(() => unref(editor.activeClipTargetKeys) || []);
const draftKey = computed(() => unref(editor.clipDraftTargetKey));

const activeClip = computed(() => {
  unref(editor.animClipListRevision);
  return editor.getActiveAnimationClip();
});

const selectedCount = computed(() => {
  unref(editor.animClipListRevision);
  if (selectedKeys.value.length) return selectedKeys.value.length;
  return activeTargetKey.value ? 1 : 0;
});

const showEditor = computed(
  () => !!activeTargetKey.value && editor.animSegments.length > 0
);

type ClipListItem = {
  key: string;
  modelId: string;
  nodeId: string | null;
  label: string;
  fullLabel: string;
  depth: number;
  selected: boolean;
  draft: boolean;
  committed: boolean;
  isModelRoot: boolean;
};

const committedTargetCount = computed(() => {
  unref(editor.animClipListRevision);
  return activeClip.value?.targets?.length || 0;
});

const listItems = computed(() => {
  unref(editor.animClipListRevision);
  const clip = activeClip.value;
  const byKey = new Map<string, ClipListItem>();
  const targetCount = clip?.targets?.length || 0;
  // 大体量：跳过 findHierarchyNode 拼全路径，只用末级名，避免 144×树查找
  const heavy = targetCount >= 32;
  const capTargets = heavy && !listExpanded.value;

  const upsert = (
    modelId: string,
    nodeId: string | null,
    flags: { selected?: boolean; draft?: boolean; committed?: boolean }
  ) => {
    const key = editor.clipTargetKey(modelId, nodeId);
    const prev = byKey.get(key);
    let label: string;
    let fullLabel: string;
    if (heavy) {
      if (!nodeId) {
        label = modelNameOf(modelId);
        fullLabel = label;
      } else {
        const slash = nodeId.lastIndexOf("/");
        label = slash >= 0 ? nodeId.slice(slash + 1) : nodeId;
        fullLabel = `${modelNameOf(modelId)} / ${label}`;
      }
    } else {
      fullLabel = editor.formatClipTargetLabel(modelId, nodeId);
      label = nodeId ? shortNodeName(fullLabel) : modelNameOf(modelId);
    }
    byKey.set(key, {
      key,
      modelId,
      nodeId,
      label,
      fullLabel,
      depth: 0,
      selected: !!(prev?.selected || flags.selected),
      draft: !!(prev?.draft || flags.draft),
      committed: !!(prev?.committed || flags.committed),
      isModelRoot: !nodeId
    });
  };

  let committedAdded = 0;
  for (const t of clip?.targets || []) {
    if (capTargets && committedAdded >= LIST_SOFT_CAP) break;
    upsert(t.modelId, t.nodeId ?? null, { committed: true });
    committedAdded++;
  }
  for (const key of selectedKeys.value) {
    const { modelId, nodeId } = parseKey(key);
    upsert(modelId, nodeId, { selected: true, draft: draftKey.value === key });
  }
  if (activeTargetKey.value) {
    const { modelId, nodeId } = parseKey(activeTargetKey.value);
    upsert(modelId, nodeId, {
      selected: true,
      draft: draftKey.value === activeTargetKey.value
    });
  }
  if (draftKey.value && !byKey.has(draftKey.value)) {
    const { modelId, nodeId } = parseKey(draftKey.value);
    upsert(modelId, nodeId, { selected: true, draft: true });
  }

  const flat = [...byKey.values()];
  // 大体量跳过整树 walk 建层级，直接扁平列表；未展开时也不做 zh sort
  if (heavy || flat.length >= 32) {
    if (capTargets) return flat;
    return flat.sort((a, b) => a.fullLabel.localeCompare(b.fullLabel, "zh"));
  }
  return buildHierarchicalClipItems(flat);
});

const visibleListItems = computed(() => {
  if (listExpanded.value || listItems.value.length <= LIST_SOFT_CAP) return listItems.value;
  return listItems.value.slice(0, LIST_SOFT_CAP);
});

watch(
  () => activeClipId.value,
  () => {
    listExpanded.value = false;
  }
);

function parseKey(key: string): { modelId: string; nodeId: string | null } {
  const i = key.indexOf("|");
  if (i < 0) return { modelId: key, nodeId: null };
  return { modelId: key.slice(0, i), nodeId: key.slice(i + 1) || null };
}

function modelNameOf(modelId: string) {
  const m = (editor.models as any[])?.find?.((x: any) => x.id === modelId);
  return m?.name || modelId;
}

function shortNodeName(full: string) {
  const parts = full.split(" / ");
  return parts[parts.length - 1] || full;
}

/** 按模型层级把扁平目标排成父子缩进树 */
function buildHierarchicalClipItems(flat: ClipListItem[]): ClipListItem[] {
  if (!flat.length) return [];
  const out: ClipListItem[] = [];
  const byModel = new Map<string, ClipListItem[]>();
  for (const item of flat) {
    const list = byModel.get(item.modelId) || [];
    list.push(item);
    byModel.set(item.modelId, list);
  }

  for (const [modelId, items] of byModel) {
    const keySet = new Set(items.map(i => i.key));
    const itemMap = new Map(items.map(i => [i.key, i]));
    const rootKey = editor.clipTargetKey(modelId, null);
    const emitted = new Set<string>();

    const emit = (item: ClipListItem, depth: number) => {
      if (emitted.has(item.key)) return;
      emitted.add(item.key);
      out.push({ ...item, depth, isModelRoot: !item.nodeId });
    };

    if (keySet.has(rootKey)) {
      emit(itemMap.get(rootKey)!, 0);
    }

    const walk = (nodes: any[], ancestorDepth: number) => {
      for (const n of nodes) {
        const key = editor.clipTargetKey(modelId, n.id);
        if (keySet.has(key)) {
          const depth = ancestorDepth < 0 ? 0 : ancestorDepth + 1;
          emit(itemMap.get(key)!, depth);
          if (n.children?.length) walk(n.children, depth);
        } else if (n.children?.length) {
          walk(n.children, ancestorDepth);
        }
      }
    };

    const tree = editor.getModelHierarchy(modelId) || [];
    walk(tree, keySet.has(rootKey) ? 0 : -1);

    for (const item of items) {
      if (!emitted.has(item.key)) emit(item, keySet.has(rootKey) ? 1 : 0);
    }
  }

  return out;
}

watch(
  () => unref(editor.selectedChapterId),
  id => {
    if (!id) return;
    // applyChapter 已 uiOnly 同步；组件挂载时若再 sync 一次会重复 seal + 扫片段
    if (unref(editor.activeAnimClipId) && editor.getActiveAnimationClip()) return;
    requestAnimationFrame(() => {
      if (unref(editor.selectedChapterId) !== id) return;
      editor.syncAnimClipsForSelectedChapter({ uiOnly: true });
    });
  }
);

const onClipTime = (field: "start" | "end", value: number | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return;
  editor.updateActiveClipTime(field, Number(value));
};

const camAxes = ["X", "Y", "Z"] as const;

const clipCam = computed(() => {
  unref(editor.animClipListRevision);
  unref(editor.cameraFormRevision);
  const cam = activeClip.value?.camera;
  return {
    transitionSec: cam?.transitionSec ?? 0.5,
    fov: cam?.fov ?? 45,
    position: (cam?.position ?? [0, 0, 0]) as [number, number, number],
    target: (cam?.target ?? [0, 0, 0]) as [number, number, number]
  };
});

const onClipCam = (field: "transitionSec" | "fov", v: number | undefined) => {
  if (field === "transitionSec") editor.updateActiveClipCamera({ transitionSec: Number(v) || 0 });
  else editor.updateActiveClipCamera({ fov: Number(v) || 45 });
};

const onClipCamAxis = (kind: "position" | "target", axis: number, v: number | undefined) => {
  const value = Number(v);
  if (!Number.isFinite(value)) return;
  if (kind === "position") {
    editor.updateActiveClipCamera({ positionAxis: { axis: axis as 0 | 1 | 2, value } });
  } else {
    editor.updateActiveClipCamera({ targetAxis: { axis: axis as 0 | 1 | 2, value } });
  }
};

const formatClipRange = (c: { start: number; end: number }) => {
  const a = Number(c.start ?? 0).toFixed(1);
  const b = Number(c.end ?? 0).toFixed(1);
  return `${a}–${b}s`;
};

const onTargetClick = (
  item: { modelId: string; nodeId: string | null },
  e: MouseEvent
) => {
  editor.selectClipTarget(item.modelId, item.nodeId, {
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey
  });
};

const onRemoveClip = async (c: { id: string; name: string }) => {
  try {
    await ElMessageBox.confirm(`删除「${c.name}」？`, "提示", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消"
    });
    editor.removeAnimationClip(c.id);
  } catch {
    // cancelled
  }
};
</script>

<style lang="scss">
.movie-editor .animation-timeline {
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color-1);
  display: flex;
  flex-direction: column;
  gap: 12px;

  .at-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .at-playhead {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .at-playhead-track {
    flex: 1;
    min-width: 0;
    height: 4px;
    border-radius: 999px;
    background: rgb(255 255 255 / 10%);
    overflow: hidden;
  }

  .at-playhead-bar {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #22c55e, #4ade80);
    transition: width 0.05s linear;
  }

  .at-playhead-time {
    flex-shrink: 0;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: #86efac;
  }

  .at-toolbar-meta {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-color-3);

    strong {
      font-weight: 600;
      color: var(--text-color-2);
    }

    em {
      font-style: normal;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 11px;
      color: #fbbf24;
      background: rgb(251 191 36 / 14%);
    }
  }

  .at-btn {
    height: 30px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid rgb(255 255 255 / 14%);
    background: rgb(255 255 255 / 6%);
    color: var(--text-color-2);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;

    &:hover:not(:disabled) {
      border-color: rgb(255 255 255 / 28%);
      color: var(--text-color-1);
      background: rgb(255 255 255 / 10%);
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  .at-btn-play,
  .at-btn-save {
    color: #4ade80;
    border-color: rgb(74 222 128 / 40%);
    background: #143024;

    &:hover:not(:disabled) {
      color: #6ee7a0;
      border-color: rgb(74 222 128 / 55%);
      background: #1a3d2e;
    }
  }

  .at-btn-cam {
    height: 28px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    color: #86efac;
    border-color: rgb(74 222 128 / 35%);
    background: rgb(74 222 128 / 10%);

    &:hover:not(:disabled) {
      color: #bbf7d0;
      border-color: rgb(74 222 128 / 55%);
      background: rgb(74 222 128 / 16%);
    }
  }

  .at-cam {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgb(255 255 255 / 8%);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .at-cam-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .at-cam-head-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .at-cam-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-2);
  }

  .at-cam-hint {
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-color-3);
  }

  .at-cam-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    min-width: 0;
  }

  .at-cam-field {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgb(0 0 0 / 20%);
    border: 1px solid rgb(255 255 255 / 6%);
    font-size: 12px;
    color: var(--text-color-3);

    > span {
      flex-shrink: 0;
      width: 28px;
      font-weight: 600;
    }

    em {
      flex-shrink: 0;
      font-style: normal;
      color: var(--text-color-3);
    }

    .el-input-number {
      flex: 1;
      min-width: 0;
      width: auto !important;
    }
  }

  .at-cam-xyz {
    display: grid;
    grid-template-columns: 36px repeat(3, minmax(0, 1fr));
    gap: 8px;
    align-items: center;
    min-width: 0;
    padding: 10px;
    border-radius: 8px;
    background: rgb(0 0 0 / 20%);
    border: 1px solid rgb(255 255 255 / 6%);
  }

  .at-cam-xyz-label {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-3);
  }

  .at-cam-axis {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    min-width: 0;
    font-size: 11px;
    color: var(--text-color-3);

    > span {
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--text-color-3);
    }

    .el-input-number {
      width: 100% !important;
      min-width: 0;
    }
  }

  .at-num-cam,
  .at-num-xyz {
    width: 100% !important;

    .el-input__wrapper {
      padding-left: 8px;
      padding-right: 8px;
    }

    .el-input__inner {
      text-align: left;
      font-variant-numeric: tabular-nums;
    }
  }

  .at-clips {
    display: flex;
    align-items: stretch;
    gap: 8px;
    min-width: 0;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid rgb(255 255 255 / 8%);
    background: rgb(0 0 0 / 22%);
  }

  .at-clips-label {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 4px 0 2px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-color-3);
    letter-spacing: 0.04em;
  }

  .at-strip {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 0;
    scrollbar-width: thin;
    scrollbar-color: rgb(255 255 255 / 18%) transparent;

    &::-webkit-scrollbar {
      height: 3px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      border-radius: 3px;
      background: rgb(255 255 255 / 16%);
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgb(255 255 255 / 28%);
    }
  }

  .at-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    height: 28px;
    min-width: 28px;
    padding: 0 6px;
    font-size: 12px;
    color: rgb(255 255 255 / 68%);
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;

    &:hover {
      color: rgb(255 255 255 / 90%);
      background: rgb(255 255 255 / 6%);
    }

    &:hover .at-chip-x {
      opacity: 0.7;
    }

    &.is-active {
      color: #bbf7d0;
      background: rgb(74 222 128 / 14%);
      border-color: rgb(74 222 128 / 28%);

      .at-chip-idx {
        color: #052e16;
        background: #4ade80;
      }

      .at-chip-n {
        color: #86efac;
        background: rgb(74 222 128 / 18%);
      }

      .at-chip-x {
        opacity: 0.55;
      }
    }

    &.is-playing {
      color: #bbf7d0;
      background: rgb(74 222 128 / 18%);
      border-color: rgb(74 222 128 / 45%);
      box-shadow: 0 0 0 1px rgb(74 222 128 / 25%);

      .at-chip-idx {
        color: #052e16;
        background: #4ade80;
      }
    }
  }

  .at-chip-idx {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 4px;
    color: rgb(255 255 255 / 75%);
    background: rgb(255 255 255 / 10%);
  }

  .at-chip-n {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
    border-radius: 8px;
    color: rgb(255 255 255 / 55%);
    background: rgb(255 255 255 / 8%);
  }

  .at-chip-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 0;
    font-size: 13px;
    line-height: 1;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease;

    &:hover {
      opacity: 1 !important;
      color: #fecaca;
      background: rgb(248 113 113 / 22%);
    }
  }

  .at-chip-add {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
    color: rgb(255 255 255 / 55%);
    border: 1px dashed rgb(255 255 255 / 16%);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;

    &:hover:not(:disabled) {
      color: #86efac;
      border-color: rgb(74 222 128 / 40%);
      background: rgb(74 222 128 / 8%);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .at-edit {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .at-card {
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid rgb(255 255 255 / 8%);
    background: rgb(255 255 255 / 3%);
  }

  .at-card-label {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-color-3);
    text-transform: none;
  }

  .at-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .at-row-time {
    gap: 8px;
  }

  .at-field-label {
    font-size: 12px;
    color: var(--text-color-3);
  }

  .at-num {
    width: 72px !important;
  }

  .at-sep,
  .at-unit {
    font-size: 12px;
    color: var(--text-color-3);
  }

  .at-hint-empty {
    margin: 0;
    padding: 14px 10px;
    text-align: center;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-color-3);
    border-radius: 6px;
    background: rgb(255 255 255 / 3%);
  }

  .at-models-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .at-models-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-color-2);

    .at-sel-count {
      margin-left: 6px;
      font-style: normal;
      font-weight: 500;
      font-size: 11px;
      color: #86efac;
    }
  }

  .at-link-btn {
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 500;
    color: #fca5a5;
    background: rgb(248 113 113 / 12%);
    border: 1px solid rgb(248 113 113 / 25%);
    border-radius: 5px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgb(248 113 113 / 20%);
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  .at-model-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 180px;
    overflow: auto;
    margin: 0 -4px;
    padding: 0 4px;
  }

  .at-model-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 32px;
    padding: 5px 8px;
    text-align: left;
    font-size: 12px;
    color: rgb(255 255 255 / 78%);
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    transition: background 0.1s ease, border-color 0.1s ease;

    &:hover {
      background: rgb(255 255 255 / 6%);
    }

    &.is-model-root {
      font-weight: 600;
    }

    &.is-selected {
      border-color: rgb(74 222 128 / 35%);
      background: rgb(74 222 128 / 10%);
    }

    &.is-active {
      color: #052e16;
      font-weight: 700;
      background: #4ade80;
      border-color: #86efac;

      .at-badge {
        background: rgb(0 0 0 / 14%);
        color: #052e16;
      }

      .at-model-check {
        border-color: rgb(0 0 0 / 35%);

        &.on {
          background: #052e16;
          border-color: #052e16;
        }
      }

      .at-chip-x:hover {
        background: rgb(0 0 0 / 16%);
        color: #052e16;
      }
    }

    &.is-draft:not(.is-active) {
      border-style: dashed;
      border-color: rgb(251 191 36 / 40%);
    }
  }

  .at-model-check {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1.5px solid rgb(255 255 255 / 35%);

    &.on {
      background: #4ade80;
      border-color: #4ade80;
      box-shadow: inset 0 0 0 2px rgb(0 0 0 / 15%);
    }
  }

  .at-model-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .at-badge {
    flex-shrink: 0;
    padding: 0 6px;
    font-size: 10px;
    line-height: 18px;
    border-radius: 4px;
    background: rgb(74 222 128 / 18%);
    color: #86efac;
  }

  .at-badge-draft {
    background: rgb(251 191 36 / 18%);
    color: #fbbf24;
  }

  .at-badge-sel {
    background: rgb(147 197 253 / 18%);
    color: #93c5fd;
  }

  .at-card-editor {
    padding: 8px 10px 10px;
  }
}
</style>
