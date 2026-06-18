import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Login } from "@/api/interface/index";

// 获取菜单列表
export const getAuthMenuListApi = () => {
  return http.get<Menu.MenuOptions[]>(PORT1 + `/menu/list`, {}, {});
};

// 获取按钮权限
export const getAuthButtonListApi = () => {
  return http.get<Login.ResAuthButtons>(PORT1 + `/auth/buttons`, {}, {});
};

// 用户退出登录
export const logoutApi = () => {
  return http.post(PORT1 + `/logout`);
};

// 获取租户剩余天数
export const surplusDayApi = () => {
  return http.get(PORT1 + `/v1/tenant/surplus/day`);
};
