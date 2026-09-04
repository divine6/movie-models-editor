<template>
  <aside class="editor-config-panel panel-right">
    <div class="right-tabs">
      <button
        class="right-tab"
        :class="{ active: editor.rightTab === 'model' }"
        type="button"
        @click="editor.rightTab = 'model'"
      >
        {{ $t("OpWeb.Editor.TabModel", "模型") }}
      </button>
      <button
        class="right-tab"
        :class="{ active: editor.rightTab === 'subtitle' }"
        type="button"
        @click="editor.rightTab = 'subtitle'"
      >
        {{ $t("OpWeb.Editor.TabSubtitle", "字幕") }}
      </button>
      <button
        class="right-tab"
        :class="{ active: editor.rightTab === 'scene' }"
        type="button"
        @click="editor.rightTab = 'scene'"
      >
        {{ $t("OpWeb.Editor.Scene", "场景") }}
      </button>
    </div>

    <div class="config-scroll">
      <!-- 模型 Tab -->
      <div v-show="editor.rightTab === 'model'" class="model-tab">
        <div class="panel-model-head">
          <span>{{ $t("OpWeb.Editor.TabModel", "模型") }}</span>
        </div>

        <div
          class="model-list"
          :class="{ 'is-empty': editor.chapterModels.length === 0 }"
          @mouseleave="editor.clearHoverModelInList"
        >
          <div v-for="m in editor.chapterModels" :key="m.id" class="model-tree-root">
            <div
              class="model-card"
              :class="{
                selected: editor.selModelId === m.id && !editor.selModelNodeId,
                'multi-selected': isRootMultiSelected(m.id),
                hovered: editor.isModelCardHovered(m.id),
                'hovered-child': editor.hoverModelId === m.id && !!editor.hoverModelNodeId
              }"
              @mouseenter="editor.hoverModelInList(m.id, null)"
              @click.exact.stop="onSelectRootExact(m)"
              @click.shift.exact.stop="onSelectRootShift(m)"
              @click.ctrl.exact.stop="onSelectRootCtrl(m)"
              @click.meta.exact.stop="onSelectRootCtrl(m)"
            >
              <span class="model-dot" :style="{ background: m.color }" />
              <span class="model-body">
                <span class="model-name">{{ m.name }}</span>
                <span class="model-type-tag">{{ m.type === "custom" ? "GLB" : "Primitive" }}</span>
                <span
                  v-if="editor.isClipTargetInClip(m.id, null)"
                  class="edited-badge"
                  title="已在当前动画片段中"
                >
                  已改
                </span>
                <span
                  v-else-if="isRootMultiSelected(m.id)"
                  class="sel-badge"
                  title="多选中"
                >
                  选中
                </span>
                <span
                  v-else-if="!unref(editor.activeAnimClipId) && editor.modelHasEdits(m.id)"
                  class="edited-badge is-soft"
                  title="该模型在当前选中动画下已编辑过"
                >
                  已改
                </span>
              </span>
              <button class="model-del-btn" type="button" title="删除" @click.stop="editor.delModel(m)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>

            <div v-if="editor.getModelHierarchy(m.id).length" class="model-tree-children">
              <editor-model-tree-node
                v-for="node in editor.getModelHierarchy(m.id)"
                :key="node.id"
                :node="node"
                :depth="1"
              />
            </div>
          </div>

          <div v-if="editor.chapterModels.length === 0" class="model-list-empty">
            <base-empty size="small" :text="$t('OpWeb.Editor.NoChapterModels', '当前节点暂无模型')">
              <template #desc>
                <span class="model-empty-desc">
                  {{ $t("OpWeb.Editor.ModelEmptyDesc", "当前节点尚未配置模型") }}
                </span>
              </template>
            </base-empty>
          </div>
        </div>

        <editor-model-config v-if="!isAnimClipEditing && hasSelectedAnimation" />
        <p v-else-if="isAnimClipEditing && editor.selModel" class="model-config-clip-tip">
          片段外观 / 姿态请在左侧「动画」面板编辑
        </p>
        <p v-else-if="editor.selModel && !hasSelectedAnimation" class="model-config-clip-tip">
          请先在左侧选择动画节点，再编辑模型外观
        </p>
      </div>

      <!-- 字幕 Tab -->
      <editor-subtitle-panel v-show="editor.rightTab === 'subtitle'" />

      <!-- 场景 Tab -->
      <editor-scene-panel v-show="editor.rightTab === 'scene'" />
    </div>
  </aside>
</template>

<script setup lang="ts" name="editor-config-panel">
import { Delete } from "@element-plus/icons-vue";
import { computed, unref } from "vue";

import EditorModelConfig from "@/components/business/movie-editor/editor-model-config.vue";
import EditorModelTreeNode from "@/components/business/movie-editor/editor-model-tree-node.vue";
import EditorScenePanel from "@/components/business/movie-editor/editor-scene-panel.vue";
import EditorSubtitlePanel from "@/components/business/movie-editor/editor-subtitle-panel.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const $t = useTranslate();

/** 动画片段编辑态：右下角章节默认外观与左侧片段外观重复，隐藏 */
const isAnimClipEditing = computed(() => {
  return !!unref(editor.activeAnimClipId) && !!unref(editor.selectedChapter);
});

/** 未选中动画节点时不展示旧的章节动画面板 */
const hasSelectedAnimation = computed(() => !!unref(editor.selectedChapter));

function isRootMultiSelected(modelId: string) {
  unref(editor.activeClipSelectedKeySet);
  return !!unref(editor.activeAnimClipId) && editor.isClipTargetSelected(modelId, null);
}

function pickRoot(m: { id: string }, mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) {
  const multi = !!(mods.shiftKey || mods.ctrlKey || mods.metaKey);
  editor.selectModel(m as any, {
    focusCamera: !multi,
    nodeId: null,
    shiftKey: !!mods.shiftKey,
    ctrlKey: !!mods.ctrlKey,
    metaKey: !!mods.metaKey
  });
}

function onSelectRootExact(m: { id: string }) {
  pickRoot(m, {});
}

function onSelectRootShift(m: { id: string }) {
  pickRoot(m, { shiftKey: true });
}

function onSelectRootCtrl(m: { id: string }) {
  pickRoot(m, { ctrlKey: true });
}
</script>

<style lang="scss">
.movie-editor .model-config-clip-tip {
  margin: 10px 12px 14px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-color-3);
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 7%);
}
</style>
