<template>
  <aside class="editor-config-panel panel-right" :class="{ 'is-upload-mode': !editor.hasVideo }">
    <editor-video-upload v-if="!editor.hasVideo" />

    <template v-else>
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
            <div class="model-head-actions">
              <input
                :ref="editor.bindRef('multiFileInput')"
                type="file"
                accept=".glb,.gltf"
                multiple
                style="display: none"
                @change="editor.onMultiFileChange"
              />
              <input
                :ref="editor.bindRef('folderInput')"
                type="file"
                accept=".glb,.gltf"
                multiple
                webkitdirectory
                style="display: none"
                @change="editor.onFolderChange"
              />
              <el-tooltip :content="editor.pickOnlyVisible ? '仅拾取可见对象（点击切换为可拾取隐藏）' : '可拾取隐藏对象（点击仅拾取可见）'" placement="top">
                <el-button
                  size="small"
                  plain
                  :type="editor.pickOnlyVisible ? 'primary' : 'default'"
                  @click="editor.togglePickOnlyVisible"
                >
                  <el-icon><component :is="editor.pickOnlyVisible ? View : Hide" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-dropdown trigger="click" @command="editor.importCmd">
                <el-button type="primary" size="small" plain>＋</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="file">
                      {{ $t("OpWeb.Editor.ImportModelFiles", "选择模型文件（多选）") }}
                    </el-dropdown-item>
                    <el-dropdown-item command="folder">
                      {{ $t("OpWeb.Editor.ImportModelFolder", "选择模型文件夹") }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
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
                  hovered: editor.isModelCardHovered(m.id),
                  'hovered-child': editor.hoverModelId === m.id && !!editor.hoverModelNodeId
                }"
                @mouseenter="editor.hoverModelInList(m.id, null)"
                @click="editor.selectModel(m, { focusCamera: true, nodeId: null })"
              >
                <span class="model-dot" :style="{ background: m.color }" />
                <span class="model-body">
                  <span class="model-name">{{ m.name }}</span>
                  <span class="model-type-tag">{{ m.type === "custom" ? "GLB" : "Primitive" }}</span>
                  <span v-if="editor.modelHasEdits(m.id)" class="edited-badge" title="该模型在此节点已编辑过">已改</span>
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
                    {{ $t("OpWeb.Editor.ImportModelHint", "点击 ＋ 导入 GLB/GLTF 模型") }}
                  </span>
                </template>
              </base-empty>
            </div>
          </div>

          <editor-model-config />
        </div>

        <!-- 字幕 Tab -->
        <editor-subtitle-panel v-show="editor.rightTab === 'subtitle'" />

        <!-- 场景 Tab -->
        <editor-scene-panel v-show="editor.rightTab === 'scene'" />
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts" name="editor-config-panel">
import { Delete, View, Hide } from "@element-plus/icons-vue";

import EditorModelConfig from "@/components/business/movie-editor/editor-model-config.vue";
import EditorModelTreeNode from "@/components/business/movie-editor/editor-model-tree-node.vue";
import EditorScenePanel from "@/components/business/movie-editor/editor-scene-panel.vue";
import EditorSubtitlePanel from "@/components/business/movie-editor/editor-subtitle-panel.vue";
import EditorVideoUpload from "@/components/business/movie-editor/editor-video-upload.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { useTranslate } from "@/hooks/useTranslate";

const editor = useMovieEditorContext();
const $t = useTranslate();
</script>
