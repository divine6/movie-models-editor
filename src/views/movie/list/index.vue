<template>
  <base-table-view
    v-bind="{ filterOptions, tableOptions }"
    ref="tableViewRef"
    v-model="params"
    v-model:selected="selected"
    :get-data="payload => MovieServiceApi.page(payload)"
    :table-data="tableData"
    :total="total"
    row-key="id"
  >
    <template #btns>
      <el-button type="primary" @click="handleAdd">{{ $t("OpWeb.Movie.AddMovie", "新增电影") }}</el-button>
    </template>
    <template #batch>
      <el-button type="danger" @click="handleBatchDelete">{{ $t("OpWeb.Common.BatchDelete", "批量删除") }}</el-button>
    </template>
    <template #customColumn>
      <base-table-column prop="customColumn" :label="$t('OpWeb.Movie.MovieName', '电影名称')">
        <template #default="{ row }">{{ row.name }}</template>
      </base-table-column>
    </template>
  </base-table-view>

  <!-- 新增/编辑抽屉表单 -->
  <base-drawer-form
    v-model:visible="drawerVisible"
    v-model="formData"
    :options="formOptions"
    :disabled="formType === 'view'"
    :confirm-text="$t('OpWeb.Common.Save', '保存')"
    @confirm="handleSubmit"
    @cancel="handleCancel"
  >
    <template #header>
      <span>{{ formTypeTitle }}</span>
    </template>
  </base-drawer-form>
</template>

<script setup lang="ts" name="movie-list">
import {
  type BaseFiltersOptions,
  type BaseFormOptionsProps,
  type BaseTableOptions,
  type BaseTableViewInstance,
  BaseTableViewParams,
  ValidatorRequired
} from "base-components";
import { filtersHelper } from "base-components";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, reactive, ref, useTemplateRef } from "vue";

import { MovieServiceApi } from "@/api";
import { useTranslate } from "@/hooks/useTranslate";

const $t = useTranslate();

const tableViewRef = useTemplateRef<BaseTableViewInstance>("tableViewRef");

// 分页参数
const params = ref<BaseTableViewParams>({
  pageNo: 1,
  pageSize: 20,
  search: [],
  sort: [],
  conditions: [],
  extra: {}
});

const selected = ref<any[]>([]);
const tableData = ref<any[]>([]);
const total = ref(0);

// 刷新
const refresh = () => tableViewRef.value?.requestData();

// 筛选配置
const filterOptions = computed<BaseFiltersOptions>(() => ({
  propKey: "name",
  items: [
    filtersHelper.input(
      $t("OpWeb.Movie.MovieName", "电影名称"),
      "name",
      $t("OpWeb.Movie.MovieNamePlaceholder", "请输入电影名称")
    ),
    {
      type: "select",
      label: $t("OpWeb.Movie.MovieType", "电影类型"),
      prop: "type",
      options: [
        { label: "动作", value: "action" },
        { label: "喜剧", value: "comedy" },
        { label: "剧情", value: "drama" },
        { label: "科幻", value: "scifi" },
        { label: "恐怖", value: "horror" }
      ],
      placeholder: $t("OpWeb.Common.PleaseSelect", "请选择")
    },
    {
      type: "date",
      prop: "releaseYear",
      label: $t("OpWeb.Movie.ReleaseYear", "上映年份"),
      filterItemProps: {
        type: "year",
        valueFormat: "YYYY",
        placeholder: $t("OpWeb.Common.PleaseSelect", "请选择")
      }
    }
  ]
}));

// 表格配置
const tableOptions = computed<BaseTableOptions<any>>(() => ({
  columns: [
    {
      type: "names",
      label: $t("OpWeb.Movie.MovieName", "电影名称"),
      prop: ["name", "director"],
      width: 250,
      onClick: row => handleView(row)
    },
    {
      label: $t("OpWeb.Movie.MovieType", "电影类型"),
      prop: "type",
      width: 120
    },
    {
      label: $t("OpWeb.Movie.Director", "导演"),
      prop: "director",
      width: 150
    },
    {
      label: $t("OpWeb.Movie.ReleaseYear", "上映年份"),
      prop: "releaseYear",
      width: 120
    },
    {
      label: $t("OpWeb.Movie.Rating", "评分"),
      prop: "rating",
      width: 100
    },
    {
      type: "status",
      label: $t("OpWeb.Movie.Status", "状态"),
      prop: "status",
      width: 120,
      dictionary: [
        { label: "已上映", value: 1 },
        { label: "未上映", value: 0 }
      ]
    },
    {
      type: "desc",
      label: $t("OpWeb.Common.remark", "备注"),
      prop: "remark",
      minWidth: 180
    },
    {
      type: "action",
      label: $t("OpWeb.Common.Operation", "操作"),
      prop: "action",
      fixed: "right",
      width: 200,
      btns: [
        {
          key: "view",
          label: $t("OpWeb.Common.Edit", "查看"),
          icon: "icon-edit-light",
          handler: row => handleView(row)
        },
        {
          key: "edit",
          label: $t("OpWeb.Common.Edit", "编辑"),
          icon: "icon-edit-light",
          handler: row => handleEdit(row)
        },
        {
          key: "delete",
          label: $t("OpWeb.Common.Delete", "删除"),
          icon: "icon-delete-light",
          color: "danger",
          handler: row => handleDelete(row)
        }
      ]
    }
  ]
}));

// 抽屉表单
const drawerVisible = ref(false);
const formType = ref<"add" | "edit" | "view">("add");
const formData = reactive<Record<string, any>>({
  name: "",
  type: "",
  director: "",
  releaseYear: "",
  rating: 0,
  status: 1,
  remark: ""
});

const formTypeTitle = computed(() => {
  if (formType.value === "add") return $t("OpWeb.Movie.AddMovie", "新增电影");
  if (formType.value === "edit") return $t("OpWeb.Movie.EditMovie", "编辑电影");
  return $t("OpWeb.Movie.Details", "电影详情");
});

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
        type: "input",
        prop: "rating",
        label: $t("OpWeb.Movie.Rating", "评分")
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

const handleAdd = () => {
  formType.value = "add";
  Object.assign(formData, {
    name: "",
    type: "",
    director: "",
    releaseYear: "",
    rating: 0,
    status: 1,
    remark: ""
  });
  drawerVisible.value = true;
};

const handleEdit = (row: any) => {
  formType.value = "edit";
  Object.assign(formData, row);
  drawerVisible.value = true;
};

const handleView = (row: any) => {
  formType.value = "view";
  Object.assign(formData, row);
  drawerVisible.value = true;
};

const handleDelete = (row: any) => {
  ElMessageBox.confirm($t("OpWeb.Movie.DeleteConfirm", "确认删除该电影？"), $t("OpWeb.Common.Confirm", "确认"), {
    type: "warning"
  }).then(async () => {
    await MovieServiceApi.deleteMovie(row.id);
    ElMessage.success("删除成功");
    refresh();
  });
};

const handleBatchDelete = () => {
  if (selected.value.length === 0) {
    ElMessage.warning("请先选择数据");
    return;
  }
  ElMessageBox.confirm("确认批量删除选中的电影？", "确认", { type: "warning" }).then(async () => {
    // 批量删除逻辑
    ElMessage.success("批量删除成功");
    selected.value = [];
    refresh();
  });
};

const handleSubmit = async () => {
  if (formType.value === "add") {
    await MovieServiceApi.addMovie(formData);
    ElMessage.success("新增成功");
  } else {
    await MovieServiceApi.editMovie(formData);
    ElMessage.success("编辑成功");
  }
  drawerVisible.value = false;
  refresh();
};

const handleCancel = () => {
  drawerVisible.value = false;
};
</script>

<style lang="scss" scoped>
// 电影列表页样式
</style>
