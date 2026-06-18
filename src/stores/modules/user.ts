import { defineStore } from "pinia";

import { OPEN_AUTH } from "@/config";
import { USER_STORAGE_KEY } from "@/constants";
import { PermissionCode } from "@/constants/permission/index";
import piniaPersistConfig from "@/stores/helper/persist";
import { UserState } from "@/stores/interface";

export const useUserStore = defineStore(USER_STORAGE_KEY, {
  state: (): UserState => ({
    token: "",
    tenantId: "",
    userInfo: {},
    isCollapse: false
  }),
  getters: {
    // 权限码数组
    authCodes: state => state.userInfo?.authorities?.map(item => item.authority) || [],
    havePermission: state => {
      return (code: string) => {
        if (!OPEN_AUTH) return true;
        const authCodes = state.userInfo?.authorities?.map(item => item.authority) || [];
        return authCodes.includes(PermissionCode[code]);
      };
    }
  },
  actions: {
    setToken(token: string) {
      this.token = token;
    },
    setTenantId(tenantId: string) {
      this.tenantId = tenantId;
    },
    setUserInfo(userInfo: UserState["userInfo"]) {
      this.userInfo = userInfo;
    }
  },
  persist: piniaPersistConfig(USER_STORAGE_KEY)
});
