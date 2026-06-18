<template>
  <base-dialog v-model="visible" :title="$t('OpWeb.Login.AccountCenter', '账号中心')" show-close :width="1000">
    <template #footer>
      <el-button type="primary" @click="visible = false">{{ $t("OpWeb.Common.Close", "关闭") }}</el-button>
    </template>
    <div class="account-center">
      <div class="title">{{ $t("OpWeb.Login.AccountCenter.AccountInfo", "账号信息") }}</div>
      <div class="tips">{{ $t("OpWeb.Login.AccountCenter.ShowPersonalAccountInfo", "展示个人账号相关信息") }}</div>
      <div class="info base-info">
        <el-row :gutter="16">
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.TenantId", "租户ID") }}</div>
              <div class="value">{{ userInfo.tenantId || "--" }}</div>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.LoginName", "登录名") }}</div>
              <div class="value">{{ userInfo.account || "--" }}</div>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.RoleName", "角色名称") }}</div>
              <div class="value">{{ roleNames }}</div>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.Name", "姓名") }}</div>
              <div class="value">{{ userInfo.nickname || "--" }}</div>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.Mobile", "手机号") }}</div>
              <div class="value">{{ userInfo.mobile || "--" }}</div>
            </div>
          </el-col>
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.Email", "邮箱") }}</div>
              <div class="value">{{ userInfo.email || "--" }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
      <div class="title">{{ $t("OpWeb.Login.AccountCenter.TenantQuotaInfo", "租户额度信息") }}</div>
      <div class="tips">{{ $t("OpWeb.Login.AccountCenter.ShowTenantQuotaInfo", "展示租户各类额度及有效期信息") }}</div>
      <div class="info base-info">
        <el-row :gutter="16">
          <el-col :span="24">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.PlatformValidityPeriod", "平台有效期") }}</div>
              <div class="value">{{ tenantQuotaInfo.startTime }} ~ {{ tenantQuotaInfo.endTime }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="item">
              <div class="label">
                {{ $t("OpWeb.Login.AccountCenter.InstallCapacityUsedQuota/TotalQuota", "装机容量已使用额度/总额度") }}
              </div>
              <div class="value">{{ quotaRatio }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.InstallCapacitySurplusQuota", "装机容量剩余额度") }}</div>
              <div class="value">{{ surplusLimit }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="item">
              <div class="label">
                {{ $t("OpWeb.Login.AccountCenter.OtherDeviceAccessUsedQuota/TotalQuota", "其他设备接入已使用额度/总额度") }}
              </div>
              <div class="value">
                {{ `${tenantQuotaInfo.otherDeviceUseCount ?? "--"}/${tenantQuotaInfo.otherDeviceCount ?? "--"}` }}
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.OtherDeviceAccessSurplusQuota", "其他设备接入剩余额度") }}</div>
              <div class="value">{{ tenantQuotaInfo.otherDeviceLeftCount ?? "--" }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="item">
              <div class="label">
                {{ $t("OpWeb.Login.AccountCenter.AlarmRuleUsedQuota/TotalQuota", "告警规则已使用额度/总额度") }}
              </div>
              <div class="value">{{ `${tenantQuotaInfo.alarmUseCount ?? "--"}/${tenantQuotaInfo.alarmLimitCount ?? "--"}` }}</div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="item">
              <div class="label">{{ $t("OpWeb.Login.AccountCenter.AlarmRuleSurplusQuota", "告警规则剩余额度") }}</div>
              <div class="value">{{ tenantQuotaInfo.alarmLeftCount ?? "--" }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
  </base-dialog>
</template>
<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";

import { getTenantQuotaApi } from "@/api/modules/sys-mgt/user-mgt";
import { useUserStore } from "@/stores/modules/user";
import { convertEnergyUnit } from "@/utils/unit-convert";
const userStore = useUserStore();
const visible = defineModel<boolean>({ default: false });
const tenantQuotaInfo = ref<any>({});
const userInfo = computed(() => userStore.userInfo);
const roleNames = computed(() => {
  if (userInfo.value.roleNames && userInfo.value.roleNames.length > 0) {
    return userInfo.value.roleNames.join(",");
  } else {
    return "--";
  }
});

const quotaRatio = computed(() => {
  let totalLimitItem = convertEnergyUnit(tenantQuotaInfo.value.totalLimit);
  let usedLimitItem = convertEnergyUnit(tenantQuotaInfo.value.usedLimit);
  return `${usedLimitItem.value ?? "--"}${usedLimitItem.unit}/${totalLimitItem.value ?? "--"}${totalLimitItem.unit}`;
});

const surplusLimit = computed(() => {
  let surplusLimitItem = convertEnergyUnit(tenantQuotaInfo.value.surplusLimit);
  return `${surplusLimitItem.value ?? "--"}${surplusLimitItem.unit}`;
});

onMounted(async () => {
  // let res = await getTenantQuotaApi();
  // if (res.code === 200) {
  //   let result = res.result || {};
  //   tenantQuotaInfo.value = result;
  // }
});
</script>

<style lang="scss" scoped>
.account-center {
  font-size: 14px;
  line-height: 22px;
  .title {
    margin-top: var(--gap-8);
    font-weight: 600;
    color: var(--text-color-1);
    &:first-child {
      margin-top: 0;
    }
  }
  .tips {
    font-size: 12px;
    color: var(--text-color-3);
  }
  .info {
    padding: var(--gap-8);
    padding-bottom: 0;
    margin-top: var(--gap-5);
    font-weight: 400;
    border: 1px solid var(--border-color-2);
    border-radius: var(--corner-radius-4);
    .el-row {
      margin-bottom: var(--gap-5);
      &:last-child {
        margin-bottom: 0;
      }
      .el-col {
        margin-bottom: var(--gap-8);
      }
    }
    .item {
      display: flex;
      .label {
        color: var(--text-color-2);
      }
      .value {
        margin-left: var(--gap-8);
        color: var(--text-color-1);
      }
    }
    .bold {
      font-weight: 600;
    }
  }
  .alarm-rule-info,
  .time-info {
    padding-bottom: var(--gap-3);
    .el-row {
      .el-col {
        margin-bottom: var(--gap-5);
      }
    }
  }
}
</style>
