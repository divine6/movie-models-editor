<template>
  <base-dialog
    v-model="visible"
    show-close
    :title="$t('OpWeb.Login.PasswordSafeReminder', '密码安全提醒')"
    width="960px"
    draggable
  >
    <div class="container">
      <div class="title">
        {{ $t("OpWeb.Login.DearUser", "尊敬的用户，您好；") }}
      </div>
      <div class="content">
        {{
          $t(
            "OpWeb.Login.SafeReminder",
            "为了您的账户安全，我们善意提醒您及时更改自己的账户密码，建议将密码修改为英文字符+数字的组合形式，避免您的账号遭受损失。"
          )
        }}
      </div>
    </div>
    <template #footer>
      <el-button @click="handleCancel">{{ $t("OpWeb.Login.NotModify", "暂不修改") }}</el-button>
      <el-button type="primary" @click="handleUpdate">{{ $t("OpWeb.Login.Modify", "去修改") }}</el-button>
    </template>
  </base-dialog>
</template>

<script setup lang="ts">
import { NEED_UPDATE_STORAGE_KEY } from "@/constants";

const emit = defineEmits(["updatePassword"]);

const visible = defineModel<boolean>({ default: false });

const handleCancel = () => {
  visible.value = false;
  localStorage.setItem(NEED_UPDATE_STORAGE_KEY, "false");
};

const handleUpdate = () => {
  visible.value = false;
  emit("updatePassword");
};
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 625px;
  min-height: 300px;
  margin: 0 auto;
  .title {
    font-size: 16px;
    color: var(--text-color-1);
  }
  .content {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-color-1);
    text-indent: 40px;
  }
}
</style>
