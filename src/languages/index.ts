import { createI18n } from "vue-i18n";

import { LanguageServiceApi } from "@/api";
import { LanguagesEnum } from "@/enums";
import { getBrowserLang } from "@/utils";

import en from "./lang/en";
import zhCn from "./lang/zh-cn";

const i18n = createI18n({
  allowComposition: true,
  legacy: false,
  globalInjection: false,
  locale: getBrowserLang() as LanguagesEnum,
  messages: {}
});

export const translate = (key: string, defaultValue?: string, values?: Record<string, any>) => {
  const result = i18n.global.t(key, values ?? {});
  // 当 key 不存在时，vue-i18n 返回 key 本身
  if (result === key && defaultValue) return defaultValue;
  return result;
};

// 创建全局的 $t 函数
export const $t = (key: string, defaultValue?: string, values?: Record<string, any>) => translate(key, defaultValue, values);

// 将 $t 函数挂载到全局作用域，支持直接调用而不需要 window.$t
(globalThis as any).$t = $t;

/**
 * 加载远程语言包
 */
export async function loadRemoteLocale(lang: LanguagesEnum) {
  if (!lang) return;

  const isLocalFlag = false;

  if (isLocalFlag) {
    i18n.global.setLocaleMessage(lang, lang === LanguagesEnum.EN_US ? en : zhCn);
    // 3. 等待 vue-i18n 响应式更新
    i18n.global.locale.value = lang;
    return;
  }
  const promiseList = [LanguageServiceApi.list("1", lang), LanguageServiceApi.list("2", lang)];
  // 1. 拉取语言包
  const [webRes, apiRes] = await Promise.all(promiseList);
  const messages = {
    ...webRes.result.values,
    ...apiRes.result.values
  };
  // // 2. 设置语言包
  i18n.global.setLocaleMessage(lang, messages);
  // 3. 等待 vue-i18n 响应式更新
  i18n.global.locale.value = lang;
}

export default i18n;
