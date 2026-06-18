import * as Icons from "@element-plus/icons-vue";
import { App } from "vue";

import { iconfontUrl } from "./index";

export default {
  install: (app: App<Element>) => {
    Object.keys(Icons).forEach(key => {
      app.component(key, Icons[key as keyof typeof Icons]);
    });

    const iconfontScript = document.createElement("script");
    iconfontScript.src = "https:" + iconfontUrl;
    iconfontScript.async = true;
    document.body.appendChild(iconfontScript);
  }
};
