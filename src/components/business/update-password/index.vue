<template>
  <base-drawer-form v-model:visible="visible" v-model="formData" :options="formOptions" @confirm="handleSubmit">
    <template #header>
      <span>{{ $t("OpWeb.Common.ModifyPassword", "修改密码") }}</span>
    </template>
    <template #oldPwd>
      <el-input
        type="password"
        show-password
        clearable
        v-model="formData.oldPwd"
        :placeholder="$t('OpWeb.Common.PleaseEnterOldPassword', '请输入旧密码')"
        autocomplete="new-password"
      ></el-input>
    </template>
    <template #newPwd>
      <el-input
        type="password"
        show-password
        clearable
        v-model="formData.newPwd"
        :placeholder="$t('OpWeb.Common.PleaseEnterNewPassword', '请输入新密码')"
        autocomplete="new-password"
      ></el-input>
    </template>
    <template #confirmPwd>
      <el-input
        type="password"
        show-password
        clearable
        v-model="formData.confirmPwd"
        :placeholder="$t('OpWeb.Common.PleaseEnterConfirmPassword', '请输入确认密码')"
        autocomplete="new-password"
      ></el-input>
    </template>
  </base-drawer-form>
</template>

<script setup lang="ts">
import type { BaseFormOptionsProps } from "base-components";
import { ElMessage } from "element-plus";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { updateUserPassWordApi } from "@/api/modules/sys-mgt/user-mgt";
import { LOGIN_URL } from "@/config";
import { useUserStore } from "@/stores/modules/user";
import { passwordRegxp } from "@/utils/regex";

const router = useRouter();
const userStore = useUserStore();
const visible = defineModel<boolean>({ default: false });

// 检查新密码
const checkPassword = (rule: any, value: any, callback: any) => {
  if (!value) {
    return callback($t("OpWeb.Common.PasswordOnlySupportsTips", "密码仅支持英文，或英文与数字组合，且长度需≥6位"));
  }
  if (!passwordRegxp.test(value)) {
    callback(new Error($t("OpWeb.Common.PasswordOnlySupportsTips", "密码仅支持英文，或英文与数字组合，且长度需≥6位")));
  } else {
    callback();
  }
};

// 检查确认密码
const checkConfirmPassword = (rule: any, value: any, callback: any) => {
  if (!value) {
    return callback($t("OpWeb.Common.PasswordNotMatchTips", "新密码和确认密码不一致"));
  }
  if (formData.value.newPwd !== value) {
    callback(new Error($t("OpWeb.Common.PasswordNotMatchTips", "新密码和确认密码不一致")));
  } else {
    callback();
  }
};

const formOptions = computed<Array<BaseFormOptionsProps>>(() => [
  {
    colProps: { span: 24 },
    items: [
      {
        type: "slot",
        prop: "oldPwd",
        label: $t("OpWeb.Common.OldPassword", "旧密码"),
        rules: [
          {
            required: true,
            message: $t("OpWeb.Common.PleaseEnterOldPassword", "请输入旧密码"),
            trigger: "blur"
          }
        ],
        placeholder: $t("OpWeb.Common.PleaseEnterOldPassword", "请输入旧密码")
      },
      {
        type: "slot",
        prop: "newPwd",
        label: $t("OpWeb.Common.NewPassword", "新密码"),
        rules: [{ required: true, validator: checkPassword, trigger: "blur" }],
        placeholder: $t("OpWeb.Common.PleaseEnterNewPassword", "请输入新密码")
      },
      {
        type: "slot",
        prop: "confirmPwd",
        label: $t("OpWeb.Common.ConfirmPassword", "确认密码"),
        rules: [{ required: true, validator: checkConfirmPassword, trigger: "blur" }],
        placeholder: $t("OpWeb.Common.PleaseEnterConfirmPassword", "请输入确认密码")
      }
    ]
  }
]);

const formData = ref<Record<string, any>>({});

const handleSubmit = async done => {
  try {
    let res = await updateUserPassWordApi(formData.value);
    if (res.code == 200) {
      ElMessage.success($t("OpWeb.Common.ModifySuccess", "修改成功"));
      // 2.清除 Token
      userStore.setToken("");
      userStore.setTenantId("");
      userStore.setUserInfo({});
      // 3.重定向到登陆页
      router.replace(LOGIN_URL);
    }
  } finally {
    done();
  }
};
</script>
