import { RouteRecordRaw } from "vue-router";

import { HOME_URL, LOGIN_URL } from "@/config";
import { APP_TYPE, AppType } from "@/config/app-type";

import { ownerRouter } from "./ownerRouter";
import { tenantRouter } from "./tenantRouter";

// 根据应用类型选择对应的路由
const getMenuRouter = () => {
  if (APP_TYPE === AppType.OWNER) {
    return ownerRouter;
  }
  return tenantRouter;
};

/**
 * staticRouter (静态路由)
 */
export const staticRouter: RouteRecordRaw[] = [
  {
    path: "/",
    name: "root",
    redirect: HOME_URL
  },
  {
    path: LOGIN_URL,
    name: "login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: "登录"
    }
  },
  {
    path: "/layout",
    name: "layout",
    component: () => import("@/layouts/index.vue"),
    redirect: HOME_URL,
    children: [...getMenuRouter()]
  }
];

/**
 * errorRouter (错误页面路由)
 */
export const errorRouter = [
  {
    path: "/403",
    name: "403",
    component: () => import("@/components/business/error-message/403.vue"),
    meta: {
      title: "403页面"
    }
  },
  {
    path: "/404",
    name: "404",
    component: () => import("@/components/business/error-message/404.vue"),
    meta: {
      title: "404页面"
    }
  },
  {
    path: "/500",
    name: "500",
    component: () => import("@/components/business/error-message/500.vue"),
    meta: {
      title: "500页面"
    }
  },
  // Resolve refresh page, route warnings
  {
    path: "/:pathMatch(.*)*",
    component: () => import("@/components/business/error-message/404.vue")
  }
];
