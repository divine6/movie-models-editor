<template>
  <el-config-provider :locale="locale" :size="assemblySize" :button="buttonConfig">
    <base-config-provider :locale="baseLocale">
      <router-view />
      <!-- Service Worker 版本更新提示 -->
      <UpdateVersion v-model="needRefresh" @update="handleUpdate" />
    </base-config-provider>
  </el-config-provider>
</template>

<script setup lang="ts">
import baseEn from "base-components/es/locale/lang/en";
import baseZhCn from "base-components/es/locale/lang/zh-cn";
import { ElConfigProvider } from "element-plus";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { computed, provide, reactive } from "vue";

import UpdateVersion from "@/components/common/update-version/index.vue";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useTheme } from "@/hooks/useTheme";
import type { TranslateFn } from "@/hooks/useTranslate";
import { useGlobalStore } from "@/stores/modules/global";
import { getBrowserLang } from "@/utils";

import { LanguagesEnum } from "./enums";
import { loadRemoteLocale, translate } from "./languages";

const { needRefresh, handleUpdate } = useServiceWorker();

provide<TranslateFn>("t", translate);

const globalStore = useGlobalStore();

const { initTheme } = useTheme();

const initLanguage = async () => {
  const language = (globalStore.language ?? getBrowserLang()) as LanguagesEnum;
  await loadRemoteLocale(language);
  globalStore.setGlobalState("language", language);
};

initTheme();
// initLanguage();

// element language
const locale = computed(() => {
  if (globalStore.language == LanguagesEnum.ZH_CN) return zhCn;
  if (globalStore.language == LanguagesEnum.EN_US) return en;
  return getBrowserLang() == LanguagesEnum.ZH_CN ? zhCn : en;
});

const baseLocale = computed(() => {
  if (globalStore.language == LanguagesEnum.ZH_CN) return baseZhCn;
  if (globalStore.language == LanguagesEnum.EN_US) return baseEn;
  return getBrowserLang() == LanguagesEnum.ZH_CN ? baseZhCn : baseEn;
});

// element assemblySize
const assemblySize = computed(() => globalStore.assemblySize);

// element button config
const buttonConfig = reactive({ autoInsertSpace: false });
</script>
