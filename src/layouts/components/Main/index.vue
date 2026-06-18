<template>
  <Maximize v-show="maximize" />
  <el-main>
    <router-view v-slot="{ Component: RouteComponent, route: currentRoute }">
      <keep-alive :include="keepAliveName">
        <component :is="createComponentWrapper(RouteComponent, currentRoute)" v-if="isRouterShow" :key="currentRoute.fullPath" />
      </keep-alive>
    </router-view>
  </el-main>
</template>

<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { type Component, defineComponent, h, onBeforeUnmount, provide, ref, watch } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";

import { useGlobalStore } from "@/stores/modules/global";
import { useKeepAliveStore } from "@/stores/modules/keepAlive";

import Maximize from "./components/Maximize.vue";

const globalStore = useGlobalStore();
const { maximize, isCollapse, layout } = storeToRefs(globalStore);

const keepAliveStore = useKeepAliveStore();
const { keepAliveName } = storeToRefs(keepAliveStore);

// 注入刷新页面方法
const isRouterShow = ref(true);
const refreshCurrentPage = (val: boolean) => (isRouterShow.value = val);
provide("refresh", refreshCurrentPage);

// 嵌套包装组件 - 自动支持多层路由嵌套
const NestedWrapper = defineComponent({
  name: "NestedWrapper",
  props: {
    component: {
      type: Object as () => Component,
      required: true
    },
    route: {
      type: Object as () => RouteLocationNormalizedLoaded,
      required: true
    }
  },
  setup(props) {
    return () =>
      h("div", [
        h(props.component),
        h("router-view") // 自动添加嵌套路由出口
      ]);
  }
});

// 解决详情页 keep-alive 问题
const wrapperMap = new Map();
function createComponentWrapper(component: Component, route: RouteLocationNormalizedLoaded) {
  if (!component) return;
  const wrapperName = route.fullPath;
  let wrapper = wrapperMap.get(wrapperName);
  if (!wrapper) {
    wrapper = { name: wrapperName, render: () => h(component) };
    wrapperMap.set(wrapperName, wrapper);
  }
  return h(wrapper);
}

// 监听当前页面是否最大化，动态添加 class
watch(
  () => maximize.value,
  () => {
    const app = document.getElementById("app") as HTMLElement;
    if (maximize.value) app.classList.add("main-maximize");
    else app.classList.remove("main-maximize");
  },
  { immediate: true }
);

// 监听布局变化，在 body 上添加相对应的 layout class
watch(
  () => layout.value,
  () => {
    const body = document.body as HTMLElement;
    body.setAttribute("class", layout.value);
  },
  { immediate: true }
);

// 监听窗口大小变化，折叠侧边栏
const screenWidth = ref(0);
const listeningWindow = useDebounceFn(() => {
  screenWidth.value = document.body.clientWidth;
  if (!isCollapse.value && screenWidth.value < 1200) globalStore.setGlobalState("isCollapse", true);
  if (isCollapse.value && screenWidth.value > 1200) globalStore.setGlobalState("isCollapse", false);
}, 100);
window.addEventListener("resize", listeningWindow, false);
onBeforeUnmount(() => {
  window.removeEventListener("resize", listeningWindow);
});
</script>

<style scoped lang="scss">
@use "./index";
</style>
