<template>
  <el-space class="operate" :size="16">
    <Language></Language>
    <el-dropdown trigger="click" @command="handleAccountCommand">
      <div class="item">
        <base-icon name="icon-user-line" :size="20"></base-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="updatePassword"> {{ $t("OpWeb.Login.ModifyPassword", "修改密码") }} </el-dropdown-item>
          <el-dropdown-item command="accountCenter"> {{ $t("OpWeb.Login.AccountCenter", "账号中心") }} </el-dropdown-item>
          <el-dropdown-item command="logout"> {{ $t("OpWeb.Login.Logout", "退出登录") }} </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-space>
  <update-password v-model="showPassWordForm" />
  <safe-reminder v-model="showSafeReminder" @update-password="showPassWordForm = true" />
  <account-center v-model="showAccountCenter" />
</template>

<script lang="ts" setup>
import { ElMessage, ElMessageBox } from "element-plus";
import { ref, watch } from "vue";
import { useRouter } from "vue-router";

import { LoginServiceApi } from "@/api/modules/login/index";
import accountCenter from "@/components/business/account-center/index.vue";
import updatePassword from "@/components/business/update-password/index.vue";
import safeReminder from "@/components/business/update-password/safe-reminder.vue";
import { LOGIN_URL } from "@/config";
import { DICTIONARY_STORAGE_KEY, NEED_UPDATE_STORAGE_KEY, USER_STORAGE_KEY } from "@/constants";
import { useGlobalStore } from "@/stores/modules/global";
import { useUserStore } from "@/stores/modules/user";

import Language from "./language.vue";

const router = useRouter();
const userStore = useUserStore();
const globalStore = useGlobalStore();
const timeZoneId = ref(userStore.userInfo.timezoneId);

const showPassWordForm = ref(false);
const showAccountCenter = ref(false);
const showSafeReminder = ref(false);

watch(
  () => timeZoneId.value,
  newVal => {
    userStore.setUserInfo({ ...userStore.userInfo, timezoneId: newVal });
    LoginServiceApi.updateTimezone({ timezoneId: newVal });
  }
);

// 当第一次登录时，检查显示密码安全提醒
watch(
  () => userStore.userInfo.needUpdate,
  newVal => {
    const safeReminder = localStorage.getItem(NEED_UPDATE_STORAGE_KEY);
    if (newVal === 1 && safeReminder !== "false") {
      showSafeReminder.value = true;
    }
  },
  { immediate: true }
);

const handleAccountCommand = (command: string) => {
  if (command === "logout") {
    logoutApi();
  }
  if (command === "updatePassword") {
    showPassWordForm.value = true;
  }
  if (command === "accountCenter") {
    showAccountCenter.value = true;
  }
};

const logoutApi = () => {
  ElMessageBox.confirm($t("OpWeb.Login.ConfirmLogout", "您是否确认退出登录?"), $t("OpWeb.Login.Tips", "温馨提示"), {
    confirmButtonText: $t("OpWeb.Common.Confirm", "确定"),
    cancelButtonText: $t("OpWeb.Common.Cancel", "取消"),
    center: true,
    type: "warning"
  }).then(async () => {
    // 1.执行退出登录接口
    await LoginServiceApi.logout();
    // 2.清除 Token
    userStore.setToken("");
    userStore.setTenantId("");
    userStore.setUserInfo({});
    localStorage.removeItem(DICTIONARY_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    // 3.重定向到登陆页
    router.replace(LOGIN_URL);

    ElMessage.success($t("OpWeb.Login.LogoutSuccess", "退出登录成功！"));
  });
};
</script>
<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: var(--gap-4) var(--gap-5);
  color: var(--text-color-1);
  cursor: pointer;
  background-color: var(--fill-color-5);
  border-radius: 50%;
  .icon {
    margin-top: -4px;
  }
}
</style>
