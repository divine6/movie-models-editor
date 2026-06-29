<template>
  <el-drawer
    v-model="visible"
    class="editor-scene-list-drawer"
    title="场景列表"
    direction="rtl"
    size="min(860px, 96vw)"
    :z-index="3100"
    @open="loadScenes"
  >
    <div v-loading="loading" class="editor-scene-list-drawer__body">
      <el-empty v-if="!loading && scenes.length === 0" description="暂无已保存场景" />
      <div v-else class="editor-scene-list-drawer__table-wrap">
        <el-table :data="scenes" stripe size="small" class="editor-scene-list-drawer__table">
          <el-table-column label="场景名称" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ displaySceneTitle(row) }}</template>
          </el-table-column>
          <el-table-column label="场景 ID" min-width="110">
            <template #default="{ row }">
              <span class="scene-code-badge">{{ row.code }}</span>
            </template>
          </el-table-column>
          <el-table-column label="场景链接" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <a class="scene-preview-link" :href="scenePreviewUrl(row)" target="_blank" rel="noopener">
                {{ scenePreviewUrl(row) }}
              </a>
            </template>
          </el-table-column>
          <el-table-column label="保存时间" width="168">
            <template #default="{ row }">{{ formatTime(row.updatedAt || row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="248" fixed="right">
            <template #default="{ row }">
              <div class="scene-row-actions">
                <el-button size="small" type="primary" plain :loading="editingCode === row.code" @click="onEdit(row)">
                  修改
                </el-button>
                <el-button size="small" @click="copy(scenePreviewUrl(row))">复制链接</el-button>
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :loading="deletingCode === row.code"
                  @click="onDelete(row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts" name="editor-scene-list-drawer">
import { ElMessage, ElMessageBox } from "element-plus";
import { ref, watch } from "vue";

import {
  buildScenePreviewLink,
  deleteScene,
  fetchSceneList,
  rewireEditorFrontendHost,
  type EditorServerSceneItem
} from "@/api/modules/editor-server";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();
const visible = defineModel<boolean>({ default: false });
const loading = ref(false);
const scenes = ref<EditorServerSceneItem[]>([]);
const editingCode = ref<string | null>(null);
const deletingCode = ref<string | null>(null);

watch(
  () => editor.sceneListVersion,
  () => {
    if (visible.value) loadScenes();
  }
);

function scenePreviewUrl(row: EditorServerSceneItem) {
  return row.previewUrl ? rewireEditorFrontendHost(row.previewUrl) : buildScenePreviewLink(row.code);
}

function displaySceneTitle(row: EditorServerSceneItem) {
  if (editor.sceneCode === row.code) {
    const title = editor.projectTitle.trim();
    if (title) return title;
  }
  return row.title || "未命名场景";
}

async function loadScenes() {
  loading.value = true;
  try {
    scenes.value = await fetchSceneList(editor.modelSetCode || undefined);
  } catch (e: any) {
    ElMessage.error(e?.message || "加载场景列表失败");
    scenes.value = [];
  } finally {
    loading.value = false;
  }
}

function formatTime(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN");
}

async function copy(url: string) {
  await navigator.clipboard.writeText(url);
  ElMessage.success("链接已复制");
}

async function onEdit(row: EditorServerSceneItem) {
  editingCode.value = row.code;
  try {
    if (await editor.loadSceneForEdit(row.code)) {
      visible.value = false;
      ElMessage.success("已加载场景，保存后将更新该场景");
    }
  } finally {
    editingCode.value = null;
  }
}

async function onDelete(row: EditorServerSceneItem) {
  try {
    await ElMessageBox.confirm(`确定删除场景「${displaySceneTitle(row)}」？`, "提示", {
      type: "warning",
      zIndex: 3200
    });
  } catch {
    return;
  }
  deletingCode.value = row.code;
  try {
    await deleteScene(row.code);
    scenes.value = scenes.value.filter(item => item.code !== row.code);
    if (editor.sceneCode === row.code) {
      editor.sceneCode = null;
      editor.shareLink = "";
    }
    editor.sceneListVersion += 1;
    ElMessage.success("场景已删除");
  } finally {
    deletingCode.value = null;
  }
}
</script>

<style lang="scss">
.editor-scene-list-drawer.el-drawer {
  background: #0a0b0d !important;
  box-shadow: -12px 0 40px rgb(0 0 0 / 42%);

  .el-drawer__header {
    margin-bottom: 0;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgb(255 255 255 / 8%);
    background: #0a0b0d;
  }

  .el-drawer__title {
    font-size: 16px;
    font-weight: 600;
    color: rgb(255 255 255 / 88%);
  }

  .el-drawer__close-btn {
    color: rgb(255 255 255 / 56%);

    &:hover {
      color: #fff;
    }
  }

  .el-drawer__body {
    padding: 16px 20px 20px;
    background: #0a0b0d;
    color: rgb(255 255 255 / 72%);
  }

  .editor-scene-list-drawer__body {
    min-height: 200px;
  }

  .editor-scene-list-drawer__table-wrap {
    overflow: auto;
    background: #0d0f12;
    border: 1px solid rgb(255 255 255 / 8%);
    border-radius: var(--corner-radius-2);
  }

  .editor-scene-list-drawer__table {
    --el-table-bg-color: #0d0f12;
    --el-table-tr-bg-color: #0d0f12;
    --el-table-header-bg-color: #000;
    --el-table-row-hover-bg-color: #143024;
    --el-table-border-color: rgb(255 255 255 / 8%);
    --el-table-text-color: rgb(255 255 255 / 72%);
    --el-table-header-text-color: rgb(255 255 255 / 48%);
    --el-fill-color-lighter: rgb(255 255 255 / 4%);
    background: #0d0f12;

    .el-table__body tr.el-table__row--striped td.el-table__cell {
      background: rgb(255 255 255 / 4%) !important;
    }

    .el-table__body tr td.el-table__cell {
      background: #0d0f12;
    }

    .el-table__fixed-right,
    .el-table__fixed-left,
    .el-table__fixed-right-patch {
      background: #0d0f12 !important;
    }
  }

  .scene-code-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgb(74 222 128 / 12%);
    color: #4ade80;
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12px;
    word-break: break-all;
  }

  .scene-preview-link {
    color: #6ee7a0;
    text-decoration: none;
    word-break: break-all;

    &:hover {
      color: #4ade80;
      text-decoration: underline;
    }
  }

  .scene-row-actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    white-space: nowrap;

    .el-button {
      margin: 0;
      flex-shrink: 0;
      --el-button-bg-color: rgb(255 255 255 / 6%);
      --el-button-border-color: rgb(255 255 255 / 14%);
      --el-button-text-color: rgb(255 255 255 / 72%);
      --el-button-hover-bg-color: rgb(255 255 255 / 10%);
      --el-button-hover-border-color: rgb(255 255 255 / 22%);
      --el-button-hover-text-color: #fff;
    }

    .el-button--primary.is-plain {
      --el-button-bg-color: #143024;
      --el-button-border-color: rgb(74 222 128 / 35%);
      --el-button-text-color: #4ade80;
      --el-button-hover-bg-color: rgb(20 48 36 / 92%);
      --el-button-hover-border-color: rgb(74 222 128 / 50%);
      --el-button-hover-text-color: #6ee7a0;
    }

    .el-button--danger.is-plain {
      --el-button-bg-color: rgb(127 29 29 / 28%);
      --el-button-border-color: rgb(248 113 113 / 35%);
      --el-button-text-color: #f87171;
      --el-button-hover-bg-color: rgb(127 29 29 / 42%);
      --el-button-hover-border-color: rgb(248 113 113 / 50%);
      --el-button-hover-text-color: #fca5a5;
    }
  }

  .el-empty__description {
    color: rgb(255 255 255 / 48%);
  }

  @media (max-width: 640px) {
    .scene-row-actions {
      gap: 4px;

      .el-button {
        padding-left: 8px;
        padding-right: 8px;
      }
    }
  }
}
</style>
