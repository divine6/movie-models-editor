<template>
  <base-table-view
    v-bind="{ filterOptions, tableOptions, tableData, total }"
    ref="tableViewRef"
    v-model="params"
    :get-data="payload => fetchProjects(payload)"
    row-key="id"
  >
    <template #btns>
      <el-button type="primary" @click="handleCreateProject">
        {{ $t("OpWeb.Project.Create", "新建项目") }}
      </el-button>
    </template>
    <template #customColumn>
      <base-table-column prop="customColumn" :label="$t('OpWeb.Project.Title', '项目名称')">
        <template #default="{ row }">
          <span class="project-title" @click="handleOpenProject(row)">{{ row.title }}</span>
        </template>
      </base-table-column>
      <base-table-column prop="videoInfo" :label="$t('OpWeb.Project.VideoInfo', '视频信息')">
        <template #default="{ row }">
          <span v-if="row.videoSrc">{{ row.videoWidth }}x{{ row.videoHeight }} · {{ formatDuration(row.videoDuration) }}</span>
          <span v-else class="no-video">未导入视频</span>
        </template>
      </base-table-column>
    </template>
  </base-table-view>

  <!-- 新建项目对话框 -->
  <el-dialog v-model="createDialogVisible" title="新建项目" width="400px">
    <el-form label-position="top">
      <el-form-item label="项目名称">
        <el-input v-model="newProjectTitle" placeholder="请输入项目名称" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirmCreate">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="project-list">
import type { BaseFiltersOptions, BaseTableOptions, BaseTableViewParams } from "base-components";
import { ElMessageBox } from "element-plus";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useTranslate } from "@/hooks/useTranslate";
import { useProjectStore } from "@/stores/modules/project";

const router = useRouter();
const $t = useTranslate();
const projectStore = useProjectStore();

const createDialogVisible = ref(false);
const newProjectTitle = ref("");

const params = ref<BaseTableViewParams>({
  pageNo: 1,
  pageSize: 20,
  search: [],
  sort: [],
  conditions: [],
  extra: {}
});

const tableData = ref<any[]>([]);
const total = ref(0);

// 模拟数据（本地存储）
const fetchProjects = async (payload: BaseTableViewParams) => {
  tableData.value = projectStore.projects;
  total.value = projectStore.projects.length;
};

const filterOptions = computed<BaseFiltersOptions>(() => ({
  propKey: "title",
  items: [
    {
      type: "input",
      label: $t("OpWeb.Project.Title", "项目名称"),
      prop: "title",
      placeholder: $t("OpWeb.Project.TitlePlaceholder", "请输入项目名称")
    }
  ]
}));

const tableOptions: BaseTableOptions<any> = {
  columns: [
    {
      type: "slot",
      prop: "title",
      label: $t("OpWeb.Project.Title", "项目名称"),
      width: 200
    },
    {
      type: "slot",
      prop: "videoInfo",
      label: $t("OpWeb.Project.VideoInfo", "视频信息"),
      width: 180
    },
    {
      label: $t("OpWeb.Common.CreateTime", "创建时间"),
      prop: "createdAt",
      width: 160
    },
    {
      type: "action",
      label: $t("OpWeb.Common.Operation", "操作"),
      prop: "action",
      fixed: "right",
      width: 180,
      btns: [
        {
          key: "open",
          label: $t("OpWeb.Project.Open", "打开"),
          icon: "icon-edit-light",
          handler: row => handleOpenProject(row)
        },
        {
          key: "delete",
          label: $t("OpWeb.Common.Delete", "删除"),
          icon: "icon-delete-light",
          color: "danger",
          handler: row => handleDeleteProject(row)
        }
      ]
    }
  ]
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const handleCreateProject = () => {
  newProjectTitle.value = "";
  createDialogVisible.value = true;
};

const handleConfirmCreate = () => {
  const project = projectStore.createProject(newProjectTitle.value);
  createDialogVisible.value = false;
  router.push(`/project/editor?id=${project.id}`);
};

const handleOpenProject = (row: any) => {
  projectStore.setCurrentProject(row);
  router.push(`/project/editor?id=${row.id}`);
};

const handleDeleteProject = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认删除项目 "${row.title}"？`, "删除确认", { type: "warning" });
    projectStore.deleteProject(row.id);
    fetchProjects(params.value);
  } catch {
    // 取消删除
  }
};
</script>

<style lang="scss" scoped>
.project-title {
  cursor: pointer;
  color: var(--accent);

  &:hover {
    text-decoration: underline;
  }
}

.no-video {
  color: var(--text-color-3);
  font-style: italic;
}
</style>
