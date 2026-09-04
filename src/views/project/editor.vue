<template>
  <div
    class="movie-editor editor-dark-theme"
    :class="{
      'preview-mode': editor.isPreviewMode,
      'view-only-route': editor.viewOnly,
      'is-initializing': editor.editorInitializing
    }"
    :tabindex="editor.viewOnly ? -1 : 0"
    :inert="editor.editorInitializing"
    :ref="editor.bindRef('rootEl')"
    @keydown="editor.onKey"
  >
    <editor-header />

    <div class="editor-body">
      <!-- 左侧：节点列表 -->
      <aside v-if="editor.showNodePanel" class="panel-left visible editor-body__chapters">
        <editor-chapter-list />
      </aside>

      <!-- 中间：Three.js 实时预览视口 -->
      <div class="editor-body__center">
        <editor-viewport />
      </div>

      <!-- 右侧：参数编辑面板（预览用 CSS 隐藏，避免 v-if 反复销毁导致堆内存爬升） -->
      <div v-if="editor.nodes.length > 0" class="editor-body__right">
        <editor-config-panel />
      </div>
    </div>

    <editor-overlays />
  </div>

  <Teleport to="body">
    <div
      v-if="editor.editorInitializing"
      class="editor-boot-gate"
      data-testid="editor-boot-loading"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      :aria-label="bootLoadingText"
    >
      <el-icon class="is-loading editor-boot-gate__icon" :size="36"><Loading /></el-icon>
      <span class="editor-boot-gate__text">{{ bootLoadingText }}</span>
      <span v-if="bootLoadingHint" class="editor-boot-gate__hint">{{ bootLoadingHint }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts" name="project-editor">
import { Loading } from "@element-plus/icons-vue";
import { computed, provide as vueProvide } from "vue";

import EditorChapterList from "@/components/business/movie-editor/editor-chapter-list.vue";
import EditorConfigPanel from "@/components/business/movie-editor/editor-config-panel.vue";
import EditorHeader from "@/components/business/movie-editor/editor-header.vue";
import EditorOverlays from "@/components/business/movie-editor/editor-overlays.vue";
import EditorViewport from "@/components/business/movie-editor/editor-viewport.vue";
import { MOVIE_EDITOR_KEY, useMovieEditor } from "@/composables/useMovieEditor";
import { providePreviewChapterDrawer } from "@/composables/usePreviewChapterDrawer";

const editor = useMovieEditor();
const bootLoadingText = computed(() => (editor.viewOnly ? "加载中......" : "正在初始化编辑器..."));
const bootLoadingHint = computed(() => (editor.viewOnly ? "" : "场景、模型与视口就绪后可操作"));
vueProvide(MOVIE_EDITOR_KEY, editor);
providePreviewChapterDrawer();

if (import.meta.env.DEV) {
  (window as any).__movieEditorTest = {
    get videoOnlyMode() {
      return editor.videoOnlyMode;
    },
    get viewOnly() {
      return editor.viewOnly;
    },
    get selectedNodeId() {
      return editor.selectedNodeId;
    },
    get selectedChapterId() {
      return editor.selectedChapterId;
    },
    get activeVideoId() {
      return editor.activeVideoId;
    },
    get hasVideo() {
      return editor.hasVideo;
    },
    get currentTime() {
      return editor.currentTime;
    },
    get isPlaying() {
      return editor.isPlaying;
    },
    get presentationUiChapterId() {
      return editor.presentationUiChapterId;
    },
    get presentationNavIndex() {
      return editor.presentationNavIndex;
    },
    get presentationNavChapters() {
      return editor.presentationNavChapters.map(ch => ({
        id: ch.id,
        name: ch.name,
        startTime: ch.startTime,
        endTime: ch.endTime
      }));
    },
    get nodes() {
      return JSON.parse(JSON.stringify(editor.nodes ?? []));
    },
    get chapterSubtitles() {
      return JSON.parse(JSON.stringify(editor.chapterSubtitles ?? []));
    },
    get sceneCode() {
      return editor.sceneCode;
    },
    get isPreviewMode() {
      return editor.isPreviewMode;
    },
    get editorInitializing() {
      return editor.editorInitializing;
    },
    getPresentationNavChapters: () =>
      editor.presentationNavChapters.map(ch => ({
        id: ch.id,
        name: ch.name,
        startTime: ch.startTime,
        endTime: ch.endTime
      })),
    getActiveChapterIdForUi: () => editor.getActiveChapterIdForUi(),
    prevCh: () => editor.prevCh(),
    nextCh: () => editor.nextCh(),
    togglePlay: () => editor.togglePlay(),
    togglePreview: () => editor.togglePreview(),
    jumpToChapterId: (id: string) => {
      const ch =
        editor.presentationNavChapters.find((c: { id: string }) => c.id === id) ??
        editor.chapters.find((c: { id: string }) => c.id === id);
      if (ch) editor.jumpToChapter(ch);
    },
    getPlaybackSession: () => ({ ...editor.presentationPlaybackSession }),
    getPresentationModelState: (modelId: string) => editor.getPresentationModelState(modelId),
    getScenePoseDigest: () => editor.getScenePoseDigest?.() ?? null,
    inspectPlayback: () => {
      const clock = editor.playbackClock as { time?: number; duration?: number; playing?: boolean } | null;
      const activeVideoId = editor.activeVideoId;
      const chapters = (editor.chapters || [])
        .filter((ch: { parentId?: string }) => !activeVideoId || ch.parentId === activeVideoId)
        .map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          parentId: ch.parentId,
          startTime: ch.startTime,
          endTime: ch.endTime,
          clipCount: ch.clips?.length ?? 0,
          targetCount: (ch.clips || []).reduce(
            (n: number, c: { targets?: unknown[] }) => n + (c.targets?.length ?? 0),
            0
          ),
          hasCamera: !!(ch.clips || []).some((c: { camera?: unknown }) => !!c.camera) || !!ch.camera,
          fillPct: editor.chapterListFillPct(ch),
          modelConfig: (() => {
            const cfgs = ch.modelConfigs || {};
            const ids = Object.keys(cfgs);
            const first = ids[0] ? cfgs[ids[0]] : null;
            return {
              modelIds: ids,
              animation: !!first?.animation,
              visible: first?.visible,
              nodeConfigCount: Object.keys(first?.nodeConfigs || {}).length,
              segmentCount: first?.animConfig?.segments?.length ?? 0
            };
          })()
        }));
      const barLabel = document.querySelector(".progress-chapter")?.textContent?.trim() || "";
      const selectedRow = document.querySelector(".scene-node-row.active .scene-node-name");
      return {
        selectedNodeId: editor.selectedNodeId,
        selectedChapterId: editor.selectedChapterId,
        activeVideoId,
        currentTime: editor.currentTime,
        duration: editor.duration,
        isPlaying: editor.isPlaying,
        isPreviewMode: editor.isPreviewMode,
        clockTime: clock?.time ?? editor.currentTime,
        clockDuration: clock?.duration ?? editor.duration,
        clockPlaying: !!clock?.playing,
        uiChapterId: editor.getActiveChapterIdForUi(),
        barLabel,
        selectedRowName: selectedRow?.textContent?.trim() || "",
        lastCut: (window as any).__movieEditorLastCut || null,
        pose: editor.getScenePoseDigest?.() ?? null,
        visAudit: editor.getVisibilityAudit?.() ?? null,
        vis: (() => {
          const audit = (editor.getVisibilityAudit?.() ?? []) as Array<{
            modelId?: string;
            name?: string;
            rootVisible?: boolean;
            worldVisMeshes?: number;
            worldHidMeshes?: number;
            hiddenAncestors?: string[];
          }>;
          if (audit.length) {
            const worldVis = audit.reduce((n, a) => n + (a.worldVisMeshes || 0), 0);
            const worldHid = audit.reduce((n, a) => n + (a.worldHidMeshes || 0), 0);
            return {
              hidden: worldHid,
              shown: worldVis,
              hiddenNames: audit.flatMap(a => a.hiddenAncestors || []).slice(0, 8),
              roots: audit.map(a => ({
                modelId: a.modelId,
                name: a.name,
                rootVisible: a.rootVisible,
                worldVisMeshes: a.worldVisMeshes,
                worldHidMeshes: a.worldHidMeshes
              }))
            };
          }
          const pose = editor.getScenePoseDigest?.() ?? [];
          let hidden = 0;
          let shown = 0;
          const names: string[] = [];
          for (const s of pose as Array<{ visible?: boolean; name?: string }>) {
            if (s.visible === false) {
              hidden++;
              if (names.length < 8 && s.name) names.push(s.name);
            } else shown++;
          }
          return { hidden, shown, hiddenNames: names };
        })(),
        chapters
      };
    },
    getVideoState: () => ({
      paused: editor.videoEl?.paused ?? true,
      ended: editor.videoEl?.ended ?? false,
      currentTime: editor.videoEl?.currentTime ?? 0,
      duration: editor.videoEl?.duration ?? 0,
      readyState: editor.videoEl?.readyState ?? 0
    }),
    loadSceneForEdit: (code: string) => editor.loadSceneForEdit(code),
    openChapterDrawer: () => {
      const btn = document.querySelector(".editor-header [data-testid='open-chapter-drawer']") as HTMLElement | null;
      btn?.click();
    }
  };
}
</script>

<!-- 样式嵌套在 .movie-editor 下，不加 scoped 以便子组件继承 -->
<style lang="scss">
@use "@/components/business/movie-editor/styles/index.scss";

.movie-editor.is-initializing {
  pointer-events: none;
  user-select: none;
}

.editor-boot-gate {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgb(10 11 13 / 92%);
  color: rgb(255 255 255 / 88%);
  font-size: 14px;
  pointer-events: auto;
  backdrop-filter: blur(4px);

  &__icon {
    margin-bottom: 4px;
  }

  &__text {
    font-size: 15px;
    font-weight: 500;
  }

  &__hint {
    font-size: 12px;
    color: rgb(255 255 255 / 48%);
  }
}
</style>
