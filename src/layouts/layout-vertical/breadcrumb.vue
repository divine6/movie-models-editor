<template>
  <div class="breadcrumb-container">
    <el-space :size="10">
      <el-space :size="6" class="menu-icon">
        <base-icon :name="breadcrumbList?.[0].meta?.icon" :size="20"></base-icon>
        {{ $t(breadcrumbList?.[0].meta?.localeKey, breadcrumbList?.[0].meta?.title) }}
      </el-space>
      <el-breadcrumb :separator-icon="ArrowRight">
        <template v-for="(item, index) in breadcrumbList" :key="item.path">
          <el-breadcrumb-item
            v-if="index !== 0"
            :to="{
              path: item.path,
              // 根据需要决定是否保留查询参数和路径参数
              query: item.query || {},
              params: item.params || {}
            }"
            >{{ $t(item.meta?.localeKey, item.meta?.title) }}
          </el-breadcrumb-item>
        </template>
      </el-breadcrumb>
    </el-space>
  </div>
</template>

<script lang="ts" setup>
import { BaseIcon } from "base-components";
import { h, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const ArrowRight = h(BaseIcon, { name: "icon-arrow_right-line", color: "#86909C", size: 16 });
const route = useRoute();
const router = useRouter();
const breadcrumbList = ref<Record<string, any>[]>([]);

const findNode = (nodes, targetPath) => {
  for (const node of nodes) {
    // 如果找到目标节点，返回该节点
    if (node.path === targetPath) {
      return node;
    }
    // 如果当前节点有子节点，递归查找
    if (node.children && node.children.length > 0) {
      const foundNode = findNode(node.children, targetPath);
      if (foundNode) {
        return foundNode;
      }
    }
  }
  return null; // 未找到
};
// 生成面包屑列表
const getBreadcrumbList = () => {
  const matched = route.matched;
  const breadcrumbs = [...matched];
  const currentRoute = route;
  let findCurrentIndex = breadcrumbs.findIndex(item => item.path === currentRoute.path);
  // 替换
  if (findCurrentIndex !== -1) {
    breadcrumbs[findCurrentIndex] = { ...breadcrumbList[findCurrentIndex], ...currentRoute };
  }
  if (route.meta?.activeMenu) {
    let parentRoute = findNode(matched, route.meta.activeMenu);
    let findCurrentIndex = breadcrumbs.findIndex(item => item.path === route.path);
    if (findCurrentIndex > -1 && parentRoute) {
      breadcrumbs.splice(findCurrentIndex, 0, parentRoute);
    }
  }
  return breadcrumbs.filter(item => item.meta?.title);
};

watch(
  () => route,
  () => {
    breadcrumbList.value = getBreadcrumbList();
  },
  { immediate: true, deep: true }
);

// 组件挂载时确保执行
onMounted(() => {
  // 延迟一小段时间确保路由完全初始化
  setTimeout(() => {
    breadcrumbList.value = getBreadcrumbList();
  }, 0);
});
</script>

<style scoped lang="scss">
.breadcrumb-container {
  padding: var(--gap-4) var(--gap-9) var(--gap-4) var(--gap-7);
  background: var(--fill-color-5);
  border: 1px solid var(--border-color-1);
  border-radius: 50px;
  box-shadow: 0 2px 5px 0 rgb(0 0 0 / 2%);
  .menu-icon {
    padding-right: var(--gap-8);
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
    color: var(--text-color-1);
    border-right: 1px solid var(--border-color-1);
  }
  .el-breadcrumb {
    :deep(.el-breadcrumb__item) {
      font-size: 14px;
      font-weight: 400;
      line-height: 22px; /* 157.143% */
      .el-breadcrumb__inner {
        font-weight: 400;
        color: var(--text-color-1);
      }
      .el-breadcrumb__separator {
        width: auto;
        height: auto;
      }
      &:last-child {
        .el-breadcrumb__inner {
          color: var(--primary-color-6);
          cursor: pointer;
        }
      }
    }
  }
}
</style>
