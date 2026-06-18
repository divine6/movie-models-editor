<template>
  <div class="update-prompt" v-show="needRefresh">
    <div class="update-prompt-title">
      <el-icon color="var(--primary-color-6)"><InfoFilled /></el-icon>
      有新版本可用
    </div>
    <div class="update-prompt-actions">
      <el-link type="primary" @click="handleUpdate">刷新</el-link>
      <el-link @click="handleClose" icon="Close"></el-link>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(["update"]);

const needRefresh = defineModel<boolean>({ default: false });

const handleUpdate = () => emit("update");

const handleClose = () => (needRefresh.value = false);
</script>

<style scoped lang="scss">
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.update-prompt {
  position: fixed;
  top: 30px;
  right: 30px;
  z-index: 9999;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 300px;
  padding: 5px 8px;
  background-color: #ffffff;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 15%);
  animation: slide-in 0.3s ease-out;
}
.update-prompt-title {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color-1);
}
.update-prompt-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
