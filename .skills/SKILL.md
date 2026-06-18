# HEMS 1.0 项目开发规范 (SKILL)

> **项目**: ultimatebox-light-op-ui
> **类型**: 前端  
> **技术栈**: Vue 3 + TypeScript + Vite + Element Plus + Pinia  
> **团队**: Highlands 开发团队

## 🎯 AI 助手角色定位

你是 HEMS 1.0 运营管理前端的专属开发助手，必须严格遵守以下规范：

- 使用项目指定的技术栈（Vue 3、TypeScript、Element Plus、Pinia、base-components）
- 遵循团队命名规范和目录结构，代码放在对应模块下
- 使用团队封装的 API（`@/api/http`）、工具类（`@/utils`）、字典（`useDictionaryStore`），不引入未经批准的外部库
- 理解租户端/业主端双模式与路由、API 前缀的对应关系
- 列表/表单优先使用 base-components 的 BaseTableView、BaseForm 等，表格分页参数使用 `BaseTableViewParams`

## 📋 项目概述

储能运营管理 SASS 平台前端，支持租户端(tenant)与业主端(owner)双模式，提供场站监测、报表、运维、系统管理、IoT 设备与资产管理等功能，采用 Vue 3 + TypeScript + Element Plus + 团队 base-components 组件库。

## 🛠️ 技术栈

| 类别     | 技术                    | 版本/说明  |
| -------- | ----------------------- | ---------- |
| 语言     | TypeScript              | ^5.5.4     |
| 框架     | Vue                     | ^3.5.17    |
| UI 库    | Element Plus            | ^2.10.4    |
| 组件库   | base-components（团队） | ^1.3.xxx   |
| 状态管理 | Pinia                   | ^2.1.7     |
| 路由     | Vue Router              | ^4.4.0     |
| 构建工具 | Vite                    | ^5.3.2     |
| 包管理   | pnpm                    | 见 engines |
| 样式     | SCSS                    | ^1.77.6    |
| 国际化   | vue-i18n                | ^9.13.1    |
| 日期     | dayjs                   | ^1.11.11   |
| HTTP     | axios                   | ^1.7.2     |

**运行环境**: Node >= 20.0.0

## 📁 项目结构（必须遵守）

### 目录结构

```
ultimatebox-light-op-ui/
├── src/
│   ├── api/                    # 接口与 HTTP 封装
│   │   ├── config/             # 服务端口/前缀（PORT1 等）
│   │   ├── helper/              # 请求取消、状态码处理等
│   │   ├── http/               # axios 实例（request 封装）
│   │   ├── interface/          # 请求/响应类型
│   │   └── modules/            # 按业务模块拆分的 API（如 station-mon、sys-mgt）
│   ├── assets/                 # 静态资源（图片、字体等）
│   ├── components/             # 公共组件
│   │   ├── business/           # 业务通用组件
│   │   └── common/             # 基础通用组件
│   ├── config/                 # 应用配置（路由白名单、登录 URL 等）
│   ├── constants/              # 常量（storage-key、permission、dictionary）
│   ├── directives/             # 自定义指令
│   ├── enums/                  # 枚举（http、日期等）
│   ├── hooks/                  # 组合式函数
│   ├── interface/              # 业务/页面用 TypeScript 类型
│   ├── languages/              # 国际化语言包与 $t
│   ├── layouts/                # 布局（layout-vertical 等）
│   ├── routers/                # 路由（静态路由、tenantRouter、ownerRouter）
│   ├── stores/                 # Pinia 状态（user、auth、dictionary、global 等）
│   ├── styles/                 # 全局样式（variables、common、element-ui 覆盖）
│   ├── utils/                  # 工具函数（date、file、unit-convert、dictionary 等）
│   ├── views/                  # 页面视图（按业务模块分：station-mon、report、sys-mgt 等）
│   ├── App.vue
│   └── main.ts
├── script/                     # 构建/部署/国际化脚本
├── .env*                       # 环境变量（tenant/owner、development/test/production）
├── vite.config.ts
└── package.json
```

### 命名规范（强制）

| 类型           | 命名规范   | 示例                            | 说明                                |
| -------------- | ---------- | ------------------------------- | ----------------------------------- |
| 页面/视图目录  | kebab-case | `ess-list`, `form-view`         | 多词用连字符                        |
| Vue 单文件     | kebab-case | `ess-list.vue`                  | 与目录一致                          |
| 组件名（模板） | PascalCase | `BaseTableView`                 | base-components 与自定义组件        |
| API 模块/方法  | camelCase  | `StationMonitorServiceApi.page` | 服务对象 PascalCase，方法 camelCase |
| 函数/变量      | camelCase  | `getTimeRangeByType`            | 常规 TS/JS                          |
| 常量/枚举键    | UPPER_CASE | `ResultEnum.SUCCESS`            | 枚举值                              |
| 路由 name      | kebab-case | `ess-list-details`              | 与 path 对应                        |
| 样式类名       | kebab-case | `.ess-list-table`               | scoped 内保持                       |

**目录约定**: `views` 下按业务模块分（如 `station-mon`、`sys-mgt`），列表页多为 `list/index.vue`，详情/表单为 `details/`、`form-view/`；API 与 `api/modules` 下模块名对应。

## 📝 核心开发模式（必须遵守）

### 1. 接口与请求

#### API 定义与调用

```typescript
// ✅ 正确：在 api/modules 下定义，使用 http 与 PORT1
// src/api/modules/station-mon/index.ts
import { BaseTableViewParams } from "base-components";
import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Result } from "@/interface/index";

export const StationMonitorServiceApi = {
  page: (params: BaseTableViewParams) => http.post<Result>(PORT1 + `/v1/stationMonitor/findStationPage`, params),
  findStationInfo: (stationId: string) => http.get<Result>(PORT1 + `/v1/stationMonitor/findStationInfo/${stationId}`)
};
```

```typescript
// ✅ 正确：在页面中从 @/api 或 @/api/modules/xxx 引入并调用
import { StationMonitorServiceApi } from "@/api";
// 或
import { OpsReportServiceApi } from "@/api/modules/report";

const res = await StationMonitorServiceApi.page(params);
```

```typescript
// ❌ 错误：直接使用 axios 或自己写 baseURL
import axios from "axios";
axios.get("/v1/xxx");
```

**规范说明**：

- ✅ 所有请求必须通过 `@/api/http` 封装的实例（已处理 token、tenantId、timezone、错误与 401 跳转）
- ✅ 接口路径使用 `PORT1 + '/v1/...'`，PORT1 由 `getApiPrefix()` 按应用类型(tenant/owner)提供
- ✅ 分页请求参数使用 base-components 的 `BaseTableViewParams`
- ❌ 禁止在视图层直接引用 axios 或写死接口 host

### 2. 列表页与 base-components

#### 表格列表

```vue
<!-- ✅ 正确：使用 base-table-view，getData 传入 API 方法，params 使用 BaseTableViewParams -->
<template>
  <base-table-view
    v-bind="{ filterOptions, tableOptions, tableData, total }"
    ref="tableViewRef"
    v-model="params"
    :get-data="payload => StationMonitorServiceApi.page(payload)"
    row-key="id"
  >
    <template #btns>
      <el-button @click="refresh">{{ $t("OpWeb.Common.Refresh", "刷新") }}</el-button>
    </template>
    <template #name>
      <base-table-column prop="name" :label="$t('OpWeb.xxx', '名称')" />
    </template>
  </base-table-view>
</template>
<script lang="ts" setup>
import { BaseTableViewParams, type BaseTableOptions, type BaseFiltersOptions } from "base-components";
import { StationMonitorServiceApi } from "@/api";

const params = ref<BaseTableViewParams>({ pageNo: 1, pageSize: 20 });
const tableOptions = computed<BaseTableOptions>(() => ({ columns: [...] }));
const filterOptions = computed<BaseFiltersOptions>(() => ({ items: [...] }));
</script>
```

**规范说明**：

- ✅ 列表页优先使用 `base-table-view`、`base-table-column`，分页与筛选与 `params`、`filterOptions`、`tableOptions` 配合
- ✅ 表格数据来源统一为 `:get-data="payload => XxxServiceApi.page(payload)"` 形式
- ✅ 文案使用 `$t('OpWeb.xxx', '默认中文')`，保证 key 与默认值同时存在
- ❌ 禁止在未批准情况下用裸 `el-table` + 手写分页替代 base-components 表格

---

## base-components 组件使用规范

以下为团队 base-components 在**表格页、表单页、弹框、抽屉、详情页及增删改查**中的标准用法，其他项目可按此规范直接套用。

### 类型与引入

常用类型与工具从 `base-components` 引入：

```typescript
// 表格列表
import type {
  BaseTableViewParams,
  BaseTableOptions,
  BaseTableColumnProps,
  BaseFiltersOptions,
  BaseFilterItemProps,
  BaseTableViewInstance,
  BaseDrawerFormOptions
} from "base-components";
import type { BaseFormOptionsProps, BaseFormItemProps } from "base-components";
import { filtersHelper, DictionaryItem, ValidatorRequired } from "base-components";
```

**分页参数**：列表统一使用 `BaseTableViewParams`，字段为 `pageNo`、`pageSize`、`search`、`sort`、`conditions`、`extra`（与后端约定一致时使用）。

---

### 一、标准表格列表页（base-table-view）

用于带筛选、分页、可选行的列表页，数据通过 `get-data` 拉取。

#### 1. 模板结构

```vue
<template>
  <base-table-view
    v-bind="{ filterOptions, tableOptions, tableData, total }"
    ref="tableViewRef"
    v-model="params"
    v-model:selected="selected"
    :get-data="payload => XxxServiceApi.page(payload)"
    row-key="id"
    :selectable="row => true"
    :row-selection="{ type: 'checkbox' }"
    @filters-conditions-change="updateConditions"
  >
    <template #btns>
      <el-button type="primary" @click="handleAdd">{{ $t("OpWeb.Common.Add", "新增") }}</el-button>
    </template>
    <template #batch>
      <el-button type="danger" @click="handleBatchDelete">{{ $t("OpWeb.Common.Delete", "删除") }}</el-button>
    </template>
    <template #customColumn>
      <base-table-column prop="customColumn" :label="$t('OpWeb.xxx', '自定义列')">
        <template #default="{ row }">{{ row.xxx }}</template>
      </base-table-column>
    </template>
  </base-table-view>
</template>
```

- **v-model="params"**：必填，`BaseTableViewParams`（含 `pageNo`、`pageSize`、`conditions` 等）。
- **:get-data**：必填，函数 `(payload) => Promise`，通常为 `payload => XxxServiceApi.page(payload)`。
- **v-bind="{ filterOptions, tableOptions, tableData, total }"**：筛选配置、表头配置、数据、总数。
- **#btns**：表格右上角操作按钮（如新增）。
- **#batch**：多选时显示的批量操作区。
- **#列名**：与 `tableOptions.columns` 中 `type: 'slot'` 的 `prop` 对应，用于自定义列，内部用 `<base-table-column>` 或自定义内容。

#### 2. params 与数据

```typescript
const tableViewRef = useTemplateRef<BaseTableViewInstance>("tableViewRef");
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
const selected = ref<any[]>([]);

const refresh = () => tableViewRef.value?.refresh();
```

需要与筛选条件联动时，使用 `useTableFilterConditions` 将 `conditions` 同步到 `params.conditions`（见项目 `TABLE_FILTERS_KEY` 与 hooks）。

#### 3. filterOptions（筛选区）

```typescript
const filterOptions = computed<BaseFiltersOptions>(() => ({
  propKey: "name",
  items: [
    { type: "input", label: $t("OpWeb.xxx", "名称"), prop: "name", placeholder: $t("OpWeb.xxx", "请输入名称") },
    {
      type: "select",
      label: $t("OpWeb.xxx", "状态"),
      prop: "status",
      options: accessor.options("enable_disable_bool"),
      placeholder: $t("OpWeb.Common.PleaseSelect", "请选择")
    },
    {
      type: "date",
      prop: "createTime",
      label: $t("OpWeb.xxx", "创建时间"),
      filterItemProps: {
        type: "daterange",
        valueFormat: "YYYY-MM-DD",
        startPlaceholder: $t("OpWeb.Common.PleaseSelectStartTime", "请选择开始时间"),
        endPlaceholder: $t("OpWeb.Common.PleaseSelectEndTime", "请选择结束时间")
      }
    }
  ]
}));
```

可用 **filtersHelper** 简化项配置：`filtersHelper.input(label, prop, placeholder)`、`filtersHelper.select(label, prop, options)`、`filtersHelper.checkboxGroup(label, prop, options)`、`filtersHelper.date(label, prop, placeholder, isRange, filterItemProps)`。选项来自字典时用 `accessor.options("字典类型")` 或 `DictionaryItem(label, value)`。

#### 4. tableOptions（表头与列）

```typescript
const tableOptions = computed<BaseTableOptions<any>>(() => ({
  columns: [
    { label: $t("OpWeb.xxx", "名称"), prop: "name", width: 200 },
    {
      type: "names",
      label: $t("OpWeb.xxx", "名称"),
      prop: ["name", "subName"],
      width: 200,
      onClick: row => router.push({ path: "/xxx/details", query: { id: row.id } })
    },
    {
      type: "status",
      label: $t("OpWeb.xxx", "状态"),
      prop: "status",
      width: 120,
      dictionary: accessor.options("enable_disable_bool")
    },
    { label: $t("OpWeb.xxx", "功率"), prop: "power", width: 120, tableItemProps: { unit: "kW" } },
    { type: "desc", label: $t("OpWeb.Common.remark", "备注"), prop: "remark", minWidth: 180 },
    {
      type: "slot",
      label: $t("OpWeb.xxx", "自定义列"),
      prop: "customColumn"
    },
    {
      type: "action",
      label: $t("OpWeb.Common.Operation", "操作"),
      prop: "action",
      fixed: "right",
      btns: [
        {
          key: "edit",
          label: $t("OpWeb.Common.Edit", "编辑"),
          icon: "icon-edit-light",
          visible: () => userStore.havePermission("xxx_edit_btn"),
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
```

- **type**：不写或普通列、`names`（多字段+点击）、`status`（字典状态）、`desc`（长文本）、`slot`（自定义插槽，插槽名为 `prop`）、`action`（操作按钮）。
- **dictionary**：`type: 'status'` 时用 `accessor.options("字典类型")`。
- **action.btns**：`label`、`icon`、`visible`、`disabled`、`handler(row)`。

---

### 二、简单表格（base-table）与弹框内表格

弹框/抽屉内仅展示表格、无筛选条时，用 **base-table**，自行传 `columns`、`data`，需要分页时在下方加 `el-pagination`。

```vue
<base-dialog v-model="visible" show-close width="65%">
  <template #header>{{ $t("OpWeb.xxx", "标题") }}</template>
  <template #footer></template>
  <base-table
    ref="tableRef"
    v-loading="loading"
    :height="400"
    :columns="columns"
    :data="data"
    :row-selection="{ type: 'none' }"
  >
    <template #empty><base-empty size="small" /></template>
  </base-table>
  <div class="pagination">
    <el-pagination
      :current-page="params.pageNo"
      :page-size="params.pageSize"
      :total="total"
      layout="prev, pager, next, sizes"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />
  </div>
</base-dialog>
```

```typescript
import { BaseTableColumnProps } from "base-components";
const columns = computed<BaseTableColumnProps<any>[]>(() => [
  { label: "列1", prop: "field1", width: 100 },
  { label: "列2", prop: "field2", width: 120 },
  {
    type: "action",
    label: $t("OpWeb.Common.Operation", "操作"),
    prop: "action",
    fixed: "right",
    btns: [{ key: "view", label: "查看", handler: row => {} }]
  }
]);
```

---

### 三、表单页：base-form 与 base-drawer-form

#### 1. 独立表单（base-form）

用于抽屉/页面内纯表单区域，不包含抽屉壳子。

```vue
<base-form
  ref="baseFormRef"
  v-model="formData"
  :options="formOptions"
  layout="vertical"
  label-position="top"
  require-asterisk-position="left"
/>
```

```typescript
import type { BaseFormOptionsProps } from "base-components";
import { ValidatorRequired } from "base-components";

const formData = ref<Record<string, any>>({});
const formOptions = computed<Array<BaseFormOptionsProps>>(() => [
  {
    colProps: { span: 24 },
    items: [
      {
        type: "input",
        prop: "name",
        label: $t("OpWeb.xxx", "名称"),
        placeholder: $t("OpWeb.xxx", "请输入名称"),
        rules: [new ValidatorRequired($t("OpWeb.xxx", "请输入名称"))]
      },
      {
        type: "select",
        prop: "status",
        label: $t("OpWeb.xxx", "状态"),
        placeholder: $t("OpWeb.Common.PleaseSelect", "请选择"),
        options: accessor.options("enable_disable_bool")
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
```

表单项类型：`input`、`select`、`radioGroup`、`textarea`、`date` 等。校验可用 `rules: [new ValidatorRequired(消息)]` 或 Element Plus 的 `{ required: true, message, trigger }`。需要自定义标签或内容时，在 `formItemProps.labelSlot` 或表单项的 slot 名（如 `#modelItem`）中写插槽。

#### 2. 抽屉表单（base-drawer-form）

带抽屉壳子的表单，常用于新增/编辑，底部自带确定/取消。

```vue
<base-drawer-form
  v-model:visible="visible"
  v-model="formData"
  :options="formOptions"
  :disabled="type === 'view'"
  :confirm-text="$t('OpWeb.Common.Save', '保存')"
  @confirm="handleSubmit"
  @cancel="handleCancel"
>
  <template #header>
    <span>{{ type === 'add' ? $t('OpWeb.Common.Add', '新增') : $t('OpWeb.Common.Edit', '编辑') }}xxx</span>
  </template>
  <template #loginNameSlot>
    <span>自定义标签或说明</span>
  </template>
</base-drawer-form>
```

- **v-model:visible**：控制显隐。
- **v-model**：表单数据。
- **:options**：同 base-form 的 `BaseFormOptionsProps`。
- **:disabled**：整表只读（如详情/查看）。

---

### 四、抽屉（base-drawer）与弹框（base-dialog）

#### 1. base-drawer（自定义内容抽屉）

内容完全自定义，例如“表单 + 下方表格/配置块”。

```vue
<base-drawer
  :title="$t('OpWeb.Common.Edit', '编辑') + 'xxx'"
  :size="\`calc(100% - 280px)\`"
  v-model="visible"
  @confirm="handleSubmit"
  @closed="handleClosed"
>
  <base-form ref="baseFormRef" v-model="formData" :options="formOptions" />
  <div class="title">其他配置</div>
  <notif-group-config v-model="list" />
</base-drawer>
```

#### 2. base-dialog（弹框）

用于提示、简单表格、自定义内容。

```vue
<base-dialog v-model="visible" show-close :title="$t('OpWeb.xxx', '标题')" width="960px" draggable>
  <div class="content">自定义内容</div>
  <template #footer>
    <el-button @click="visible = false">{{ $t("OpWeb.Common.cancel", "取消") }}</el-button>
    <el-button type="primary" @click="handleConfirm">{{ $t("OpWeb.Common.confirm", "确定") }}</el-button>
  </template>
</base-dialog>
```

- **#header**、**#footer**：可选，覆盖标题和底部按钮。

---

### 五、详情页（base-details）

用于详情页整体布局：标题 + 右侧按钮 + 若干信息块。

```vue
<base-details :title="detailInfo.name" :key="key">
  <template #btns>
    <el-space>
      <el-button type="primary" icon="Edit" @click="handleEdit">{{ $t("OpWeb.Common.Edit", "编辑") }}</el-button>
    </el-space>
  </template>
  <info :info="detailInfo" />
  <div class="title">{{ $t("OpWeb.xxx", "子模块标题") }}</div>
  <station-tab :id="id" />
</base-details>
```

---

### 六、增删改查页面组合示例

- **列表页**：`base-table-view` + `params` + `filterOptions` + `tableOptions` + `:get-data="payload => XxxServiceApi.page(payload)"`，操作列中“新增”打开表单抽屉，“编辑/删除”调用接口后 `tableViewRef.value?.refresh()`。
- **新增/编辑**：使用 `base-drawer-form` 或 `base-drawer` + `base-form`，`v-model:visible` 与列表页的 `showFormDrawer` 绑定，提交成功后 `emit('refresh')`，列表页在 `@refresh` 里执行 `refresh()`。
- **详情页**：路由进入详情后使用 `base-details`，内部放基础信息组件与各业务 Tab/块；编辑可再打开同一套 `base-drawer-form`。
- **弹框**：列表或详情中的“查看日志”“选择设备”等用 `base-dialog`，内容为 `base-table` + 分页或自定义表单，关闭时仅关弹框即可。

---

### 七、辅助组件与工具

| 能力                  | 用法                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **base-icon**         | `<base-icon name="icon-edit-light" size="18" color="var(--text-color-1)" />`                                                                                                                                                   |
| **base-empty**        | `<base-empty size="small" />` 表格无数据时插槽                                                                                                                                                                                 |
| **filtersHelper**     | `filtersHelper.input(label, prop, placeholder)`、`filtersHelper.select(label, prop, options)`、`filtersHelper.checkboxGroup(label, prop, options)`、`filtersHelper.date(label, prop, placeholder, isRange?, filterItemProps?)` |
| **DictionaryItem**    | 筛选项/表单项选项：`new DictionaryItem(label, value)` 或 `accessor.options("字典类型")`                                                                                                                                        |
| **ValidatorRequired** | 表单必填：`rules: [new ValidatorRequired($t('OpWeb.xxx', '请输入xxx'))]`                                                                                                                                                       |

字典选项统一通过 `useDictionaryStore()` 的 `accessor.options(type)` / `accessor.item(type, value)` 获取，不手写字典请求。

---

### 3. 状态与字典

#### Pinia Store 与字典

```typescript
// ✅ 正确：用户与权限
import { useUserStore } from "@/stores/modules/user";
const userStore = useUserStore();
userStore.token;
userStore.havePermission(to.meta.roles);

// ✅ 正确：字典（下拉、状态文案与颜色等）
import { useDictionaryStore } from "@/stores/modules/dictionary";
const { accessor } = useDictionaryStore();
accessor.item("deviceStatus", value); // 获取字典项
```

```vue
<!-- ✅ 正确：模板中使用 $t -->
<el-button>{{ $t("OpWeb.Common.Submit", "提交") }}</el-button>
```

**规范说明**：

- ✅ 用户、权限、字典、全局状态均从 `@/stores/modules` 对应 store 获取
- ✅ 文案统一用全局 `$t(key, defaultValue, values)`，不硬编码中文到界面
- ❌ 禁止在业务代码中直接请求字典接口或自己维护一份字典状态（除特殊场景且与团队约定）

### 4. 路由与权限

#### 路由配置

```typescript
// ✅ 正确：在 routers/modules 下配置，meta.roles 与 PermissionCode 对应
{
  path: "/stationMon/ess-list",
  name: "ess-list",
  meta: {
    title: "储能站列表",
    roles: "essList_menu",
    localeKey: "OpWeb.StationMon.ESSList"
  },
  component: () => import("@/views/station-mon/ess-list/list/index.vue")
}
```

**规范说明**：

- ✅ 动态路由按 tenant / owner 使用 `tenantRouter` / `ownerRouter`，在 `routers/index.ts` 中根据 `APP_TYPE` 选择
- ✅ 权限码与后端一致，使用 `meta.roles` 与 `PermissionCode` 配合
- ❌ 禁止在路由外写死菜单或权限判断逻辑与常量不一致

### 5. 样式

#### SCSS 与变量

```scss
// ✅ 正确：使用项目样式入口与变量
<style lang="scss" scoped>
@use "@/styles/variables" as *;

.ess-list {
  .ess-list-table {
    margin-top: 10px;
    color: var(--text-color-1);
  }
}
</style>
```

**规范说明**：

- ✅ 页面样式使用 `lang="scss"` 且加 `scoped`，需要时 `@use "@/styles/variables" as *`
- ✅ 颜色、间距等优先使用 `styles/variables` 与 `styles/common` 中已有变量
- ❌ 禁止随意引入未在项目中约定的 UI 库或全局样式

### 6. 工具函数（必须使用项目封装）

#### 日期与时间范围

```typescript
// ✅ 正确：时间范围使用 utils/date
import { getTimeRangeByType } from "@/utils/date";
import { DateTimeType } from "@/enums/dateEnum";

const { startTime, endTime } = getTimeRangeByType(DateTimeType.LAST_7_DAYS);
const monthRange = getTimeRangeByType(DateTimeType.MONTH, "2025-01");
```

```typescript
// ✅ 正确：秒数转可读时长
import { formatSecond } from "@/utils/date/format";
formatSecond(3661); // "1小时0分1秒"
```

#### 单位换算与文件下载

```typescript
// ✅ 正确：电量/功率等单位换算
import { convertEnergyUnit, convertPowerUnit } from "@/utils/unit-convert";
const energy = convertEnergyUnit(12345); // 自动转成合适单位
const power = convertPowerUnit(0.5); // kW/MW/GW
```

```typescript
// ✅ 正确：导出文件流下载
import http from "@/api/http";
import { downloadBlobFile } from "@/utils/file";

const res = await http.download(url, params);
downloadBlobFile(res, "导出.xlsx");
```

**规范说明**：

- ✅ 日期时间用 `@/utils/date`、`@/utils/date/format`（基于 dayjs）
- ✅ 单位换算用 `@/utils/unit-convert`
- ✅ 文件下载用 `http.download` + `downloadBlobFile`
- ❌ 禁止引入 moment、lodash 等未在 package.json 中批准的库替代现有工具

## 🧰 团队工具类/函数（禁止使用外部库）

### 必须使用的封装

| 能力       | 使用方式                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| HTTP 请求  | `import http from "@/api/http"` → `http.get/post/put/delete/download`             |
| 接口模块   | `import { XxxServiceApi } from "@/api"` 或 `@/api/modules/xxx`                    |
| 时间范围   | `import { getTimeRangeByType } from "@/utils/date"` + `DateTimeType`              |
| 时长格式化 | `import { formatSecond } from "@/utils/date/format"`                              |
| 单位换算   | `import { convertEnergyUnit, convertPowerUnit } from "@/utils/unit-convert"`      |
| 文件下载   | `import { downloadBlobFile } from "@/utils/file"`，参数为 axios blob 响应         |
| 国际化     | 全局 `$t(key, defaultValue, values)` 或 `import { translate } from "@/languages"` |
| 字典       | `useDictionaryStore().accessor.item(type, value)`                                 |

### 工具使用原则

- ❌ **禁止** 使用 lodash、moment（日期用 dayjs，工具用项目 utils）
- ✅ **必须** 使用 `@/api/http` 与 `api/modules` 下的接口封装
- ✅ **必须** 列表/表单使用 base-components 约定用法（BaseTableViewParams、BaseTableOptions 等）
- 💡 **建议** 新工具函数放在对应 `utils` 子目录并统一从 `@/utils` 或具体路径引用

## ⚙️ 配置管理

### 环境变量

```bash
# .env 基础
VITE_GLOB_APP_TITLE = UltimateBoxSass3.0
VITE_PORT = 5173

# 租户端开发 .env.development.tenant
VITE_APP_TYPE = tenant
VITE_API_URL = "https://api.highlands.ltd/light-sass-api/"
VITE_ROUTER_MODE = hash
VITE_PUBLIC_PATH = /static/ultimatebox3.0-tenant
```

- `VITE_APP_TYPE`: tenant | owner，决定路由与 API 前缀
- `VITE_API_URL`: 接口 baseURL
- `VITE_ROUTER_MODE`: hash | history
- 构建模式：development.tenant / test.tenant / production.tenant（及 owner 对应）

## 🚀 构建和部署

### 常用命令

```bash
# 开发（租户端）
pnpm dev
# 或
pnpm dev:tenant
pnpm dev:owner

# 类型检查
pnpm type:check

# 构建（租户端 dev/test/prod）
pnpm build:dev
pnpm build:test
pnpm build:prod

# 部署
pnpm deploy:tenant
pnpm deploy:owner

# 代码规范
pnpm lint:eslint
pnpm lint:prettier
pnpm lint:stylelint
```

## 📌 快速参考

### 关键检查清单

- [ ] 新接口写在 `api/modules` 对应模块，使用 `http` + `PORT1`
- [ ] 列表页使用 base-components 的 `base-table-view`、`BaseTableViewParams`（`pageNo`/`pageSize`/`conditions`），数据源 `:get-data="payload => XxxServiceApi.page(payload)"`
- [ ] 表单/抽屉用 `base-form` 或 `base-drawer-form`，弹框用 `base-dialog`，详情用 `base-details`（见本文「base-components 组件使用规范」）
- [ ] 文案使用 `$t('OpWeb.xxx', '默认值')`
- [ ] 日期用 `getTimeRangeByType`/dayjs，单位用 `unit-convert`，下载用 `downloadBlobFile`
- [ ] 组件/文件命名符合 kebab-case，类型与枚举符合项目约定
- [ ] 未引入 lodash、moment 等未批准依赖

### 常见错误避免

- ❌ **错误**: 在页面里直接 `axios.get(...)`  
  ✅ **正确**: 在 `api/modules` 定义方法，页面里 `XxxServiceApi.xxx()`

- ❌ **错误**: 表格自己写 el-table + 分页  
  ✅ **正确**: 使用 `base-table-view` + `params`(BaseTableViewParams) + `:get-data="payload => XxxServiceApi.page(payload)"`，见「base-components 组件使用规范」一、二节

- ❌ **错误**: 界面文案写死中文  
  ✅ **正确**: 使用 `$t("OpWeb.xxx", "默认中文")`

- ❌ **错误**: 日期用 moment 或手写格式化  
  ✅ **正确**: 使用 `@/utils/date`、`getTimeRangeByType`、`formatSecond` 与 dayjs

### 重要提示

- 开发前确认当前运行的是 tenant 还是 owner（`VITE_APP_TYPE`），路由与 API 前缀会随之变化。
- 新增菜单/权限时，需在 `routers/modules` 对应 router 中加路由，并在 `PermissionCode` 中加码值。
- 新业务模块建议在 `views` 与 `api/modules` 下保持同一模块名（如 station-mon），便于维护。

---

**维护者**: Highlands 开发团队  
**最后更新**: 2025-02  
**版本**: v1.0  
**项目路径**: `HEMS-IOT-PLATFORM-UI`（仓库根目录即项目根）
