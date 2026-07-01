<template>
  <div class="movie-editor editor-dark-theme editor-admin">
    <header class="editor-topbar editor-admin__topbar">
      <div class="editor-topbar__brand editor-admin__brand">
        <span class="editor-topbar__brand-title">UltimateBox</span>
        <span class="editor-topbar__brand-subtitle">模型编辑器 · 后台管理</span>
      </div>
      <div class="editor-topbar__actions">
        <el-button :loading="loading" @click="loadAll">刷新数据</el-button>
      </div>
    </header>

    <main class="editor-admin__main">
      <section class="editor-admin__intro">
        <p class="editor-admin__desc">
          新建编辑场景 → 生成编辑链接 → 上传 GLB → 在编辑器内保存场景并生成展示链接。链接主机跟随当前访问地址，便于手机局域网打开。
        </p>
        <div class="editor-admin__stats">
          <div class="editor-admin__stat">
            <span class="editor-admin__stat-num">{{ overview?.editSceneCount ?? 0 }}</span>
            <span class="editor-admin__stat-label">编辑场景</span>
          </div>
          <div class="editor-admin__stat">
            <span class="editor-admin__stat-num">{{ overview?.sceneCount ?? 0 }}</span>
            <span class="editor-admin__stat-label">已保存场景</span>
          </div>
        </div>
      </section>

      <section class="editor-admin__panel">
        <el-tabs v-model="activeTab" class="editor-admin__tabs">
          <el-tab-pane label="新建编辑场景" name="create">
            <div class="editor-admin__panel-body">
              <el-form label-position="top" class="editor-admin__form">
                <div class="editor-admin__form-grid">
                  <el-form-item label="公司名称">
                    <el-input v-model="createForm.companyName" placeholder="例如：山东泰山" />
                  </el-form-item>
                  <el-form-item label="编辑场景名称">
                    <el-input v-model="createForm.name" placeholder="例如：CNG 产品展示" />
                  </el-form-item>
                </div>
                <el-form-item label="GLB / GLTF 模型文件（可多选，必填）">
                  <label class="editor-admin__file-picker">
                    <span class="editor-admin__file-picker-btn">选择文件</span>
                    <input ref="fileInputRef" type="file" accept=".glb,.gltf" multiple @change="onFilesChange" />
                    <span class="editor-admin__file-picker-name">
                      {{ createForm.files.length ? `已选 ${createForm.files.length} 个文件` : "未选择任何文件" }}
                    </span>
                  </label>
                </el-form-item>
                <div class="editor-admin__form-actions">
                  <el-button type="primary" :loading="creating" @click="submitCreate">创建并生成 Code</el-button>
                </div>
                <p v-if="createError" class="editor-admin__error">{{ createError }}</p>
              </el-form>
              <div v-if="createResult" class="editor-admin__result">
                <p class="editor-admin__result-title">创建成功</p>
                <div class="editor-admin__result-row">
                  <span class="editor-admin__result-label">编辑场景 Code</span>
                  <code class="editor-admin__code">{{ createResult.code }}</code>
                  <el-button link type="primary" @click="copyText(createResult.code)">复制</el-button>
                </div>
                <div class="editor-admin__result-row">
                  <span class="editor-admin__result-label">编辑链接</span>
                  <a :href="createResult.editUrl" target="_blank" rel="noopener">{{ createResult.editUrl }}</a>
                  <el-button link type="primary" @click="copyText(createResult.editUrl)">复制</el-button>
                </div>
                <div class="editor-admin__result-row">
                  <span class="editor-admin__result-label">预览链接</span>
                  <a :href="createResult.previewUrl" target="_blank" rel="noopener">{{ createResult.previewUrl }}</a>
                  <el-button link type="primary" @click="copyText(createResult.previewUrl!)">复制</el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="编辑场景列表" name="sets">
            <div class="editor-admin__panel-body">
              <div v-if="overview?.modelSets.length" class="editor-admin__table-wrap">
                <el-table :data="overview.modelSets" class="editor-admin__table">
                  <el-table-column prop="companyName" label="公司名称" min-width="100" show-overflow-tooltip />
                  <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
                  <el-table-column label="编辑场景 Code" min-width="120">
                    <template #default="{ row }">
                      <span class="editor-admin__code">{{ row.code }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="模型数" width="80" align="center">
                    <template #default="{ row }">{{ row.models?.length ?? 0 }}</template>
                  </el-table-column>
                  <el-table-column label="编辑链接" min-width="240" show-overflow-tooltip>
                    <template #default="{ row }">
                      <a class="editor-admin__link" :href="row.editUrl" target="_blank" rel="noopener">{{ row.editUrl }}</a>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="280" fixed="right">
                    <template #default="{ row }">
                      <div class="editor-admin__row-actions">
                        <el-button link type="primary" @click="copyText(row.editUrl)">复制编辑</el-button>
                        <el-button link type="primary" @click="copyText(row.previewUrl || buildModelSetPreviewLink(row.code))">
                          复制预览
                        </el-button>
                        <el-button link type="primary" @click="appendModels(row.code)">追加模型</el-button>
                        <el-button link type="danger" @click="removeSet(row.code, row.name)">删除</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <el-empty v-else description="暂无编辑场景" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="场景列表" name="scenes">
            <div class="editor-admin__panel-body editor-admin__panel-body--scenes">
              <div v-if="sceneGroups.length" class="editor-admin__tree">
                <article v-for="group in sceneGroups" :key="group.editSceneCode" class="editor-admin__tree-group">
                  <header class="editor-admin__tree-head">
                    <div class="editor-admin__tree-head-main">
                      <h3 class="editor-admin__tree-title">{{ group.editSceneName }}</h3>
                      <p class="editor-admin__tree-meta">
                        <template v-if="group.editSceneCode === '_orphan'">独立保存的场景</template>
                        <template v-else>
                          {{ group.companyName || "—" }}
                          <span class="editor-admin__meta-sep">·</span>
                          Code <span class="editor-admin__code">{{ group.editSceneCode }}</span>
                          <span class="editor-admin__meta-sep">·</span>
                          {{ group.scenes.length }} 个场景
                        </template>
                      </p>
                    </div>
                    <div v-if="group.editSceneCode !== '_orphan'" class="editor-admin__tree-actions">
                      <el-button size="small" plain @click="copyText(group.editUrl)">复制编辑链接</el-button>
                      <el-button
                        size="small"
                        plain
                        @click="copyText(group.previewUrl || buildModelSetPreviewLink(group.editSceneCode))"
                      >
                        复制预览链接
                      </el-button>
                      <el-button size="small" type="danger" plain @click="removeSet(group.editSceneCode, group.editSceneName)">
                        删除编辑场景
                      </el-button>
                    </div>
                  </header>
                  <div v-if="group.scenes.length" class="editor-admin__table-wrap editor-admin__table-wrap--nested">
                    <el-table :data="group.scenes" class="editor-admin__table" size="small">
                      <el-table-column prop="title" label="标题" min-width="120" show-overflow-tooltip />
                      <el-table-column label="场景 Code" min-width="110">
                        <template #default="{ row }">
                          <span class="editor-admin__code">{{ row.code }}</span>
                        </template>
                      </el-table-column>
                      <el-table-column label="展示链接" min-width="240" show-overflow-tooltip>
                        <template #default="{ row }">
                          <a class="editor-admin__link" :href="row.previewUrl" target="_blank" rel="noopener">{{ row.previewUrl }}</a>
                        </template>
                      </el-table-column>
                      <el-table-column label="操作" width="160" fixed="right">
                        <template #default="{ row }">
                          <div class="editor-admin__row-actions">
                            <el-button link type="primary" @click="copyText(row.previewUrl || buildScenePreviewLink(row.code))">
                              复制链接
                            </el-button>
                            <el-button link type="danger" @click="removeScene(row.code, row.title || row.code)">删除</el-button>
                          </div>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                  <p v-else class="editor-admin__tree-empty">该编辑场景下暂无已保存场景</p>
                </article>
              </div>
              <el-empty v-else description="暂无已保存场景" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts" name="project-admin">
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";

import {
  appendModelSetModels,
  buildModelSetPreviewLink,
  buildScenePreviewLink,
  createModelSet,
  deleteModelSet,
  deleteScene,
  fetchAdminOverview,
  type EditorAdminOverview
} from "@/api/modules/editor-server";

const activeTab = ref("create");
const loading = ref(false);
const overview = ref<EditorAdminOverview | null>(null);
const creating = ref(false);
const createError = ref("");
const createResult = ref<{ code: string; editUrl: string; previewUrl?: string } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const createForm = reactive({
  companyName: "",
  name: "默认编辑场景",
  files: [] as File[]
});

const sceneGroups = computed(() => {
  const tree = overview.value?.sceneTree;
  if (!tree) return [];
  const groups = [...(tree.tree || [])];
  if ((tree.orphans || []).length) {
    groups.push({
      editSceneCode: "_orphan",
      editSceneName: "未关联编辑场景",
      companyName: "",
      editUrl: "",
      previewUrl: "",
      scenes: tree.orphans
    });
  }
  return groups;
});

function copyText(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => ElMessage.success("已复制到剪贴板"),
    () => ElMessage.error("复制失败")
  );
}

function onFilesChange(e: Event) {
  const input = e.target as HTMLInputElement;
  createForm.files = input.files ? [...input.files] : [];
}

async function loadAll() {
  loading.value = true;
  try {
    overview.value = await fetchAdminOverview();
  } catch (e: any) {
    ElMessage.error("加载失败: " + (e?.message || "未知错误"));
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  createError.value = "";
  if (!createForm.files.length) {
    createError.value = "请至少选择一个 GLB 或 GLTF 模型文件";
    return;
  }
  const form = new FormData();
  form.append("name", createForm.name.trim() || "默认编辑场景");
  form.append("companyName", createForm.companyName.trim());
  createForm.files.forEach(f => form.append("models", f));

  creating.value = true;
  try {
    const d = await createModelSet(form);
    createResult.value = {
      code: d.code,
      editUrl: d.editUrl,
      previewUrl: buildModelSetPreviewLink(d.code)
    };
    createForm.files = [];
    if (fileInputRef.value) fileInputRef.value.value = "";
    ElMessage.success("编辑场景已创建");
    await loadAll();
    activeTab.value = "sets";
  } catch (e: any) {
    createError.value = e?.message || "创建失败";
  } finally {
    creating.value = false;
  }
}

function pickModelFiles(onPick: (files: FileList) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".glb,.gltf";
  input.multiple = true;
  input.addEventListener("change", () => {
    if (input.files?.length) onPick(input.files);
  });
  input.click();
}

async function appendModels(code: string) {
  pickModelFiles(async files => {
    const form = new FormData();
    [...files].forEach(f => form.append("models", f));
    try {
      await appendModelSetModels(code, form);
      ElMessage.success("模型已追加");
      await loadAll();
    } catch (e: any) {
      ElMessage.error("追加失败: " + (e?.message || "未知错误"));
    }
  });
}

async function removeScene(code: string, title: string) {
  try {
    await ElMessageBox.confirm(`确定删除场景「${title}」？`, "提示", { type: "warning", customClass: "editor-admin-message-box" });
    await deleteScene(code);
    ElMessage.success("场景已删除");
    await loadAll();
  } catch {
    /* cancelled */
  }
}

async function removeSet(code: string, name: string) {
  try {
    await ElMessageBox.confirm(`确定删除编辑场景「${name}」？其下所有已保存场景将一并删除。`, "提示", {
      type: "warning",
      customClass: "editor-admin-message-box"
    });
    await deleteModelSet(code);
    ElMessage.success("编辑场景已删除");
    await loadAll();
  } catch {
    /* cancelled */
  }
}

onMounted(loadAll);
</script>

<style lang="scss">
@use "@/components/business/movie-editor/styles/index.scss";

.movie-editor.editor-dark-theme.editor-admin {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--editor-surface);

  .editor-admin__topbar {
    flex-shrink: 0;
    min-height: 52px;
    padding: 0 24px;
    background: var(--editor-panel);
    border-bottom: 1px solid var(--editor-border);
  }

  .editor-admin__brand {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;

    .editor-topbar__brand-title {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--editor-text-muted);
    }

    .editor-topbar__brand-subtitle {
      font-size: 15px;
      font-weight: 600;
      color: var(--editor-text);
    }
  }

  .editor-topbar__actions .el-button {
    --el-button-bg-color: rgb(255 255 255 / 6%);
    --el-button-border-color: var(--editor-border-strong);
    --el-button-text-color: var(--editor-text-secondary);
    --el-button-hover-bg-color: rgb(255 255 255 / 10%);
    --el-button-hover-border-color: rgb(255 255 255 / 22%);
    --el-button-hover-text-color: #fff;
  }

  .editor-admin__main {
    flex: 1;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    box-sizing: border-box;
  }

  .editor-admin__intro {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px 24px;
    margin-bottom: 16px;
  }

  .editor-admin__desc {
    flex: 1 1 420px;
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: var(--editor-text-muted);
  }

  .editor-admin__stats {
    display: flex;
    flex-shrink: 0;
    gap: 12px;
  }

  .editor-admin__stat {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 120px;
    padding: 10px 14px;
    background: var(--editor-panel-elevated);
    border: 1px solid var(--editor-border);
    border-radius: 8px;
  }

  .editor-admin__stat-num {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    color: var(--editor-accent);
  }

  .editor-admin__stat-label {
    font-size: 12px;
    color: var(--editor-text-muted);
    white-space: nowrap;
  }

  .editor-admin__panel {
    background: var(--editor-panel-elevated);
    border: 1px solid var(--editor-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .editor-admin__panel-body {
    padding: 4px 20px 20px;

    &--scenes {
      padding-bottom: 16px;
    }
  }

  .editor-admin__tabs {
    .el-tabs__header {
      margin: 0;
      padding: 0 20px;
      background: rgb(255 255 255 / 2%);
      border-bottom: 1px solid var(--editor-border);
    }

    .el-tabs__nav-wrap::after {
      display: none;
    }

    .el-tabs__item {
      height: 46px;
      font-size: 14px;
      color: var(--editor-text-muted);

      &:hover {
        color: var(--editor-text);
      }

      &.is-active {
        color: var(--editor-accent);
        font-weight: 600;
      }
    }

    .el-tabs__active-bar {
      height: 2px;
      background-color: var(--editor-accent);
    }

    .el-tabs__content {
      padding-top: 0;
    }
  }

  .editor-admin__form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 20px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .editor-admin__form .el-form-item__label {
    color: var(--editor-text-muted) !important;
    font-size: 13px;
  }

  .editor-admin__file-picker {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    cursor: pointer;

    input[type="file"] {
      display: none;
    }
  }

  .editor-admin__file-picker-btn {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 14px;
    border: 1px solid var(--editor-border-strong);
    border-radius: 6px;
    background: rgb(255 255 255 / 6%);
    color: var(--editor-text-secondary);
    font-size: 13px;
    transition: background 0.15s ease, border-color 0.15s ease;

    &:hover {
      background: rgb(255 255 255 / 10%);
      border-color: rgb(255 255 255 / 22%);
      color: #fff;
    }
  }

  .editor-admin__file-picker-name {
    font-size: 13px;
    color: var(--editor-text-muted);
  }

  .editor-admin__form-actions {
    margin-top: 4px;
  }

  .editor-admin__error {
    margin: 10px 0 0;
    color: #f87171;
    font-size: 13px;
  }

  .editor-admin__result {
    margin-top: 20px;
    padding: 16px;
    border: 1px solid rgb(74 222 128 / 22%);
    border-radius: 8px;
    background: var(--editor-accent-soft);
  }

  .editor-admin__result-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--editor-accent);
  }

  .editor-admin__result-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--editor-text-secondary);

    &:last-child {
      margin-bottom: 0;
    }
  }

  .editor-admin__result-label {
    flex: 0 0 96px;
    color: var(--editor-text-muted);
  }

  .editor-admin__code {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgb(74 222 128 / 12%);
    color: var(--editor-accent);
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12px;
    word-break: break-all;
  }

  .editor-admin__link {
    color: var(--editor-accent);
    text-decoration: none;
    word-break: break-all;

    &:hover {
      color: var(--editor-accent-highlight);
      text-decoration: underline;
    }
  }

  .editor-admin__table-wrap {
    overflow: auto;
    border: 1px solid var(--editor-border);
    border-radius: 8px;
    background: #0d0f12;

    &--nested {
      border: none;
      border-radius: 0;
    }
  }

  .editor-admin__table {
    --el-table-bg-color: #0d0f12;
    --el-table-tr-bg-color: #0d0f12;
    --el-table-header-bg-color: #000;
    --el-table-row-hover-bg-color: #143024;
    --el-table-border-color: var(--editor-border);
    --el-table-text-color: var(--editor-text-secondary);
    --el-table-header-text-color: var(--editor-text-muted);
    --el-fill-color-lighter: rgb(255 255 255 / 4%);
    width: 100%;
    background: #0d0f12 !important;

    .el-table__inner-wrapper::before {
      display: none;
    }

    th.el-table__cell {
      background: #000 !important;
      font-weight: 500;
    }

    .el-table__body tr td.el-table__cell {
      background: #0d0f12 !important;
      color: var(--editor-text-secondary);
    }

    .el-table__body tr.el-table__row--striped td.el-table__cell {
      background: rgb(255 255 255 / 3%) !important;
    }

    .el-table__body tr:hover > td.el-table__cell {
      background: #143024 !important;
      color: var(--editor-text) !important;
    }

    .el-table__fixed-right,
    .el-table__fixed-left,
    .el-table__fixed-right-patch {
      background: #0d0f12 !important;
    }
  }

  .editor-admin__row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .editor-admin__tree {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .editor-admin__tree-group {
    border: 1px solid var(--editor-border);
    border-radius: 8px;
    overflow: hidden;
    background: #0a0b0d;
  }

  .editor-admin__tree-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    background: rgb(255 255 255 / 3%);
    border-bottom: 1px solid var(--editor-border);
  }

  .editor-admin__tree-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--editor-text);
  }

  .editor-admin__tree-meta {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--editor-text-muted);
  }

  .editor-admin__meta-sep {
    margin: 0 4px;
    opacity: 0.5;
  }

  .editor-admin__tree-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .editor-admin__tree-empty {
    margin: 0;
    padding: 20px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--editor-text-muted);
  }

  .el-empty__description {
    color: var(--editor-text-muted) !important;
  }

  .el-button {
    --el-button-bg-color: rgb(255 255 255 / 6%);
    --el-button-border-color: var(--editor-border-strong);
    --el-button-text-color: var(--editor-text-secondary);
    --el-button-hover-bg-color: rgb(255 255 255 / 10%);
    --el-button-hover-border-color: rgb(255 255 255 / 22%);
    --el-button-hover-text-color: #fff;

    &.el-button--primary {
      --el-button-bg-color: var(--editor-accent-soft);
      --el-button-border-color: rgb(74 222 128 / 45%);
      --el-button-text-color: var(--editor-accent);
      --el-button-hover-bg-color: rgb(20 48 36 / 92%);
      --el-button-hover-border-color: rgb(74 222 128 / 55%);
      --el-button-hover-text-color: var(--editor-accent-highlight);
    }

    &.el-button--danger.is-plain {
      --el-button-bg-color: rgb(127 29 29 / 28%);
      --el-button-border-color: rgb(248 113 113 / 35%);
      --el-button-text-color: #f87171;
    }

    &.is-link.el-button--primary {
      --el-button-text-color: var(--editor-accent);
    }

    &.is-link.el-button--danger {
      --el-button-text-color: #f87171;
    }
  }

  .el-input__wrapper {
    background: rgb(255 255 255 / 4%) !important;
    box-shadow: inset 0 0 0 1px var(--editor-border-strong) !important;
  }

  .el-input__inner {
    color: var(--editor-text) !important;
  }
}
</style>
