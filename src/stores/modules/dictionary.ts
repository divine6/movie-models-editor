import { defineStore } from "pinia";
import { ref } from "vue";

import { CommonServiceApi } from "@/api";
import { DICTIONARY_STORAGE_KEY } from "@/constants";
import { convertFrontendDict, getFrontendDictConfig } from "@/constants/dictionary/dictCommom";
import piniaPersistConfig from "@/stores/helper/persist";
import { DictAccessor } from "@/utils/dictionary/dictAccessor";
import { mergeDictData, updateDictColors } from "@/utils/dictionary/dictMerger";

export const useDictionaryStore = defineStore(
  DICTIONARY_STORAGE_KEY,
  () => {
    // 状态
    // 后端字典
    const backendDictionary = ref<Record<string, any>>({});
    // 前端字典
    const frontendDictionary = ref<Record<string, any>>({});
    const loading = ref(false);
    const error = ref<string | null>(null);

    // 字典访问器（保持单例，内部数据动态更新）
    const accessor = new DictAccessor(backendDictionary.value, frontendDictionary.value);

    // 初始化前端字典
    const initFrontendDictionary = () => {
      frontendDictionary.value = convertFrontendDict(getFrontendDictConfig());
      accessor.updateFrontendDictionary(frontendDictionary.value);
    };

    // 方法
    const fetchDictionary = async () => {
      try {
        loading.value = true;
        error.value = null;

        // 调用后端API获取字典数据
        const res = await CommonServiceApi.staticDictionary();
        if (res.success) {
          // 合并后端数据与前端颜色配置
          const mergedData = mergeDictData(res.result);
          backendDictionary.value = mergedData;
          accessor.updateBackendDictionary(backendDictionary.value);
        } else {
          throw new Error(res.key || "获取字典失败");
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : "获取字典失败";
        console.error("获取字典失败:", err);
      } finally {
        loading.value = false;
      }
    };

    const updateDictionaryColors = (type: string) => {
      const updated = updateDictColors(backendDictionary.value, type);
      backendDictionary.value = updated;
      accessor.updateBackendDictionary(backendDictionary.value);
    };

    // 刷新字典
    const refreshDictionary = async () => {
      await fetchDictionary();
      initFrontendDictionary();
    };

    // 清除字典访问器缓存（用于语言切换时）
    const clearAccessorCache = () => {
      accessor.clearCache();
    };

    // initFrontendDictionary();
    // refreshDictionary();

    return {
      // 状态
      backendDictionary,
      frontendDictionary,
      loading,
      error,

      // 计算属性
      accessor,

      // 方法
      fetchDictionary,
      updateDictionaryColors,
      refreshDictionary,
      initFrontendDictionary,
      clearAccessorCache
    };
  },
  { persist: piniaPersistConfig(DICTIONARY_STORAGE_KEY) }
);
