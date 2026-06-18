import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Result } from "@/interface/index";

/**
 * @name 字典服务
 */

export const CommonServiceApi = {
  // 获取全量字典
  staticDictionary: () => http.get<Result>(PORT1 + `/v1/common/staticDictionary`),
  // 获取单个字典值根据code
  dictListByCode: (dictTypeCode: string) => http.get<Result>(PORT1 + `/v1/common/dicList/${dictTypeCode}`)
};

// 字典服务
export const DictionaryServiceApi = {
  // 获取单个字典值根据id
  detail: (id: string) => http.get<Result>(PORT1 + `/v1/dictionary/${id}`),
  // 新增字典
  create: (params: any) => http.post<Result>(PORT1 + `/v1/dictionary`, params),
  // 修改字典
  update: (id: string, params: any) => http.put<Result>(PORT1 + `/v1/dictionary/${id}`, params),
  // 删除字典
  delete: (id: string) => http.delete<Result>(PORT1 + `/v1/dictionary/${id}`)
};

// 语言服务
export const LanguageServiceApi = {
  // 获取语言列表
  // scope 1WEB，2接口，3APP
  // identify en-US，zh-CN
  list: (scope: string, identify: string) => http.get<Result>(PORT1 + `/v1/language/config/${scope}/${identify}`)
};

// 用户筛选条件查询服务
export const UserSearchServiceApi = {
  get: (identity: string) => http.post<Result>(PORT1 + `/v1/userSearch/getCondition/${identity}`, {}),
  update: (params: any) => http.post<Result>(PORT1 + `/v1/userSearch/updateCondition`, params)
};
