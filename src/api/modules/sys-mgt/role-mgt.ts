import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Result } from "@/interface/index";

/**
 * @name 角色管理模块
 */
// 新增角色
export const addRoleApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role`, params);
};

// 获取角色分页数据
export const getRolePageApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role/page`, params);
};
// 获取角色列表数据
export const getRoleListApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role/list`, params);
};

// 获取角色信息byID
export const getRoleInfoByIdApi = id => {
  return http.get<Result>(PORT1 + `/v1/sys/role/${id}`);
};

// 修改角色
export const updateRoleApi = params => {
  return http.put<Result>(PORT1 + `/v1/sys/role/${params.id}`, params);
};

// 删除角色
export const deleteRoleByIdApi = id => {
  return http.delete<Result>(PORT1 + `/v1/sys/role/${id}`);
};

// 批量删除角色
export const deleteRoleByListApi = params => {
  return http.delete<Result>(PORT1 + `/v1/sys/role`, { data: params });
};

// ----------------------角色组-----------------------------------

// 新增角色组
export const addRoleGroupApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role/group`, params);
};

// 获取角色组分页数据
export const getRoleGroupPageApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role/group/page`, params);
};
// 获取角色组列表数据
export const getRoleGroupListApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role/group/list`, params);
};

// 获取角色组信息byID
export const getRoleGroupInfoByIdApi = id => {
  return http.get<Result>(PORT1 + `/v1/sys/role/group/${id}`);
};

// 修改角色组
export const updateRoleGroupApi = params => {
  return http.put<Result>(PORT1 + `/v1/sys/role/group/${params.id}`, params);
};

// 删除角色组byId
export const deleteRoleGroupByIdApi = id => {
  return http.delete<Result>(PORT1 + `/v1/sys/role/group/${id}`);
};

// 批量删除角色组
export const deleteRoleGroupByListApi = params => {
  return http.delete<Result>(PORT1 + `/v1/sys/role/group`, { data: params });
};

//查询角色分组及角色列表
export const getListWithRoleApi = params => {
  return http.post<Result>(PORT1 + `/v1/sys/role/group/listWithRole`);
};

//获取当前平台资源树结构
export const getResourceTreeApi = () => {
  return http.get<Result>(PORT1 + `/v1/sys/resource/platform/tree`);
};

//获取角色的资源id集合
export const getRoleResourceApi = roleId => {
  return http.get<Result>(PORT1 + `/v1/sys/role/resource/${roleId}`);
};

//给指定角色设置功能权限
export const setRoleResourceApi = params => {
  return http.put<Result>(PORT1 + `/v1/sys/role/resource/${params.roleId}`, params.ids);
};

//给指定角色设置功能权限code配置
export const grantResourceCodes = (roleId, resourceCodes) => {
  return http.post<Result>(PORT1 + `/v1/sys/role/resource/grantResourceCodes/${roleId}`, resourceCodes);
};

//获取角色的资源CODE集合
export const getResourceCodes = roleId => {
  return http.get<Result>(PORT1 + `/v1/sys/role/resource/getResourceCodes/${roleId}`);
};
