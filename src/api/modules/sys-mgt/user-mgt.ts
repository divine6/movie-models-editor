import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Result } from "@/interface/index";
/**
 * @name 用户管理模块
 */
// 新增用户
export const addUserApi = params => {
  return http.post<Result>(PORT1 + `/v1/user`, params);
};

// 获取用户分页数据
export const getUserPageApi = params => {
  return http.post<Result>(PORT1 + `/v1/user/page`, params);
};
// 获取用户列表
export const getUserListApi = params => {
  return http.post<Result>(PORT1 + `/v1/user/list`, params);
};

// 获取用户信息byId
export const getUserInfoByIdApi = id => {
  return http.get<Result>(PORT1 + `/v1/user/${id}`);
};

// 修改用户
export const updateUserApi = params => {
  return http.put<Result>(PORT1 + `/v1/user/${params.id}`, params);
};

// 删除用户byId
export const deleteUserByIdApi = id => {
  return http.delete<Result>(PORT1 + `/v1/user/${id}`);
};

// 批量删除用户
export const deleteUserByListApi = params => {
  return http.delete<Result>(PORT1 + `/v1/user`, { data: params });
};

// 重置指定用户密码
export const resetUserPassWordApi = userId => {
  return http.put<Result>(PORT1 + `/v1/user/reset/password/${userId}`);
};

// 批量冻结或解冻用户
export const freezeUserApi = (params, freeze) => {
  return http.put<Result>(PORT1 + `/v1/user/freeze/${freeze}`, params);
};

// 修改当前登录用户的密码
export const updateUserPassWordApi = params => {
  return http.put<Result>(PORT1 + `/v1/user/update/password`, params);
};

//租户额度信息详情接口
export const getTenantQuotaApi = () => {
  return http.get<Result>(PORT1 + `/v1/tenant/leftDetail`);
};
