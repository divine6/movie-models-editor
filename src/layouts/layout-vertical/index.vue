<template>
  <el-container class="layout" :class="{ 'layout--full': isFullPage }">
    <div v-if="!isFullPage" class="layout-menu-wraper" :style="{ paddingLeft: isCollapse ? 0 : 'var(--gap-5)' }">
      <base-menu :collapse="isCollapse" :options="menuOptions">
        <template #logo>
          <div class="menu-logo">
            <img src="@/assets/images/common/logo.svg" alt="" />
          </div>
        </template>
        <template #footer>
          <div class="footer">Powered by UltimateBox</div>
        </template>
      </base-menu>
    </div>
    <el-container class="layout-main">
      <el-header v-if="!isFullPage">
        <div class="left">
          <el-space :size="10">
            <div class="icon-box" v-if="!isCollapse" @click="onCollapse">
              <base-icon name="icon-menu_collapse-line" :size="20"></base-icon>
            </div>
            <div v-else class="icon-box" @click="onCollapse" @mouseenter="onMouseenter" @mouseleave="onMouseleave">
              <base-icon name="icon-menu_more-line" :size="20"></base-icon>
            </div>
            <breadcrumb />
          </el-space>
        </div>
        <header-operate />
      </el-header>
      <Main />
    </el-container>
  </el-container>
  <!-- 圆形背景渐变 -->
  <div
    v-show="!isFullPage && !isCollapse"
    class="circle"
    :style="{ transform: `translate(-50%, calc(-50% + ${circleY}px)` }"
  ></div>
  <!-- 悬浮菜单 -->
  <div
    v-show="!isFullPage && isCollapse"
    class="preview-container"
    :class="{ show: isHover }"
    :style="{ width: menuOptions.width ? menuOptions.width : '260px' }"
    @mouseover="isHover = true"
    @mouseleave="isHover = false"
  >
    <base-menu :collapse="isCollapse" :options="menuOptions">
      <template #logo>
        <div class="menu-logo">
          <img src="@/assets/images/common/logo.svg" alt="" />
        </div>
      </template>
      <template #footer>
        <div class="footer">Powered by UltimateBox</div>
      </template>
    </base-menu>
  </div>
</template>

<script setup lang="ts" name="layoutVertical">
import { type BaseMenuOptions } from "base-components";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";

import { OPEN_AUTH } from "@/config";
import { IS_OWNER } from "@/config/app-type";
import Main from "@/layouts/components/Main/index.vue";
import { ownerRouter } from "@/routers/modules/ownerRouter";
import { tenantRouter } from "@/routers/modules/tenantRouter";
import { useUserStore } from "@/stores/modules/user";

import breadcrumb from "./breadcrumb.vue";
import headerOperate from "./header-operate.vue";

const userStore = useUserStore();
const route = useRoute();

const isFullPage = computed(() => Boolean(route.meta.isFull));
const isCollapse = computed(() => userStore.isCollapse);
const isHover = ref(false); //是否hover
const isFirstHover = ref(false);

// 根据应用类型获取正确的路由
const getCurrentRouter = () => {
  if (IS_OWNER) {
    return ownerRouter;
  }
  return tenantRouter;
};

// 菜单配置项
const menuOptions = computed<BaseMenuOptions>(() => ({
  routes: getCurrentRouter(),
  hasPermission: (code: string | string[] | undefined) => {
    if (OPEN_AUTH) {
      return userStore.havePermission(code as string);
    } else {
      return true;
    }
  },
  translate: (localeKey: string | undefined, defaultName: string | undefined) => $t(localeKey ?? "", defaultName || "")
}));

const onCollapse = () => {
  userStore.isCollapse = !userStore.isCollapse;
  isHover.value = false;
  isFirstHover.value = false;
};

const onMouseenter = () => {
  if (isFirstHover.value) {
    setTimeout(() => {
      isHover.value = true;
    }, 100);
  }
  isFirstHover.value = true;
};

const onMouseleave = () => {
  isHover.value = false;
};

// 圆形Y轴位置
const circleY = ref(0);
// 目标Y轴位置（鼠标位置）
const targetY = ref(0);

// 鼠标移动处理
const handleMouseMove = e => {
  if (e.clientX <= 300) {
    // 鼠标在交互区域内
    targetY.value = e.clientY;
    circleY.value = e.clientY;
  } else {
    targetY.value = 0;
    circleY.value = 0;
  }
};

// 生命周期钩子
onMounted(() => {
  window.addEventListener("mousemove", handleMouseMove);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", handleMouseMove);
});
</script>

<style scoped lang="scss">
@use "./index";
</style>
