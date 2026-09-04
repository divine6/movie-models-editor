<template>
  <!-- 导出弹窗 -->
  <el-dialog
    v-model="editor.exporting"
    :title="$t('OpWeb.Editor.Save', '保存')"
    width="320px"
    :show-close="false"
    :close-on-click-modal="false"
  >
    <div style="text-align: center; padding: 16px">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p style="margin-top: 8px; color: var(--text-color-2)">
        {{ $t("OpWeb.Editor.Saving", "正在保存...") }}
      </p>
    </div>
  </el-dialog>

  <Teleport to="body">
    <div v-if="showPersistOverlay" class="editor-persist-mask" role="status" aria-live="polite">
      <div class="editor-persist-card">
        <el-icon class="is-loading editor-persist-spin" :size="28"><Loading /></el-icon>
        <p class="editor-persist-text">{{ persistLabel }}</p>
        <el-progress
          class="editor-persist-bar"
          :percentage="persistPct"
          :stroke-width="8"
          :show-text="true"
          color="#4ade80"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts" name="editor-overlays">
import { Loading } from "@element-plus/icons-vue";
import { computed, unref } from "vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();

const showPersistOverlay = computed(
  () => !!unref(editor.savingScene) || !!unref(editor.savingClips)
);
const persistPct = computed(() => Math.max(0, Math.min(100, Number(unref(editor.persistPercent) || 0))));
const persistLabel = computed(
  () => unref(editor.persistText) || (unref(editor.savingScene) ? "正在更新场景..." : "正在保存动画...")
);
</script>

<style>
.editor-persist-mask {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 46%);
  backdrop-filter: blur(2px);
}

.editor-persist-card {
  width: min(360px, calc(100vw - 40px));
  padding: 22px 22px 18px;
  border-radius: 12px;
  background: #0d0f12;
  border: 1px solid rgb(255 255 255 / 8%);
  box-shadow: 0 16px 48px rgb(0 0 0 / 45%);
  text-align: center;
  --editor-accent: #4ade80;
  --el-color-primary: #4ade80;
}

.editor-persist-spin {
  color: #4ade80;
}

.editor-persist-text {
  margin: 12px 0 14px;
  font-size: 14px;
  line-height: 1.45;
  color: rgb(255 255 255 / 88%);
}

.editor-persist-bar {
  width: 100%;
}

.editor-persist-bar .el-progress-bar__outer {
  background-color: rgb(74 222 128 / 16%) !important;
}

.editor-persist-bar .el-progress-bar__inner {
  background-color: #4ade80 !important;
}

.editor-persist-bar .el-progress__text {
  min-width: 36px;
  font-weight: 600;
  color: #4ade80 !important;
}
</style>
