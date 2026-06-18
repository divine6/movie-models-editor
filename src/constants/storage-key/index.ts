import { getPorjectPrefix } from "@/config/app-type";

/**
 * @description 项目后缀
 */
export const PROJECT_SUFFIX = getPorjectPrefix();

/**
 * @description 密码安全提醒
 */
export const NEED_UPDATE_STORAGE_KEY = `${PROJECT_SUFFIX}-need-update`;

/**
 * @description 登录账号密码信息-加密后存储-记住密码
 */
export const LOGIN_STORAGE_KEY = `${PROJECT_SUFFIX}-login-info`;

/**
 * @description 全局仓库
 */
export const GLOBAL_STORAGE_KEY = `${PROJECT_SUFFIX}-global-store`;

/**
 * @description 缓存仓库
 */
export const KEEP_ALIVE_STORAGE_KEY = `${PROJECT_SUFFIX}-keepAlive-store`;

/**
 * @description 标签页仓库
 */
export const TABS_STORAGE_KEY = `${PROJECT_SUFFIX}-tabs-store`;

/**
 * @description 用户仓库
 */
export const USER_STORAGE_KEY = `${PROJECT_SUFFIX}-user-store`;

/**
 * @description 字典仓库
 */
export const DICTIONARY_STORAGE_KEY = `${PROJECT_SUFFIX}-dictionary-store`;

/**
 * @description 权限仓库
 */
export const AUTH_STORAGE_KEY = `${PROJECT_SUFFIX}-auth-store`;
