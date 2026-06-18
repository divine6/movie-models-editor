/**
 * 应用类型配置
 * 用于区分租户端(tenant)和业主端(owner)
 */
export enum AppType {
  TENANT = "tenant", // 租户端
  OWNER = "owner" // 业主端
}

// 应用标题配置
export const APP_TITLE_CONFIG = {
  [AppType.TENANT]: "租户运营管理平台",
  [AppType.OWNER]: "业主运营管理平台"
};

// 权限码前缀配置
export const PERM_PREFIX_CONFIG = {
  [AppType.TENANT]: `${AppType.TENANT}.permission`,
  [AppType.OWNER]: `${AppType.OWNER}.permission`
};

// 项目前缀
export const PROJECT_SUFFIX_CONFIG = {
  [AppType.TENANT]: `sass3.0-${AppType.TENANT}`,
  [AppType.OWNER]: `sass3.0-${AppType.OWNER}`
};

// 首页地址配置
export const HOME_URL_CONFIG = {
  [AppType.TENANT]: "/project/editor",
  [AppType.OWNER]: "/project/editor"
};

// 后端服务模块前缀配置
export const API_PREFIX_CONFIG = {
  [AppType.TENANT]: "/op",
  [AppType.OWNER]: "/owner"
};

// 当前应用类型，通过环境变量控制
export const APP_TYPE: AppType = (import.meta.env.VITE_APP_TYPE as AppType) || AppType.TENANT;

// 是否为租户端
export const IS_TENANT = APP_TYPE === AppType.TENANT;

// 是否为业主端
export const IS_OWNER = APP_TYPE === AppType.OWNER;

// 应用标题
export const getAppTitle = () => APP_TITLE_CONFIG[APP_TYPE];

// 权限码前缀
export const getPermPrefix = () => PERM_PREFIX_CONFIG[APP_TYPE];

// 项目前缀
export const getPorjectPrefix = () => PROJECT_SUFFIX_CONFIG[APP_TYPE];

//
export const getApiPrefix = () => API_PREFIX_CONFIG[APP_TYPE];

export const getHomeUrl = () => HOME_URL_CONFIG[APP_TYPE];
