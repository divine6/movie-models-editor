// ? 全局默认配置项
import { CurrencyUnitEnum } from "@/enums/httpEnum";

import { getHomeUrl } from "./app-type";

// 首页地址（默认）- 根据应用类型动态获取
export const HOME_URL: string = getHomeUrl();

// 登录页地址（默认）
export const LOGIN_URL: string = "/login";

// 登录加密key
export const LOGIN_ENCRYPTED_KEY: string = "0cbc699f594fed66";

// iconfont 项目地址
export const iconfontUrl: string = "//at.alicdn.com/t/c/font_4986329_ssd3j7ubamk.js";

// 默认主题颜色
export const DEFAULT_PRIMARY: string = "#2426c0";

// 路由白名单地址（本地存在的路由 staticRouter.ts 中）
export const ROUTER_WHITE_LIST: string[] = ["/login", "/layout", "/500", "/403", "/404"];

// 高德地图 key
export const AMAP_MAP_KEY: string = "";

// 百度地图 key
export const BAIDU_MAP_KEY: string = "";

// 谷歌地图 key
export const GOOGLE_MAP_KEY: string = "";

// 货币单位
export const CURRENCY_UNIT: CurrencyUnitEnum = CurrencyUnitEnum.EUR;

// 是否开启权限判断
export const OPEN_AUTH: boolean = true;

// 是否路由权限判断
export const OPEN_ROUTE_AUTH: boolean = true;
