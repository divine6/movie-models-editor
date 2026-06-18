<template>
  <div class="add-refresh-btn">
    <div class="add-refresh-btn-content">
      <slot></slot>
    </div>
    <el-space :size="10">
      <el-button @click="add">
        <template #icon>
          <base-icon name="icon-add-light" />
        </template>
      </el-button>
      <el-button @click="refresh">
        <template #icon>
          <base-icon name="icon-refresh-light" />
        </template>
      </el-button>
    </el-space>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(["refresh", "add"]);

const refresh = () => {
  emit("refresh");
};

const add = () => emit("add");
</script>

<style scoped lang="scss">
.add-refresh-btn {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  &-content {
    flex: 1;
    > * {
      width: 100% !important;
    }
  }
}
</style>
