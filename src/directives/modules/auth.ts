/**
 * v-auth
 * 按钮权限指令
 */
import type { Directive, DirectiveBinding } from "vue";

import { OPEN_AUTH } from "@/config";
import { PermissionCode } from "@/constants/permission/index";
import { useUserStore } from "@/stores/modules/user";
const auth: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const { value } = binding;
    const userStore = useUserStore();
    const currentPageRoles = userStore.authCodes;
    if (OPEN_AUTH) {
      let hasPermission = false;
      if (value instanceof Array && value.length) {
        // 数组权限判断：要求所有权限都存在
        const codes = value.map(item => PermissionCode[item] || "");
        hasPermission = codes.every(item => currentPageRoles.includes(item));
      } else if (typeof value === "string") {
        // 单个权限判断：只要包含该权限即可
        const code = PermissionCode[value] || "";
        hasPermission = currentPageRoles.includes(code);
      }
      // 如果 value 是空数组或其他无效值，默认不移除元素
      if (!hasPermission) {
        el.remove();
      }
    }
  }
};

export default auth;
