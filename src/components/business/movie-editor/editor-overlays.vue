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
</template>

<script setup lang="ts" name="editor-overlays">
import { Loading } from "@element-plus/icons-vue";

import { useMovieEditorContext } from "@/composables/useMovieEditorContext";

const editor = useMovieEditorContext();
</script>
