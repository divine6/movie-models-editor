// vue-i18n.d.ts
import "vue";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $t: any;
  }
}
