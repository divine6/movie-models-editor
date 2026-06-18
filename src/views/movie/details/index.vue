<template>
  <base-details :title="detailInfo.name || $t('OpWeb.Movie.Details', '电影详情')" :key="detailKey">
    <template #btns>
      <el-space>
        <el-button type="primary" icon="Edit" @click="handleEdit">{{ $t("OpWeb.Common.Edit", "编辑") }}</el-button>
        <el-button @click="handleBack">{{ $t("OpWeb.Common.Cancel", "返回") }}</el-button>
      </el-space>
    </template>

    <div class="movie-details">
      <el-descriptions :title="$t('OpWeb.Movie.Details', '基本信息')" :column="2" border>
        <el-descriptions-item :label="$t('OpWeb.Movie.MovieName', '电影名称')">
          {{ detailInfo.name }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('OpWeb.Movie.MovieType', '电影类型')">
          {{ detailInfo.type }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('OpWeb.Movie.Director', '导演')">
          {{ detailInfo.director }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('OpWeb.Movie.ReleaseYear', '上映年份')">
          {{ detailInfo.releaseYear }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('OpWeb.Movie.Rating', '评分')">
          {{ detailInfo.rating }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('OpWeb.Movie.Status', '状态')">
          {{ detailInfo.status === 1 ? "已上映" : "未上映" }}
        </el-descriptions-item>
        <el-descriptions-item :label="$t('OpWeb.Common.remark', '备注')" :span="2">
          {{ detailInfo.remark || "-" }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 编辑抽屉 -->
    <base-drawer-form
      v-model:visible="drawerVisible"
      v-model="formData"
      :options="formOptions"
      :confirm-text="$t('OpWeb.Common.Save', '保存')"
      @confirm="handleSubmit"
      @cancel="handleCancel"
    >
      <template #header>
        <span>{{ $t("OpWeb.Movie.EditMovie", "编辑电影") }}</span>
      </template>
    </base-drawer-form>
  </base-details>
</template>

<script setup lang="ts" name="movie-details">
import { BaseFormOptionsProps, ValidatorRequired } from "base-components";
import { ElMessage } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { MovieServiceApi } from "@/api";
import { useTranslate } from "@/hooks/useTranslate";

const $t = useTranslate();

const route = useRoute();
const router = useRouter();

const detailKey = ref(0);
const detailInfo = ref<Record<string, any>>({});
const drawerVisible = ref(false);

const formData = reactive<Record<string, any>>({});

const formOptions = computed<Array<BaseFormOptionsProps>>(() => [
  {
    colProps: { span: 24 },
    items: [
      {
        type: "input",
        prop: "name",
        label: $t("OpWeb.Movie.MovieName", "电影名称"),
        placeholder: $t("OpWeb.Movie.MovieNamePlaceholder", "请输入电影名称"),
        rules: [new ValidatorRequired($t("OpWeb.Movie.MovieNamePlaceholder", "请输入电影名称"))]
      },
      {
        type: "select",
        prop: "type",
        label: $t("OpWeb.Movie.MovieType", "电影类型"),
        placeholder: $t("OpWeb.Common.PleaseSelect", "请选择"),
        options: [
          { label: "动作", value: "action" },
          { label: "喜剧", value: "comedy" },
          { label: "剧情", value: "drama" },
          { label: "科幻", value: "scifi" },
          { label: "恐怖", value: "horror" }
        ]
      },
      {
        type: "input",
        prop: "director",
        label: $t("OpWeb.Movie.Director", "导演"),
        placeholder: $t("OpWeb.Movie.DirectorPlaceholder", "请输入导演名称")
      },
      {
        type: "input",
        prop: "releaseYear",
        label: $t("OpWeb.Movie.ReleaseYear", "上映年份")
      },
      {
        type: "textarea",
        prop: "remark",
        label: $t("OpWeb.Common.remark", "备注"),
        formItemProps: { showWordLimit: true, maxlength: 500 }
      }
    ]
  }
]);

const fetchDetail = async () => {
  const id = route.query.id as string;
  if (!id) return;
  try {
    const res = await MovieServiceApi.findMovieInfo(id);
    detailInfo.value = res.data || res.result || {};
  } catch (err: any) {
    ElMessage.error(err?.message || "获取电影详情失败");
  }
};

const handleEdit = () => {
  Object.assign(formData, detailInfo.value);
  drawerVisible.value = true;
};

const handleSubmit = async () => {
  await MovieServiceApi.editMovie(formData);
  ElMessage.success("编辑成功");
  drawerVisible.value = false;
  detailInfo.value = { ...detailInfo.value, ...formData };
  detailKey.value++;
};

const handleCancel = () => {
  drawerVisible.value = false;
};

const handleBack = () => {
  router.back();
};

onMounted(() => {
  fetchDetail();
});
</script>

<style lang="scss" scoped>
.movie-details {
  padding: $spacing-md 0;
}
</style>
