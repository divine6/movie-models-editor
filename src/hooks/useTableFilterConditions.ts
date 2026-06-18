// src/hooks/useTableFilterConditions.ts
import { computed, onMounted, ref, watch } from "vue";

import { UserSearchServiceApi } from "@/api";
import { DEFAULT_PREDEFINED_CONDITIONS } from "@/constants/table-filters-key";
import { $t } from "@/languages";
import { useGlobalStore } from "@/stores/modules/global";

interface UseTableFilterConditionsOptions {
  /** 表格唯一标识 */
  identity: string;
  /** 是否立即获取条件 */
  immediate?: boolean;
  /** 自动同步 conditions 到目标 ref（如 params.value.conditions） */
  syncFn: (conditions: any[]) => void;
}

/**
 * 处理预设条件，将 nameKey 和 nameDefault 转换为动态的 name
 */
function processPredefinedConditions(predefinedConditions: any[]): any[] {
  return predefinedConditions.map(condition => {
    // 如果存在 nameKey 和 nameDefault，则动态计算 name
    if (condition.nameKey && condition.nameDefault !== undefined) {
      return {
        ...condition,
        name: $t(condition.nameKey, condition.nameDefault)
      };
    }
    // 如果已经有 name（向后兼容），则保持原样
    return condition;
  });
}

export function useTableFilterConditions(options: UseTableFilterConditionsOptions) {
  const { identity, syncFn, immediate = true } = options;

  const globalStore = useGlobalStore();
  const rawPredefinedConditions = DEFAULT_PREDEFINED_CONDITIONS[identity] ?? [];

  // 监听语言变化，动态计算预设条件的 name
  const predefinedConditions = computed(() => {
    // 当语言变化时，重新计算 name
    const _ = globalStore.language; // 触发响应式更新
    return processPredefinedConditions(rawPredefinedConditions);
  });

  const conditions = ref<any[]>([]);

  // 仅持久化用户自定义部分，预置部分从DEFAULT_PREDEFINED_CONDITIONS中获取
  const updateConditions = (conditions: any[]) => {
    UserSearchServiceApi.update({
      identity,
      identityValue: JSON.stringify(conditions)
    });
  };

  const getConditions = async () => {
    const { result } = await UserSearchServiceApi.get(identity);
    const customConditions = result?.identityValue ? safeParse(result.identityValue, []) : [];
    // 使用 computed 的值，确保 name 是动态计算的
    conditions.value = [...predefinedConditions.value, ...customConditions];
  };

  // 监听语言变化，重新获取条件以更新 name
  watch(
    () => globalStore.language,
    () => {
      if (conditions.value.length > 0) {
        // 重新处理预设条件
        const customConditions = conditions.value.filter((c: any) => !c.predefined);
        conditions.value = [...predefinedConditions.value, ...customConditions];
      }
    }
  );

  watch(
    conditions,
    newConditions => {
      syncFn(newConditions);
    },
    { deep: true, immediate: true }
  );

  onMounted(() => {
    if (immediate) {
      getConditions();
    }
  });

  return {
    conditions,
    getConditions,
    updateConditions
  };
}

const safeParse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};
