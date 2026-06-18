# movie-model-editor 全面审计报告

> 审计日期: 2026-06-05
> 对比基准: `d:\Work\saas3.0\base-pages\` (base-pages 框架)
> 审计范围: 全部 src/ 文件、配置文件、组件使用、逻辑合理性

---

## 一、框架对齐度总览

### 1.1 样式系统 ✅ 已对齐

| 模块 | base-pages | movie-model-editor | 状态 |
|------|-----------|-------------------|------|
| `styles/index.scss` 入口 | ✅ | ✅ 完整 | ✅ |
| `styles/variables/` (CSS变量 + ECharts) | ✅ | ✅ 完整 | ✅ |
| `styles/common/` (公共样式) | ✅ | ✅ 完整 | ✅ |
| `styles/utils/` (工具类 + reset) | ✅ | ✅ 完整 | ✅ |
| `styles/element-ui/overwrite.scss` | ✅ | ✅ 完整 | ✅ |
| `styles/theme/` (aside/header/menu) | ✅ | ✅ 完整 | ✅ |
| Element Plus SCSS 变量覆盖 | ✅ | ✅ `element-ui/variables.scss` | ✅ |

### 1.2 布局系统 ✅ 已对齐

| 组件 | base-pages | movie-model-editor | 状态 |
|------|-----------|-------------------|------|
| `layouts/index.vue` (水印 + 动态布局) | ✅ | ✅ 完整 | ✅ |
| `layouts/layout-vertical/index.vue` | ✅ | ✅ 完整 | ✅ |
| `layouts/layout-vertical/breadcrumb.vue` | ✅ | ✅ 完整 | ✅ |
| `layouts/layout-vertical/header-operate.vue` | ✅ | ✅ 完整 | ✅ |
| `layouts/layout-vertical/language.vue` | ✅ | ✅ 完整 | ✅ |
| `layouts/components/Main/index.vue` | ✅ | ✅ 完整 | ✅ |
| `layouts/components/Main/components/Maximize.vue` | ✅ | ✅ 完整 | ✅ |

### 1.3 登录页面 ✅ 已对齐

| 特性 | base-pages | movie-model-editor | 状态 |
|------|-----------|-------------------|------|
| Spline 3D 背景 | ✅ | ✅ | ✅ |
| Logo 图片 | ✅ | ✅ | ✅ |
| 租户ID 字段 | ✅ | ✅ | ✅ |
| 记住密码 | ✅ | ✅ | ✅ |
| AES 密码加密 | ✅ | ✅ | ✅ |
| 版权页脚 | ✅ | ✅ | ✅ |
| 语言切换 | ✅ | ✅ | ✅ |
| 玻璃拟态卡片样式 | ✅ | ✅ | ✅ |

### 1.4 通用组件 ✅ 已对齐

| 组件 | base-pages | movie-model-editor | 状态 |
|------|-----------|-------------------|------|
| `error-message/403.vue` | ✅ | ✅ | ✅ |
| `error-message/404.vue` | ✅ | ✅ | ✅ |
| `error-message/500.vue` | ✅ | ✅ | ✅ |
| `switch-dark/index.vue` | ✅ | ✅ | ✅ |
| `account-center/index.vue` | ✅ | ✅ | ✅ |
| `update-password/index.vue` | ✅ | ✅ | ✅ |
| `update-version/index.vue` | ✅ | ✅ | ✅ |
| `loading/` | ✅ | ✅ | ✅ |
| `e-charts/` | ✅ | ✅ | ✅ |
| `grid/` | ✅ | ✅ | ✅ |
| `wang-editor/` | ✅ | ✅ | ✅ |

---

## 二、base-components 和 base-unit 使用分析

### 2.1 base-components 使用情况 ✅ 正确

movie-model-editor 中使用的 base-components 导入：

| 导入项 | 使用位置 | 类型 |
|--------|---------|------|
| `BaseTableViewParams` | api/movie, api/data-perm-mgt, views/movie/list, views/project/index, interface/common | 类型 |
| `BaseFiltersOptions` | views/movie/list, views/project/index, interface/common | 类型 |
| `BaseTableOptions` | views/movie/list, views/project/index | 类型 |
| `BaseTableViewInstance` | views/movie/list | 类型(ref) |
| `BaseFormOptionsProps` | views/movie/list, views/movie/details, components/update-password | 类型 |
| `BaseMenuOptions` | layouts/layout-vertical | 类型 |
| `BaseTableRowSelection` | interface/common | 类型 |
| `ValidatorRequired` | views/movie/list, views/movie/details | 类(验证) |
| `filtersHelper` | views/movie/list | 工具 |
| `BaseIcon` | layouts/breadcrumb | 组件 |

**结论**: 使用方式与 SKILL.md 和 base-pages 完全一致。所有均为 types、工具类、组件的标准用法。

### 2.2 base-unit 分析

**base-unit** 是一个独立的 Arco Design Vue 演示项目（`d:\Work\saas3.0\base-unit\`），使用 `@arco-design/web-vue` 而非 Element Plus。

- ❌ **它不是 npm 包**（`"private": true`，无 `"main"` 字段）
- ❌ **base-pages 不依赖它**
- ❌ **movie-model-editor 不依赖它**
- ❌ **SKILL.md 未提及它**

**结论**: base-unit 与当前技术栈（Element Plus + base-components）无关，不应在 movie-model-editor 中使用。

---

## 三、全局性问题分析

### 🔴 严重问题

#### Issue #1: `package.json` 中 base-components 版本冲突

**文件**: `package.json`
**问题**:
```json
"dependencies": { "base-components": "^1.3.15" },   // ← 旧版本
"devDependencies": { "base-components": "^1.3.13" }  // ← 重复声明，不同版本
```
base-pages 已升级到 `"1.4.10"`（node_modules 实际安装版本）。

**影响**: pnpm 可能安装两个不同版本的 base-components，导致类型冲突或运行时错误。

**修复建议**: 
- 删除 devDependencies 中的重复声明
- 统一版本到 `"^1.4.10"`

---

#### Issue #2: 首页重定向到 `/project/editor` 但不存在的路由路径错误

**文件**: `src/views/home/index.vue`
**问题**: 首页 `onMounted` 中直接 `router.replace("/project/editor")`，但：
- 如果用户未登录，没有 auth 守卫来拦截
- 如果 `/project/editor` 不存在或加载失败，用户会看到白屏
- base-pages 的 home 页被设计为从菜单进入的首页展示，不应硬重定向

**影响**: 用户体验断崖式跳转，无过渡动画，无错误处理。

**修复建议**:
- 方案 A: 在路由守卫中做重定向判断
- 方案 B: home 页显示项目列表作为着陆页，而非自动跳转

---

#### Issue #3: 路由根路径重定向指向不存在的路由

**文件**: `src/routers/index.ts`
**问题**:
```typescript
// beforeEach 中
if (to.path === "/") {
  return next("/project/editor");  // 硬编码
}
```
而 `staticRouter.ts` 中也有:
```typescript
{ path: "/", name: "root", redirect: HOME_URL }
```
两处重定向可能冲突。`HOME_URL` 从 `config/index.ts` 的 `getHomeUrl()` 获取（返回 `/home`），但路由守卫中硬编码为 `/project/editor`。

**影响**: 重定向不一致。如果环境变量配置不同，路由守卫会和 staticRouter 冲突。

---

#### Issue #4: `$t` 函数在 `<script setup>` 中的使用不一致

**文件**: 多个 .vue 文件

**问题**: 
- 有些文件 import `$t` from `@/hooks/useTranslate`（这是正确的 script 端用法）
- `src/hooks/useTranslate.ts` 的实现是：
  ```typescript
  import { translate } from "@/languages";
  export const $t = (key, defaultValue, values) => translate(key, defaultValue, values);
  ```
- 但 `src/languages/index.ts` 中 `translate` 函数内部使用 `i18n.global.te(key)` 来判断 key 是否存在
- 如果 i18n locale 未正确加载，`te()` 返回 false，`$t` 会 fallback 到 `defaultValue`
- 这本身是正确的行为，但问题是：**语言包 key 命名不统一**

**具体问题**: 在 `views/movie/list/index.vue` 中：
```typescript
$t("OpWeb.Movie.MovieName", "电影名称")   // ← OpWeb 前缀
```
而 `languages/lang/zh-cn.ts` 中的 key 是 `OpWeb.Movie.MovieName` —— 检查是否所有用到的 key 都在语言包中定义了。

---

### 🟡 中等问题

#### Issue #5: 路由守卫缺少登录验证

**文件**: `src/routers/index.ts`
**base-pages 的守卫**:
```typescript
router.beforeEach(async (to, from, next) => {
  NProgress.start();
  const title = import.meta.env.VITE_GLOB_APP_TITLE;
  document.title = to.meta.title ? `${to.meta.title} - ${title}` : title;
  return next();  // ← 没有登录验证
});
```

**问题**: 
- 路由守卫**没有检查用户是否已登录**
- 这意味着未登录用户可以直接访问 `/project/editor`、`/movie/list` 等需要认证的页面
- 虽然 API 层有 401 拦截（跳转到 `/login`），但页面会先渲染出来再跳转，体验很差
- base-pages 同样有这个问题（它的守卫也是直接 next），但 base-pages 是模板项目

**影响**: 未登录用户可以短暂看到内容页面。

**修复建议**:
- 在 `beforeEach` 中添加 token 检查（`useUserStore().token`）
- 未登录时重定向到 login 页面
- 将 login 加入 `ROUTER_WHITE_LIST`

---

#### Issue #6: Movie 列表页的 API 调用模式可能有问题

**文件**: `src/views/movie/list/index.vue`

**问题**: 
```typescript
const params = ref<BaseTableViewParams>({
  pageNo: 1,
  pageSize: 20,
  search: [],
  sort: [],
  conditions: [],
  extra: {}
});
```
而 `:get-data` 传的是:
```html
:get-data="payload => MovieServiceApi.page(payload)"
```

`BaseTableView` 内部会在 `getData` 返回后自动设置 `tableData` 和 `total`。但同时组件内部也定义了 `const tableData = ref<any[]>([]); const total = ref(0);` 并通过 `v-bind` 传入 —— 这可能产生**双重数据源**问题。

**分析**: `BaseTableView` 的设计是：如果传了 `tableData`/`total` props，会用外部数据；如果没传，用内部数据。同时传了外部 ref 又用了 `:get-data`，可能导致数据更新冲突。

**修复建议**: 使用 `:get-data` 时，不应再传 `tableData` 和 `total` props，或者用 `tableViewRef.value?.requestData()` 手动触发请求并处理数据。

---

#### Issue #7: Movie 详情页的 mock 数据逻辑不优雅

**文件**: `src/views/movie/details/index.vue`

**问题**:
```typescript
try {
  const res = await MovieServiceApi.findMovieInfo(id);
  detailInfo.value = res.data || res.result || {};
} catch {
  // 接口未就绪时使用模拟数据
  detailInfo.value = { id, name: "示例电影", ... };
}
```

**问题分析**:
- 生产环境中 catch 块会静默吞掉所有错误（网络错误、500 错误、权限错误等），全部替换为 mock 数据
- 用户无法区分"接口挂了"和"数据不存在"
- mock 数据应该在开发环境使用，生产环境应区分不同错误类型

**修复建议**:
- 仅在 `import.meta.env.DEV` 时使用 mock 数据
- 不同类型错误给不同提示

---

#### Issue #8: 缺少实际的菜单路由配置

**文件**: `src/routers/modules/tenantRouter.ts`

**当前内容**:
```typescript
export const tenantRouter = [
  {
    path: "/home",
    name: "home",
    children: [{ path: "/home/index", name: "homeIndex", component: () => import("@/views/home/index.vue") }]
  },
  {
    path: "/project",
    name: "project",
    children: [
      { path: "/project/list", name: "projectList", component: () => import("@/views/project/index.vue") },
      { path: "/project/editor", name: "projectEditor", meta: { isHide: true }, component: () => import("@/views/project/editor.vue") }
    ]
  }
];
```

**问题**:
- Movie 相关路由（`/movie/list`, `/movie/details`）没有出现在 tenantRouter 中
- 这意味着 movie 页面虽然在 `routers/modules/movieRouter.ts` 中定义，但**未注册到路由系统**
- 需要在 staticRouter 或 tenantRouter 中引入 movieRouter

---

### 🟢 轻微问题

#### Issue #9: `routers/modules/movieRouter.ts` 存在但未注册

**文件**: `src/routers/modules/movieRouter.ts`

**验证**: 该文件定义了 movie 路由，但：
- `staticRouter.ts` 只引入了 `tenantRouter` 和 `ownerRouter`
- `tenantRouter.ts` 没有引用 `movieRouter`

**影响**: Movie 页面路由未注册，访问 `/movie/list` 返回 404。

---

#### Issue #10: Editor 编辑器页面过于庞大

**文件**: `src/views/project/editor.vue` (1635 行)

**问题**: 单个文件包含 1635 行代码，混合了：
- Three.js 场景管理
- 视频播放控制
- 章节管理
- 模型管理
- 相机管理
- 字幕管理
- Player 导出
- 键盘快捷键

**建议**: 部分逻辑已提取到 `src/composables/`（`useThreeScene.ts`, `useChapterDetector.ts`, `usePlayerExport.ts`），但 editor.vue 仍然过重。应考虑：
- 将章节面板、模型面板、相机面板、字幕面板提取为独立子组件
- Editor 主文件仅负责编排和数据流

---

#### Issue #11: `editor_extracted.vue` 存在冗余

**文件**: `src/views/project/editor_extracted.vue`

**问题**: 存在两个版本的编辑器（完整版和精简版），但精简版似乎不是从完整版派生的，而是独立文件。维护两套代码会导致 bug 修复不同步。

**建议**: 使用 feature flag 或组件拆分来代替两个独立文件。

---

#### Issue #12: ECharts 包引入但未在业务中使用

**文件**: `package.json`, `src/components/common/e-charts/`

**问题**: e-charts 组件已从 base-pages 复制过来，但 movie-model-editor 的业务页面（movie list, project list）中未使用任何图表。

**影响**: 打包体积增大（echarts ~1MB），但当前无实际用途。

**建议**: 如果后续确实不需要图表，可移除 echarts 依赖和组件。

---

#### Issue #13: `constants/table-filters-key` 包含储能业务特定代码

**文件**: `src/constants/table-filters-key/index.ts`

**问题**: 该文件包含大量储能业务（EMS、BMS、PCS、电表等）的筛选条件常量，与"电影模型编辑器"的业务领域完全无关。

**建议**: 清理储能业务特定的常量，或替换为 movie 领域的筛选条件。

---

#### Issue #14: 图片资源中包含储能业务图片

**文件**: `src/assets/images/403.png`, `404.png`, `500.png`

**问题**: 这些错误页面图片来自 base-pages（储能业务），可能包含储能相关的插画，与 Movie Model Editor 品牌不一致。

---

#### Issue #15: `App.vue` 中的语言初始化可能重复执行

**文件**: `src/App.vue`

**问题**: 
- `initLanguage()` 在 App.vue setup 中调用（使用 `globalStore.language ?? getBrowserLang()`）
- 同时 `languages/index.ts` 的 i18n 实例在创建时硬编码 `locale: LanguagesEnum.ZH_CN`
- 如果 localStorage 中有之前保存的语言设置，App.vue 初始化时会重新设置，但 i18n 实例已经创建完毕

**分析**: 这可能导致首次渲染时使用 `ZH_CN`，然后 App.vue 初始化后再切换到用户设置的语言，出现短暂的闪烁。

**修复建议**: 在 i18n 创建时就从 localStorage 读取语言设置作为初始 locale。

---

## 四、逻辑不通顺/不合理的地方汇总

### 4.1 路由相关

| # | 问题 | 严重度 |
|---|------|--------|
| R1 | 路由守卫硬编码 `/project/editor` 与 staticRouter 的 `HOME_URL` 不一致 | 🔴 严重 |
| R2 | movieRouter 定义但未注册，/movie/* 路由 404 | 🔴 严重 |
| R3 | 无登录守卫，未认证用户可访问内部页面 | 🟡 中等 |
| R4 | 首页自动跳转 `/project/editor` 缺少错误处理 | 🟡 中等 |

### 4.2 数据流相关

| # | 问题 | 严重度 |
|---|------|--------|
| D1 | Movie 列表页同时用 `:get-data` 和 `v-bind` 传 tableData/total，可能冲突 | 🟡 中等 |
| D2 | Movie 详情页 catch 静默吞所有错误，生产环境体验差 | 🟡 中等 |
| D3 | $t 函数在 script 中的使用模式正确，但部分 key 可能未定义 | 🟢 轻微 |

### 4.3 业务逻辑相关

| # | 问题 | 严重度 |
|---|------|--------|
| B1 | 储能业务常量 (table-filters-key) 与 Movie 业务无关 | 🟢 轻微 |
| B2 | Editor editor.vue 1635 行过重 | 🟢 轻微 |
| B3 | editor_extracted.vue 冗余维护 | 🟢 轻微 |
| B4 | 首页硬重定向破坏用户体验 | 🟡 中等 |

### 4.4 工程化相关

| # | 问题 | 严重度 |
|---|------|--------|
| E1 | base-components 版本冲突 (deps ^1.3.15 vs devDeps ^1.3.13 vs 实际 1.4.10) | 🔴 严重 |
| E2 | ECharts 依赖引入但未使用 | 🟢 轻微 |
| E3 | 错误页面图片可能是储能主题 | 🟢 轻微 |
| E4 | i18n 初始化可能导致语言闪烁 | 🟢 轻微 |

---

## 五、总体评价

### ✅ 做得好的部分
1. **样式系统 100% 对齐** base-pages，包括 variables、utils、element-ui overwrite、theme
2. **布局系统完全对齐**，包括 watermarked layout、vertical layout、breadcrumb、header-operate
3. **登录页面功能齐全**，Spline 3D、AES 加密、记住密码、版权页脚
4. **base-components 使用标准**，严格遵循 SKILL.md 规范
5. **composables 拆分合理**（useThreeScene, useChapterDetector, usePlayerExport）
6. **Pinia stores 结构清晰**（chapter, model, project, subtitle 独立 store）

### ⚠️ 需要修复的关键问题
1. **路由系统** - movie 路由未注册，重定向冲突，缺少登录守卫
2. **版本管理** - base-components 版本冲突
3. **业务常量残留** - 储能业务常量应清理
4. **数据流** - Movie 列表页双重数据源可能冲突

### 📊 框架对齐评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 样式系统 | 95% | 完全对齐，仅需清理储能业务变量 |
| 布局系统 | 100% | 完全对齐 |
| 登录页面 | 100% | 完全对齐 |
| 路由系统 | 60% | 存在未注册路由和冲突 |
| 状态管理 | 90% | Store 结构正确，版本冲突需修复 |
| 组件使用 | 100% | 严格遵循 base-components 规范 |
| 工程化 | 75% | 版本冲突和冗余依赖 |
| **综合** | **89%** | 框架对齐度良好，主要问题在路由和工程化 |

---

## 六、编辑器逻辑深度分析

> 分析对象: `src/views/project/editor.vue` (1635行) + 相关 composables/stores
> 分析维度: 页面启动流程、初始化展示、章节动画编辑、逻辑通顺性

### 6.1 启动流程分析

当前 editor 初始化流程:

```
1. 页面加载 → 提取 URL 参数 (project id)
2. 从 projectStore 加载项目数据
3. 初始化 Three.js 场景 (useThreeScene.init)
4. 恢复已保存的 chapters / models / subtitles
5. 等待用户上传视频
6. 上传视频后 → 创建章节 → 添加模型 → 配置镜头 → 导出
```

**🔴 问题 A1: 缺少引导式初始化流程**

当前 editor 打开后，用户看到的是空白的 3D 视口 + 空的章节列表。虽然有无视频时的引导卡片("拖拽视频到此处")，但整体流程不够清晰。

**建议**: 添加步骤引导条 (Steps component)，显示当前处于哪个阶段:
```
[1. 上传视频] → [2. 检测/创建章节] → [3. 添加模型] → [4. 配置镜头] → [5. 导出播放器]
```

**🔴 问题 A2: 自动章节检测功能未集成到 UI**

`useChapterDetector.ts` 已完整实现基于颜色直方图的章节自动检测，但 editor.vue 中没有触发按钮。这是一个"写好但用不了"的功能。

**建议**: 在视频信息卡片旁添加"🔍 自动检测章节"按钮，调用 `detectChaptersFromVideo()`。

### 6.2 章节动画编辑功能分析

**🟡 问题 B1: 关键帧系统使用标准化时间但无可视化时间轴**

动画关键帧使用归一化时间 (0-1) 映射到章节实际时长。编辑器显示为简单卡片列表:
```
#1  1.2s  ← 由 kf.time * animDuration 计算
#2  3.5s
#3  6.8s
```

**问题**: 缺乏拖拽排序、时间轴可视化、缓动曲线选择。

**建议**: 
- 方案 A: 保持当前简洁卡片式，不做修改
- 方案 B: 添加时间轴滑块，关键帧可拖拽调整时间，支持缓动曲线选择

**🟡 问题 B2: 动画仅支持模型变换，不支持相机动画过渡**

当前动画系统只作用于模型（位置/缩放/旋转），相机动画是通过章节切换触发的跳跃式切换。

**建议**: 
- 方案 A: 保持现状
- 方案 B: 扩展动画系统支持相机关键帧，实现平滑的运镜过渡

**🟢 问题 B3: 编辑动画后需点击"保存动画"按钮**

用户在动画 tab 中修改关键帧后，必须点击"保存动画"才会生效。如果忘记点击，修改会丢失。

**建议**: 关键帧修改改为实时生效 + 防抖保存，移除"保存动画"按钮。

### 6.3 架构和代码质量

**🟡 问题 C1: editor.vue 1635 行过于庞大**

虽然已提取 `useThreeScene`、`useChapterDetector`、`usePlayerExport` 三个 composable，但 editor.vue 仍然包含:
- 视频管理 (~200行)
- 章节列表 + 编辑 (~200行)  
- 模型管理 + 导入 (~150行)
- 相机配置 (~100行)
- 字幕编辑 (~100行)
- 播放控制 + 进度条 (~150行)
- 键盘快捷键 (~50行)
- 动画关键帧 (~100行)
- 播放器导出 (~50行)
- 模板/样式 (~500行)

**建议**: 将面板拆分为独立子组件:
```
editor/
├── index.vue               ← 编排层 (~200行)
├── TopBar.vue              ← 顶部工具栏
├── ChapterPanel.vue        ← 左侧章节列表
├── ChapterEditor.vue       ← 章节编辑面板
├── SubtitleEditor.vue      ← 字幕编辑面板
├── ModelPanel.vue          ← 模型列表面板
├── ModelDetail.vue         ← 模型详情(属性+动画)
├── VideoUploader.vue       ← 视频上传区域
├── CameraEditor.vue        ← 镜头配置面板
├── ProgressBar.vue         ← 播放进度条
└── ExportDialog.vue        ← 导出对话框
```

**🔴 问题 C2: `editor_extracted.vue` 冗余维护**

存在两个版本的编辑器: 完整版 (`editor.vue`) 和精简版 (`editor_extracted.vue`)。两个是独立文件，不同步。精简版没有关键帧动画、没有服务端模型导入。bug 修复需要同步到两个文件。

**建议**: 删除 `editor_extracted.vue`，通过 feature flag 或组件条件渲染来控制功能开关。

**🟢 问题 C3: `useTranslate` 使用不一致**

editor.vue 中使用了硬编码的中文文本（如 "暂无章节"、"添加"、"编辑"、"删除"、"动画"、"属性"等），没有使用 `$t()` 国际化。与 movie 列表页形成不一致。

**建议**: 全面国际化 editor 的文本。

### 6.4 数据流和状态管理

**🟡 问题 D1: 章节 ModelConfig 数据流复杂**

每个章节维护一个 `modelConfigs` 对象 (`Record<string, ModelConfig>`)，key 是 model ID。当用户在不同章节间切换时:
1. 读取当前章节的 modelConfig
2. 更新 UI 显示（visible/outline/highlight/position/scale）
3. 用户修改后保存回 modelConfig

这个流程容易出错: 如果用户修改了模型属性但未切换到该模型的章节，修改会丢失。

**🟡 问题 D2: 视频状态管理分散**

视频状态 (videoSrc, duration, currentTime, isPlaying) 在 editor.vue 的本地 state 中管理，但 project store 中也有 `currentProject.videoSrc`。两者可能不同步。

**建议**: 将视频播放状态提取为 `useVideoPlayer` composable，与 project store 同步。

### 6.5 用户体验细节

**🟢 问题 E1: 章节列表播放指示不完整**

章节列表显示当前播放章节高亮（`playingIdx === i && isPlaying`），但只在 `isPlaying` 时高亮。暂停时无法看到当前处于哪个章节。

**建议**: 暂停时也显示当前章节指示（用不同颜色或样式区分播放/暂停状态）。

**🟢 问题 E2: 模型导入对话框的"从服务器导入"按钮位置不直观**

"从服务器导入"按钮 (☁️ icon) 位于模型面板顶部，功能是输入 URL 加载 GLB。但按钮标签不够清晰。

**建议**: 将按钮标签改为 "从URL导入" 或添加 tooltip。

**🟢 问题 E3: 缺少快捷键提示面板**

编辑器支持键盘快捷键（Space 播放/暂停, ← → 前后帧, Esc 退出预览），但没有快捷键提示。

**建议**: 添加 `?` 键弹出快捷键面板。

---

## 七、修复总结

### ✅ 已完成的修复 (本轮)

| Issue | 文件 | 修改内容 |
|-------|------|---------|
| #0 (critical) | `hooks/useTranslate.ts` | 替换 `inject("t")` 为直接调用 `translate()` |
| #1 | `package.json` | 移除 devDeps 重复，统一 `^1.4.10` |
| #2,#3,#8,#9 | `routers/index.ts` | 移除硬编码重定向，添加登录守卫 |
| | `routers/modules/staticRouter.ts` | 统一使用 HOME_URL，清理硬编码 |
| | `routers/modules/tenantRouter.ts` | 添加 movie 路由注册 |
| #4 | `views/home/index.vue` | 替换硬重定向为着陆页（卡片式导航 + 快速创建） |
| #6 | `views/movie/list/index.vue` | 移除 tableData/total 双重数据源，BaseTableView 自行管理 |
| #7 | `views/movie/details/index.vue` | DEV 模式 mock 数据，PROD 模式报错提示 |
| #13 | `constants/table-filters-key/index.ts` | 替换储能常量，精简为 movie/project 键 |
| #15 | `languages/index.ts` | 从 localStorage 读取初始 locale，消除闪烁 |

### 📋 编辑器优化选项 (待用户选择)

| 选项 | 内容 | 影响范围 |
|------|------|---------|
| **E1** | 删除 `editor_extracted.vue`，统一使用完整版 | 文件删除，低风险 |
| **E2** | 集成自动章节检测到 editor UI | 新增按钮 + 集成 composable |
| **E3** | 添加步骤引导条 (Steps) 到 editor | 新增 UI 组件 |
| **E4** | 将 editor.vue 拆分为子组件 | 架构重构，工作量大 |
| **E5** | 关键帧时间轴可视化 + 拖拽编辑 | 新增复杂 UI |
| **E6** | 修复播放/暂停时章节指示状态 | 小改动 |
| **E7** | 全面国际化 editor 硬编码文本 | 批量文本替换 |
| **E8** | 提取视频播放状态为 `useVideoPlayer` composable | 中等重构 |
| **E9** | 添加快捷键提示面板 | 新增小 UI |
| **E10** | 模型动画改为实时保存（移除"保存动画"按钮） | 改动动画编辑逻辑 |

