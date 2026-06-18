<template>
  <div class="movie-editor" :class="{ 'is-explore': editor.mode === 'explore' }">
    <EditorHeader />
    <ProduceLayout v-if="editor.mode === 'produce'" />
    <ExploreLayout v-else />
    <ModelIntroDialog />
    <video ref="videoRef" class="hidden-video" :src="editor.project.videoSrc ?? undefined" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref, watch } from "vue";

import EditorHeader from "@/components/editor/EditorHeader.vue";
import ProduceLayout from "@/components/editor/ProduceLayout.vue";
import ExploreLayout from "@/components/explorer/ExploreLayout.vue";
import ModelIntroDialog from "@/components/explorer/ModelIntroDialog.vue";
import { EDITOR_KEY } from "@/composables/editor-context";
import { useEditorProject } from "@/composables/useEditorProject";

const editor = useEditorProject();
provide(EDITOR_KEY, editor);

const videoRef = ref<HTMLVideoElement | null>(null);

watch(videoRef, el => {
  editor.videoEl = el;
});

watch(
  () => editor.project.videoSrc,
  async src => {
    if (src) await editor.nextTickVideoMeta();
  }
);

onMounted(() => {
  editor.videoEl = videoRef.value;
});
</script>

<style lang="scss">
@use "@/styles/tokens.scss";
@use "@/styles/editor.scss";

.hidden-video {
  display: none;
}
</style>
