/***
 * 菜单路由
 * @description 菜单路由
 * @param path 路由路径
 * @param name 路由名称
 * @param children 子路由
 * @param meta 路由元信息
 * @param meta.title 路由标题
 * @param meta.icon 路由图标
 * @param meta.isMenu 是否显示在菜单中
 * @param meta.localeKey 多语言key
 * @param meta.activeMenu 当前路由为详情页时，需要高亮的菜单
 * @param meta.isLink 路由外链时填写的访问地址
 */
export const ownerRouter = [
  {
    path: "/project",
    name: "project",
    meta: {
      title: "项目管理",
      icon: "icon-log-line",
      localeKey: "OpWeb.Project.Title",
      isMenu: true
    },
    children: [
      {
        path: "/project/index",
        name: "project-list",
        meta: {
          title: "项目列表",
          isMenu: true,
          localeKey: "OpWeb.Project.List"
        },
        component: () => import("@/views/project/index.vue")
      },
      {
        path: "/project/editor",
        name: "project-editor",
        meta: {
          title: "项目编辑器",
          isMenu: false,
          isHide: true,
          isFull: true,
          activeMenu: "/project/index",
          localeKey: "OpWeb.Project.Editor"
        },
        component: () => import("@/views/project/editor.vue")
      }
    ]
  }
];
