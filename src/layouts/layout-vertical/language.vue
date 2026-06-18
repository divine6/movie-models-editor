<template>
  <el-dropdown trigger="click" @command="handleLanguageCommand">
    <div class="item">
      <base-icon name="icon-translate-line" :size="20"></base-icon>
    </div>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="item in languageList" :key="item.value" :command="item.value">
          {{ item.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { LanguagesEnum } from "@/enums";
import { loadRemoteLocale } from "@/languages";
import { useGlobalStore } from "@/stores/modules/global";

const globalStore = useGlobalStore();

const languageList = [
  { label: "简体中文", value: LanguagesEnum.ZH_CN },
  { label: "English", value: LanguagesEnum.EN_US }
];

const handleLanguageCommand = async (command: LanguagesEnum) => {
  await loadRemoteLocale(command);
  globalStore.setGlobalState("language", command);
};
</script>

<style lang="scss" scoped>
.item {
  height: 40px;
  padding: var(--gap-4) var(--gap-5);
  line-height: normal;
  color: var(--text-color-1);
  cursor: pointer;
  background-color: var(--fill-color-5);
  border-radius: 50%;
  .icon {
    margin-top: -4px;
  }
}
</style>
