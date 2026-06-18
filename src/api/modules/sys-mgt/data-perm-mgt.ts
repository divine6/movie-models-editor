import { BaseTableViewParams } from "base-components";

import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Result } from "@/interface/index";

/**
 * @name 数据权限管理
 */

// 租户数据权限接口Api
export const dataPermMgtServiceApi = {
  // 分页
  page: (params: BaseTableViewParams) => http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup/page`, params),
  // 列表
  list: (params: BaseTableViewParams) => http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup/list`, params),
  // 新增
  create: (params: any) => http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup`, params),
  // 删除
  delete: (id: string) => http.delete<Result>(PORT1 + `/v1/permission/dataPermissionGroup/${id}`),
  // 批量删除
  batchDelete: (ids: string[]) => http.delete<Result>(PORT1 + `/v1/permission/dataPermissionGroup`, { data: ids }),
  // 修改
  update: (id: string, params: any) => http.put<Result>(PORT1 + `/v1/permission/dataPermissionGroup/${id}`, params),
  // 详情
  detail: (id: string) => http.get<Result>(PORT1 + `/v1/permission/dataPermissionGroup/${id}`),
  // 场站数据分页
  stationPage: (params: BaseTableViewParams) =>
    http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup/stationConfigPage`, params),
  // 场站数据列表
  stationList: (params: any) => http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup/stationConfigList`, params),
  // 用户配置列表数据
  userConfigPage: (params: any) => http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup/userConfigPage`, params),
  userConfigList: (params: any) => http.post<Result>(PORT1 + `/v1/permission/dataPermissionGroup/userConfigList`, params),
  //地区资产树  /v1/asset/regionTree
  regionTree: (params: any) => http.get<Result>(PORT1 + `/v1/asset/regionTree`, params),
  // 查询业主列表
  ownerList: (params: any) => http.post<Result>(PORT1 + `/v1/owner/list`, params)
};

// 地区资产树接口Api
export const assetServiceApi = {
  //资产树  /v1/asset/regionTree
  assetTree: (params: any) => http.get<Result>(PORT1 + `/v1/asset/tree`, params),
  //地区资产树
  regionTree: (params: any) => http.get<Result>(PORT1 + `/v1/asset/regionTree`, params),
  // 详情
  detail: (id: string) => http.get<Result>(PORT1 + `/v1/asset/${id}`),
  // 修改
  update: (id: string, params: any) => http.put<Result>(PORT1 + `/v1/asset/${id}`, params),
  // 删除
  delete: (id: string) => http.delete<Result>(PORT1 + `/v1/asset/${id}`),
  // 新增
  create: (params: any) => http.post<Result>(PORT1 + `/v1/asset`, params),
  //资产类型列表
  assetNodeType: (params: any) => http.post<Result>(PORT1 + `/v1/assetNodeType/list`, params)
};
