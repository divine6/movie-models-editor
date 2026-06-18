# base-pages vs movie-model-editor 差异问题清单

> 对照基准: `d:\Work\saas3.0\base-pages\` (运行在 `http://localhost:5175/static/base-pages-tenant`)
> 目标项目: `d:\Work\saas3.0\movie-model-editor\`
> 生成日期: 2026-06-02

---

## 一、样式系统 (CSS/SCSS)

### Issue #1: 缺少 `src/styles/index.scss` 完整入口样式
**影响**: 整个应用的视觉基础缺失
**base-pages 有**: 引入了 variables、common、utils、element-ui/overwrite、element-plus message-box/message 样式
**movie-model-editor 有**: 仅引入了 `variables.scss`
**需要做**:
- [ ] 创建 `src/styles/variables/index.scss` (ECharts 变量 + 全局 CSS/SCSS 变量)
- [ ] 创建 `src/styles/common/index.scss` (公共样式)
- [ ] 创建 `src/styles/utils/index.scss` → 内含 `reset.scss`、flex 工具类、clearfix、文字省略号、滚动条样式、nprogress 样式、mt0~mt100 间距工具类
- [ ] 创建 `src/styles/element-ui/overwrite.scss` (大量 Element Plus 组件覆盖样式: drawer, dialog, form, input, select, date-editor, button, radio, checkbox, message-box, tree, menu, table, card, segmented)
- [ ] 更新 `src/styles/index.scss` 入口文件

### Issue #2: 缺少 `src/styles/theme/` 主题系统
**影响**: 暗黑模式/主题切换不起作用
**需要做**:
- [ ] 创建 `src/styles/theme/aside.ts` (侧边栏主题: light/inverted/dark)
- [ ] 创建 `src/styles/theme/header.ts` (头部主题: light/inverted/dark)
- [ ] 创建 `src/styles/theme/menu.ts` (菜单主题: light/inverted/dark)
- [ ] 创建 `src/styles/theme/dark.scss` (暗黑模式变量)

### Issue #3: Element Plus CSS 变量 / 主题覆盖缺失
**影响**: 主题色不对（当前是 `#409eff`，应该是 `#2426c0`）
**当前状态**: movie-model-editor 的 HTML 根元素上只有默认 Element Plus CSS 变量
**需要做**:
- [ ] 配置 `DEFAULT_PRIMARY: "#2426c0"` 
- [ ] Theme hook 正确设置 CSS 自定义属性 (`--el-color-primary`, `--el-color-primary-light-1~9` 等)

### Issue #4: 缺少 `src/styles/common/index.scss` 公共样式
**base-pages 内容**: 包含 `.add-sit-view-drawer` 等业务公共样式，背景色 `#f2f3f5`

---

## 二、登录页面

### Issue #5: 登录页面缺少 3D Spline 背景
**base-pages**: 使用 `@splinetool/runtime` 加载 3D 场景 `scene.splinecode`
**movie-model-editor**: 没有任何背景动画
**需要做**:
- [ ] 安装 `@splinetool/runtime` 依赖
- [ ] 添加 `<canvas ref="canvas">` 元素
- [ ] 实现 `loadScene()` 方法
- [ ] 设置 canvas 全屏定位样式
- [ ] 如无 `.splinecode` 文件，降级为 CSS 渐变背景

### Issue #6: 登录页面缺少 Logo
**base-pages**: 顶部显示 `logo.svg` 图片
**movie-model-editor**: 无 logo
**需要做**:
- [ ] 复制 `src/assets/images/common/logo.svg`
- [ ] 在登录表单头部添加 logo 图片

### Issue #7: 登录表单结构差异
**base-pages**: `label-position="top"`, 字段顺序: 租户ID → 账号 → 密码 → 记住密码 → 登录按钮 → 语言切换
**movie-model-editor**: 不同的表单结构
**需要做**:
- [ ] 添加"租户ID"字段 (type=number, 仅租户端显示)
- [ ] 修改 label-position 为 "top"
- [ ] 添加"记住密码" checkbox
- [ ] 字段顺序对齐 base-pages

### Issue #8: 登录页面缺少版权页脚
**base-pages**: `版权所有 © 2025 · 用户协议 · 隐私政策 · 沪ICP备16509937号 · 沪公网安备 31010602006888号`
**movie-model-editor**: 无
**需要做**:
- [ ] 添加 `.login-footer` 固定在页面底部

### Issue #9: 登录页面样式完全不同
**base-pages**: 玻璃拟态卡片 (backdrop-filter: blur(20px))，圆角 `var(--corner-radius-10)`，投影 `0 20px 40px 0 rgba(0,0,0,0.1)`，宽度 500px，高度 628px
**movie-model-editor**: 基础 Element Plus 表单样式
**需要做**:
- [ ] 创建 `src/views/login/index.scss`（从 base-pages 复制）
- [ ] SCSS 变量名对齐（`--fill-color-8`, `--border-color-6`, `--corner-radius-10` 等）

### Issue #10: 缺少加密登录逻辑
**base-pages**: 使用 `crypto-js` AES 加密密码，支持记住密码（加密存储）
**movie-model-editor**: 无加密
**需要做**:
- [ ] 安装 `crypto-js` 依赖
- [ ] 添加 `LOGIN_ENCRYPTED_KEY` 配置
- [ ] 实现 `encodeAesString` / `decodeAesString` 方法
- [ ] 实现 remember me 存储/读取逻辑

---

## 三、布局系统

### Issue #11: 布局组件架构完全不同
**base-pages**: 
```
layouts/index.vue → 根据 layout type 渲染组件
  └── layout-vertical/index.vue
        ├── el-container
        │   ├── base-menu (侧边栏)
        │   ├── el-header (含 breadcrumb + header-operate)
        │   └── Main (内容区)
        ├── circle (圆形渐变背景)
        └── preview-container (悬浮折叠菜单)
```
**movie-model-editor**: 
```
layouts/index.vue → base-layout (base-components封装)
  └── router-view
```
**需要做**:
- [ ] 用 base-pages 的 `layouts/index.vue` 和 `layout-vertical/index.vue` 替换现有布局
- [ ] 创建 `layouts/components/Main/index.vue` 和 `Main/index.scss`
- [ ] 创建 `layouts/components/Main/components/Maximize.vue`

### Issue #12: 缺少面包屑组件
**base-pages**: `layout-vertical/breadcrumb.vue`
**movie-model-editor**: 无
**需要做**:
- [ ] 创建 `src/layouts/layout-vertical/breadcrumb.vue`

### Issue #13: 缺少头部操作组件
**base-pages**: `layout-vertical/header-operate.vue` (语言切换、全屏、主题切换、用户信息等)
**movie-model-editor**: 无
**需要做**:
- [ ] 创建 `src/layouts/layout-vertical/header-operate.vue`

### Issue #14: 缺少语言切换组件
**base-pages**: `layout-vertical/language.vue`
**movie-model-editor**: 无
**需要做**:
- [ ] 创建 `src/layouts/layout-vertical/language.vue`

### Issue #15: 缺少侧边栏菜单 logo 和页脚
**base-pages**: 侧边栏顶部显示 logo.svg，底部显示 "Powered by UltimateBox"
**movie-model-editor**: 无
**需要做**:
- [ ] 侧边栏添加 logo 插槽
- [ ] 侧边栏添加 footer 插槽

### Issue #16: 缺少圆形渐变背景和折叠菜单悬浮效果
**base-pages**: 侧边栏鼠标跟随圆形渐变 (`circle` div)，折叠时悬浮弹出菜单 (`preview-container`)
**movie-model-editor**: 无
**需要做**:
- [ ] 添加 circle 渐变背景元素和 mousemove 事件
- [ ] 添加折叠菜单的悬浮预览容器

### Issue #17: 缺少 el-header 样式
**base-pages**: header 高度 60px，左侧有圆形 icon-box (40x40)，右侧 header-operate
**movie-model-editor**: 不同的 header 样式
**需要做**:
- [ ] 对齐 header 结构和样式

---

## 四、入口文件

### Issue #18: main.ts 缺少字体样式和图标插件
**base-pages**:
```ts
import "@/assets/fonts/font.scss";           // ← 缺失
import IconsPlugin from "@/config/icons";      // ← 缺失
app.use(IconsPlugin)                           // ← 缺失
```
**movie-model-editor**: 缺少这两项
**需要做**:
- [ ] 创建 `src/assets/fonts/font.scss` (或复制字体文件)
- [ ] 创建 `src/config/icons.ts` (IconsPlugin)

### Issue #19: App.vue 缺少 UpdateVersion 和 ServiceWorker
**base-pages**: 有 `UpdateVersion` 组件和 `useServiceWorker` hook
**movie-model-editor**: 无
**需要做**:
- [ ] 创建 `src/components/common/update-version/index.vue`
- [ ] 创建 `src/hooks/useServiceWorker.ts`
- [ ] 在 App.vue 中集成

### Issue #20: App.vue 缺少 useTheme 初始化
**base-pages**: 在 setup 中调用 `initTheme()` 和 `initLanguage()`
**movie-model-editor**: 仅在 `onMounted` 中初始化语言
**需要做**:
- [ ] 创建 `src/hooks/useTheme.ts` (从 base-pages 复制)
- [ ] 创建 `src/hooks/interface/index.ts`
- [ ] 创建 `src/utils/color.ts` (getDarkColor, getLightColor)
- [ ] 在 App.vue 中调用 initTheme

---

## 五、状态管理

### Issue #21: Global Store 字段不完整
**base-pages 有但 movie-model-editor 缺少的字段**:
- `isMock: boolean`
- `maximize: boolean`
- `isGrey: boolean` (灰色模式)
- `isWeak: boolean` (色弱模式)
- `asideInverted: boolean` (侧边栏反转)
- `headerInverted: boolean` (头部反转)
- `accordion: boolean` (菜单手风琴)
- `watermark: boolean` (水印)
- `breadcrumb: boolean` (面包屑)
- `breadcrumbIcon: boolean`
- `tabs: boolean`
- `tabsIcon: boolean`
- `footer: boolean`

**需要做**:
- [ ] 对齐 GlobalState 接口和 state 默认值

### Issue #22: User Store 字段不完整
**base-pages 有但 movie-model-editor 缺少**:
- `isCollapse: boolean` (侧边栏折叠状态在 user store)
- `havePermission` getter
- `authCodes` getter
- `OPEN_AUTH` 条件判断

**需要做**:
- [ ] 对齐 UserState 接口

### Issue #23: Stores 缺少 persist helper
**base-pages**: `src/stores/helper/persist.ts` (pinia persist 配置封装)
**movie-model-editor**: 直接在 store 中配置 persist
**需要做**:
- [ ] 创建 `src/stores/helper/persist.ts`

---

## 六、路由系统

### Issue #24: 路由结构不同
**base-pages**:
```
/ → redirect to HOME_URL
/login → login 页面
/layout → 布局组件 → children (tenant/owner 路由)
/403, /404, /500 → 错误页面组件
/:pathMatch(.*)* → 404
```
**movie-model-editor**: 直接挂载路由，无 /layout 包裹层
**需要做**:
- [ ] 对齐路由结构
- [ ] 创建错误页面组件 `403.vue`, `404.vue`, `500.vue` (或从 base-pages 复制)

### Issue #25: 缺少路由守卫 NProgress 和页面标题设置
**base-pages**: beforeEach 启动 NProgress + 动态设置 document.title
**movie-model-editor**: 路由守卫较简单
**需要做**:
- [ ] 对齐路由守卫逻辑

---

## 七、配置和常量

### Issue #26: 配置项不完整
**base-pages 有但 movie-model-editor 缺少**:
- `LOGIN_ENCRYPTED_KEY` (登录加密密钥)
- `DEFAULT_PRIMARY: "#2426c0"` (主题色不同)
- `CURRENCY_UNIT` (货币单位)
- `OPEN_AUTH` (权限开关)
- `OPEN_ROUTE_AUTH` (路由权限开关)
- `iconfontUrl` (图标字体地址)
- `ROUTER_WHITE_LIST` (路由白名单)
- `AMAP_MAP_KEY`, `BAIDU_MAP_KEY`, `GOOGLE_MAP_KEY`
- `HOME_URL` 通过 `getHomeUrl()` 动态获取

**需要做**:
- [ ] 对齐 `src/config/index.ts`

### Issue #27: app-type.ts 配置不同
**base-pages**: 包含完整的枚举、标题配置、权限前缀、项目前缀、API 前缀
**movie-model-editor**: 仅有基础的 tenant/owner 判断
**需要做**:
- [ ] 对齐 `src/config/app-type.ts`

### Issue #28: 缺少 constants 子模块
**base-pages**:
```
constants/
├── index.ts
├── storage-key.ts
├── dictionary/
├── permission/
└── table-filters-key.ts
```
**movie-model-editor**: 仅有一个 `index.ts`
**需要做**:
- [ ] 创建 `constants/storage-key.ts`
- [ ] 创建 `constants/dictionary/`
- [ ] 创建 `constants/permission/`
- [ ] 创建 `constants/table-filters-key.ts`

---

## 八、业务组件

### Issue #29: 缺少错误页面组件
**base-pages**: `components/business/error-message/403.vue`, `404.vue`, `500.vue`
**movie-model-editor**: views/error/ 下的错误页面样式/结构可能不同
**需要做**:
- [ ] 从 base-pages 复制 error-message 组件
- [ ] 复制对应的图片资源 (`403.png`, `404.png`, `500.png`)

### Issue #30: 缺少通用组件
**base-pages 有但 movie-model-editor 缺少**:
- `components/business/switch-dark/index.vue` (暗黑模式切换)
- `components/business/account-center/index.vue` (个人中心)
- `components/business/update-password/index.vue` (修改密码)
- `components/common/loading/index.vue` (加载组件)
- `components/common/grid/` (栅格布局)
- `components/common/e-charts/` (图表组件)
- `components/common/add-refresh-btn/` (添加/刷新按钮)

---

## 九、Hooks

### Issue #31: 缺少多个 hooks
**base-pages 有但 movie-model-editor 缺少**:
- `hooks/useTheme.ts` (主题切换)
- `hooks/useServiceWorker.ts` (Service Worker 更新)
- `hooks/useOnline.ts` (在线状态)
- `hooks/useHandleData.ts` (数据处理)
- `hooks/useDownload.ts` (文件下载)
- `hooks/useTableFilterConditions.ts` (表格筛选条件持久化)
- `hooks/useTime.ts` (时间工具)

**需要做**:
- [ ] 根据项目需要选择性创建缺失的 hooks

---

## 十、资源文件

### Issue #32: 缺少图片资源
**base-pages 有**:
- `assets/images/common/logo.svg`
- `assets/images/common/empty.png`
- `assets/images/login/translate-line.svg`
- `assets/images/403.png`, `404.png`, `500.png`
- `assets/images/notData.png`

**需要做**:
- [ ] 从 base-pages 复制必要的图片资源

### Issue #33: 缺少字体文件
**base-pages**: `assets/fonts/font.scss` 及相关字体文件
**movie-model-editor**: 无
**需要做**:
- [ ] 复制字体文件和样式

### Issue #34: 缺少图标配置
**base-pages**: `assets/icons/` + `config/icons.ts`
**movie-model-editor**: 无
**需要做**:
- [ ] 复制图标配置和图标资源

---

## 十一、依赖包

### Issue #35: package.json 缺少依赖
**base-pages 有但 movie-model-editor 可能缺少**:
| 包名 | 用途 |
|------|------|
| `@splinetool/runtime` | 登录页 3D 场景 |
| `crypto-js` | 登录密码加密 |
| `@types/crypto-js` | crypto-js 类型 |
| `echarts` | 图表 |
| `@wangeditor/editor` | 富文本编辑器 |
| `@wangeditor/editor-for-vue` | 富文本编辑器 Vue 组件 |

**需要做**:
- [ ] 按需添加缺失的依赖

---

## 优先级建议

| 优先级 | Issues | 说明 |
|--------|--------|------|
| 🔴 P0 | #1, #3, #5~#9, #11, #18, #26 | 视觉最明显的差异：样式、登录页、布局 |
| 🟡 P1 | #2, #19, #20, #21, #24, #32, #34 | 主题、路由、Store 对齐 |
| 🟢 P2 | #4, #15, #16, #22, #25, #27, #28 | 细节对齐 |
| ⚪ P3 | #10, #12~#14, #17, #29~#31, #33, #35 | 增强功能和组件 |

---

> **注意**: 这个清单假设 base-pages 是标准模板。实际修复时，部分 base-pages 特有的功能（如 Spline 场景、特定业务组件）可能需要根据 movie-model-editor 的实际需求进行取舍。
