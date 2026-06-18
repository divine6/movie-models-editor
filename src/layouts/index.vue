<!-- 💥 这里是一次性加载 LayoutComponents -->
<template>
  <el-watermark id="watermark" :font="font" :content="watermark ? ['UltimateBox', 'Happy Working'] : ''">
    <component :is="LayoutComponents[layout]" />
  </el-watermark>
</template>

<script setup lang="ts" name="layout">
import { type Component, computed, reactive, watch } from "vue";

import { LayoutType } from "@/stores/interface";
import { useGlobalStore } from "@/stores/modules/global";

import LayoutVertical from "./layout-vertical/index.vue";

const LayoutComponents: Partial<Record<LayoutType, Component>> = {
  vertical: LayoutVertical
};

const globalStore = useGlobalStore();

const isDark = computed(() => globalStore.isDark);
const layout = computed(() => globalStore.layout);
const watermark = computed(() => globalStore.watermark);

const font = reactive({ color: "rgba(0, 0, 0, .15)" });
watch(isDark, () => (font.color = isDark.value ? "rgba(255, 255, 255, .15)" : "rgba(0, 0, 0, .15)"), {
  immediate: true
});
</script>

<style scoped lang="scss">
.layout {
  min-width: 600px;
}
</style>
