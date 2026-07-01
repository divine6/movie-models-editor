<template>
  <div
    class="chapter-list-panel"
    :class="{
      'is-preview': editor.isPreviewMode,
      'is-drawer-open': editor.isPreviewMode && drawerOpen
    }"
  >
    <div v-if="!editor.isPreviewMode" class="panel-head">
      <span>{{ $t("OpWeb.Editor.Chapters", "节点编辑") }}</span>
      <div class="panel-head-actions">
        <el-button
          type="primary"
          size="small"
          plain
          :disabled="!editor.canAddChapter"
          :title="$t('OpWeb.Editor.AddChapter', '添加节点')"
          @click="editor.addChapter"
        >
          ＋
        </el-button>
      </div>
    </div>

    <div v-if="editor.isPreviewMode" class="chapter-preview-backdrop" @click="hideChapterDrawer()" />

    <div class="chapter-panel-body">
      <template v-if="editor.isPreviewMode">
        <editor-chapter-preview-drawer @close="hideChapterDrawer()" @play="onPreviewChapterPlay" />
      </template>

      <template v-else>
        <div class="chapter-panel-list">
          <div class="chapter-list" :class="{ 'is-empty': editor.chapters.length === 0 }">
            <div
              v-for="item in editor.chapterTreeList"
              :key="item.chapter.id"
              class="ch-item"
              :class="{
                active: editor.isChapterListActive(item.chapter),
                playing: editor.isChapterPlaying(item.chapter),
                'is-child': !!item.chapter.parentId
              }"
              :style="{ paddingLeft: 12 + item.depth * 18 + 'px' }"
              @click="editor.selectChapter(item.chapter)"
            >
              <span class="ch-dot" />
              <span class="ch-body">
                <span class="ch-name">{{ item.chapter.name }}</span>
                <span class="ch-time">{{ editor.fmt(item.chapter.startTime) }} → {{ editor.fmt(item.chapter.endTime) }}</span>
                <div class="ch-segment-track">
                  <div class="ch-segment-fill" :style="{ width: editor.chapterListFillPct(item.chapter) + '%' }" />
                </div>
              </span>
              <span class="ch-item-actions" @click.stop>
                <el-tooltip :content="$t('OpWeb.Editor.AddChildChapter', '添加子节点')" placement="top">
                  <el-button
                    text
                    type="primary"
                    :disabled="!editor.canAddChildChapter(item.chapter)"
                    @click="editor.addChildChapter(item.chapter)"
                  >
                    ＋
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="$t('OpWeb.Common.Play', '播放')" placement="top">
                  <el-button text type="primary" @click="editor.startChapterPlayback(item.chapter, { autoplay: true, syncVideo: true })">
                    <el-icon><VideoPlay /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="$t('OpWeb.Common.Delete', '删除')" placement="top">
                  <el-button text type="danger" @click="editor.chCmd('del', item.chapter)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </el-tooltip>
              </span>
            </div>
            <div v-if="editor.chapters.length === 0" class="chapter-list-empty">
              <base-empty size="small" :text="$t('OpWeb.Editor.NoChapters', '暂无节点')">
                <template #desc>
                  <div class="chapter-empty-desc">
                    <span class="chapter-empty-desc-text">{{
                      $t("OpWeb.Editor.AddChapterHint", "上传视频后将自动创建节点 1（覆盖全片）")
                    }}</span>
                    <span
                      class="chapter-empty-add-link"
                      :class="{ 'is-disabled': !editor.canAddChapter }"
                      role="button"
                      tabindex="0"
                      :title="$t('OpWeb.Editor.AddChapterNow', '添加节点')"
                      @click="onAddChapter"
                      @keydown.enter="onAddChapter"
                    >
                      ＋
                    </span>
                  </div>
                </template>
              </base-empty>
            </div>
          </div>
        </div>

        <div v-if="editor.chapters.length > 0" class="chapter-panel-detail">
          <div class="chapter-detail-head">
            <span>{{ $t("OpWeb.Editor.ChapterInfo", "节点信息") }}</span>
            <span v-if="editor.selectedChapter" class="chapter-detail-sub">{{ editor.selectedChapter.name }}</span>
          </div>
          <editor-chapter-form />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts" name="editor-chapter-list">
import { Delete, VideoPlay } from "@element-plus/icons-vue";
import { watch } from "vue";

import EditorChapterForm from "@/components/business/movie-editor/editor-chapter-form.vue";
import EditorChapterPreviewDrawer from "@/components/business/movie-editor/editor-chapter-preview-drawer.vue";
import { useMovieEditorContext } from "@/composables/useMovieEditorContext";
import { usePreviewChapterDrawer } from "@/composables/usePreviewChapterDrawer";
import { useTranslate } from "@/hooks/useTranslate";
import type { Chapter } from "@/interface/project";

const editor = useMovieEditorContext();
const { open: drawerOpen, hide: hideChapterDrawer } = usePreviewChapterDrawer();
const $t = useTranslate();

const onAddChapter = () => {
  if (!editor.canAddChapter) return;
  editor.addChapter();
};

const onPreviewChapterPlay = (chapter: Chapter) => {
  void editor.startChapterPlayback(chapter, { autoplay: true, syncVideo: true });
  hideChapterDrawer();
};

watch(
  () => editor.isPreviewMode,
  isPreview => {
    if (!isPreview) hideChapterDrawer();
  }
);
</script>
