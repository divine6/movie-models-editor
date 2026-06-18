import { inject } from "vue";

import { translate } from "@/languages/index";

export type TranslateFn = (key: string, defaultValue?: string, values?: Record<string, any>) => string;

/**
 * 翻译函数 hook — 供 <script setup> 中使用
 * 模板中可直接使用 $t (来自 app.config.globalProperties.$t)
 *
 * 使用方式: const $t = useTranslate();
 *          $t("key", "默认值")
 */
export function useTranslate(): TranslateFn {
  return inject<TranslateFn>("t", translate);
}
