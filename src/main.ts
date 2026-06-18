//  样式文件
import "@/styles/index.scss";
// 字体样式
import "@/assets/fonts/font.scss";
// svg 图标
import "virtual:svg-icons-register";
import "dayjs/locale/zh-cn";

import { createApp } from "vue";

// 图标
import IconsPlugin from "@/config/icons";
// 自定义指令
import directives from "@/directives/index";
// vue i18n国际化
import I18n, { translate } from "@/languages/index";
// vue 路由
import router from "@/routers";
// pinia 状态管理
import pinia from "@/stores";

import App from "./App.vue";

const app = createApp(App);

const $t: any = (key: string, defaultValue: string, values?: Record<string, any>): string => translate(key, defaultValue, values);

app.config.globalProperties.$t = $t;

app.use(directives).use(router).use(pinia).use(IconsPlugin).use(I18n).mount("#app");
