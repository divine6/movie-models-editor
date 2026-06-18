<template>
  <div class="login">
    <canvas ref="canvas"></canvas>
    <div class="login-form">
      <div class="login-form-header">
        <img class="login-form-header--img" src="@/assets/images/common/logo.svg" alt="" />
        <div class="login-form-header--title">{{ $t("OpWeb.Common.ProjectTitle", "悟匣储能云平台 租赁版") }}</div>
      </div>
      <div class="login-form-content">
        <el-form ref="loginFormRef" label-position="top" :model="loginForm" :rules="rules" label-width="100px">
          <el-form-item :label="$t('OpWeb.Login.TenantId', '租户ID')" prop="tenantId">
            <el-input
              size="large"
              type="number"
              v-model="loginForm.tenantId"
              :placeholder="$t('OpWeb.Login.PleaseInputTenantId', '请输入租户ID')"
            />
          </el-form-item>
          <el-form-item :label="$t('OpWeb.Login.Account', '账号')" prop="account">
            <el-input
              size="large"
              v-model="loginForm.account"
              :placeholder="$t('OpWeb.Login.PleaseInputAccount', '请输入账号')"
            />
          </el-form-item>
          <el-form-item :label="$t('OpWeb.Login.Password', '密码')" prop="password">
            <el-input
              size="large"
              type="password"
              show-password
              v-model="loginForm.password"
              :placeholder="$t('OpWeb.Login.PleaseInputPassword', '请输入密码')"
            />
          </el-form-item>
          <el-form-item class="login-form-content--remember">
            <el-checkbox size="large" v-model="loginForm.rememberMe">{{
              $t("OpWeb.Login.RememberPassword", "记住密码")
            }}</el-checkbox>
            <!-- <el-checkbox size="large" v-model="isMock">{{ $t("OpWeb.Login.MockData", "Mock数据") }}</el-checkbox> -->
          </el-form-item>
          <el-form-item>
            <el-button size="large" @click="handleLogin(loginFormRef)" :loading="loading" style="width: 100%" type="primary">
              {{ $t("OpWeb.Login.Login", "登录") }}
            </el-button>
          </el-form-item>
        </el-form>
        <div class="login-form-footer">
          <div class="login-form-footer--language">
            <el-dropdown v-model="currentLanguage" trigger="click" @command="handleLanguageCommand">
              <div class="login-form-footer--language-trigger">
                <base-icon name="icon-translate-line" size="20" />
                <span>{{ currentLanguageText }}</span>
                <base-icon name="icon-arrow_down-fill" size="20" />
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :command="LanguagesEnum.ZH_CN">简体中文</el-dropdown-item>
                  <el-dropdown-item :command="LanguagesEnum.EN_US">English</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>
    <div class="login-footer">
      {{ $t("OpWeb.Login.Copyright", "版权所有 © 2025 · 用户协议 · 隐私政策 · 沪ICP备16509937号 · 沪公网安备 31010602006888号") }}
    </div>
  </div>
</template>

<script setup lang="ts" name="login">
import { Application } from "@splinetool/runtime";
import CryptoJS from "crypto-js";
import type { FormInstance, FormRules } from "element-plus";
import { computed, onMounted, ref, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";

import { Login } from "@/api/interface";
import { LoginServiceApi } from "@/api/modules/login/index";
import { HOME_URL, LOGIN_ENCRYPTED_KEY } from "@/config";
import { LOGIN_STORAGE_KEY } from "@/constants";
import { LanguagesEnum } from "@/enums";
import { loadRemoteLocale } from "@/languages";
import { useGlobalStore } from "@/stores/modules/global";
import { useUserStore } from "@/stores/modules/user";

const router = useRouter();
const userStore = useUserStore();

const canvas = useTemplateRef("canvas");

const loginFormRef = ref<FormInstance>();

const loading = ref(false);

const currentLanguage = ref(useGlobalStore().language);

// const isMock = ref(useGlobalStore().isMock);

const loginForm = ref<Login.ReqLoginForm>({
  tenantId: "",
  account: "",
  password: "",
  rememberMe: true
});

const rules = ref<FormRules>({
  tenantId: [{ required: true, message: "请输入租户ID", trigger: "blur" }],
  account: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }]
});

const currentLanguageText = computed(() => (currentLanguage.value === LanguagesEnum.ZH_CN ? "简体中文" : "English"));

const handleLanguageCommand = async (command: LanguagesEnum) => {
  await loadRemoteLocale(command);
  currentLanguage.value = command;
  useGlobalStore().setGlobalState("language", command);
};

// watch(isMock, newVal => {
//   useGlobalStore().setGlobalState("isMock", newVal);
// });

/**
 * @description: 加密方法
 */
const encodeAesString = (data: string, encryptedKey: string) => {
  const key = CryptoJS.enc.Utf8.parse(encryptedKey);
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
};

/**
 * @description: 解密方法
 */
const decodeAesString = (data: string, encryptedKey: string) => {
  const key = CryptoJS.enc.Utf8.parse(encryptedKey);
  const decrypted = CryptoJS.AES.decrypt(data, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};

const handleLogin = (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  formEl.validate(async valid => {
    if (!valid) return;
    loading.value = true;
    const encryptedPassword = encodeAesString(loginForm.value.password, LOGIN_ENCRYPTED_KEY);
    const copyLoginForm = { ...loginForm.value, password: encryptedPassword };
    const params = {
      ...loginForm.value,
      password: encryptedPassword,
      encrypted: true,
      loginType: 1, //  1-账号+密码登录 2-账号+密码+图形验证码登录 3-手机号+图形验证码+短信验证码登录
      rememberMe: loginForm.value.rememberMe,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    try {
      const { result } = await LoginServiceApi.login(params);
      userStore.setToken(`${result.tokenPrefix} ${result.accessToken}`);
      userStore.setTenantId(loginForm.value.tenantId);
      userStore.setUserInfo(result.userInfo);

      if (loginForm.value.rememberMe) {
        localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(copyLoginForm));
      } else {
        localStorage.removeItem(LOGIN_STORAGE_KEY);
      }

      router.replace(HOME_URL);
    } finally {
      loading.value = false;
    }
  });
};

// 获取记住的登录信息
const getLoginFormData = () => {
  const loginFormData = localStorage.getItem(LOGIN_STORAGE_KEY);
  if (loginFormData) {
    const loginFormDataObj = JSON.parse(loginFormData);
    const password = decodeAesString(loginFormDataObj.password, LOGIN_ENCRYPTED_KEY);
    loginForm.value = { ...loginFormDataObj, password };
  }
};

// 加载场景
const loadScene = () => {
  const sceneUrl = `${import.meta.env.VITE_PUBLIC_PATH}/scene.splinecode`;
  const app = new Application(canvas.value as HTMLCanvasElement, { wasmPath: "/" });
  app.load(sceneUrl).then(() => console.log("Spline 场景加载完成"));
};
onMounted(() => {
  loadScene();
  getLoginFormData();
});
</script>

<style scoped lang="scss">
@use "./index";
</style>
