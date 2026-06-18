import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { ElMessage } from "element-plus";

import { ResultData } from "@/api/interface";
import { LOGIN_URL } from "@/config";
import { ResultEnum } from "@/enums/httpEnum";
import router from "@/routers";
import { useDictionaryStore } from "@/stores/modules/dictionary";
import { useGlobalStore } from "@/stores/modules/global";
import { useUserStore } from "@/stores/modules/user";

import { AxiosCanceler } from "../helper/axiosCancel";
import { checkHttpStatus } from "../helper/checkHttpStatus";

export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  loading?: boolean;
  cancel?: boolean;
}
interface DeleteOptions {
  query?: Record<string, any>; // 查询参数
  data?: Record<string, any>; // 请求体参数
}

const config = {
  // 默认地址请求地址，可在 .env.** 文件中修改
  baseURL: import.meta.env.VITE_API_URL as string,
  // 设置超时时间
  timeout: ResultEnum.TIMEOUT as number,
  // 跨域时候允许携带凭证
  withCredentials: true
};

const axiosCanceler = new AxiosCanceler();

class RequestHttp {
  service: AxiosInstance;
  public constructor(config: AxiosRequestConfig) {
    this.service = axios.create(config);

    /**
     * @description 请求拦截器
     * 客户端发送请求 -> [请求拦截器] -> 服务器
     * token校验(JWT) : 接受服务器返回的 token,存储到 pinia 和 本地储存当中
     */
    this.service.interceptors.request.use(
      (config: CustomAxiosRequestConfig) => {
        const userStore = useUserStore();
        const globalStore = useGlobalStore();
        const { accessor } = useDictionaryStore();
        const timezone = accessor.item("timezone", userStore.userInfo?.timezoneId)?.timezoneOffset;

        // 重复请求不需要取消，在 api 服务中通过指定的第三个参数: { cancel: false } 来控制
        config.cancel ??= true;
        config.cancel && axiosCanceler.addPending(config);
        if (config.headers && typeof config.headers.set === "function") {
          if (userStore.token) {
            config.headers.set("Authorization", userStore.token);
          }
          if (userStore.userInfo?.tenantId) {
            config.headers.set("x-tenant-id", userStore.userInfo.tenantId);
          }
          if (userStore.userInfo?.timezoneId) {
            config.headers.set("timezone", timezone);
          }
          // if (globalStore.isMock) {
          //   config.headers.set("mock", globalStore.isMock ? "enable" : "disable");
          // }
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    /**
     * @description 响应拦截器
     *  服务器换返回信息 -> [拦截统一处理] -> 客户端JS获取到信息
     */
    this.service.interceptors.response.use(
      (response: AxiosResponse & { config: CustomAxiosRequestConfig }) => {
        const { data, config } = response;
        const userStore = useUserStore();

        axiosCanceler.removePending(config);
        // 登录失效
        if (data.code == ResultEnum.OVERDUE) {
          userStore.setToken("");
          userStore.setUserInfo({});
          userStore.setTenantId("");
          router.replace(LOGIN_URL);
          ElMessage.error($t(data.key, data.msg));
          return Promise.reject(data);
        }
        // 全局错误信息拦截（防止下载文件的时候返回数据流，没有 code 直接报错）
        if (data.code && data.code !== ResultEnum.SUCCESS) {
          ElMessage.error($t(data.key, data.msg));
          return Promise.reject(data);
        }
        // 文件下载或导入导出
        if (config.responseType === "blob") {
          return Promise.resolve(response);
        }
        // 成功请求（在页面上除非特殊情况，否则不用处理失败逻辑）
        return data;
      },
      async (error: AxiosError) => {
        const { response } = error;
        // 请求超时 && 网络错误单独判断，没有 response
        if (error.message.indexOf("timeout") !== -1) ElMessage.error("请求超时！请您稍后重试");
        if (error.message.indexOf("Network Error") !== -1) ElMessage.error("网络错误！请您稍后重试");
        // 根据服务器响应的错误状态码，做不同的处理
        if (response) checkHttpStatus(response.status);
        // 服务器结果都没有返回(可能服务器错误可能客户端断网)，断网处理:可以跳转到断网页面
        if (!window.navigator.onLine) router.replace("/500");
        return Promise.reject(error);
      }
    );
  }

  /**
   * @description 常用请求方法封装
   */
  get<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
    return this.service.get(url, { params, ..._object });
  }
  post<T>(url: string, params?: object | string, _object = {}): Promise<ResultData<T>> {
    return this.service.post(url, params, _object);
  }
  put<T>(url: string, params?: object, _object = {}): Promise<ResultData<T>> {
    return this.service.put(url, params, _object);
  }
  // 使用示例:
  // 仅查询参数: request.delete('/api/users', { query: { id: 123 } })
  // 仅body参数: request.delete('/api/users', { data: { ids: [1,2,3] } })
  // 同时使用: request.delete('/api/users', { query: { force: true }, data: { ids: [1,2,3] } })
  delete<T>(url: string, options?: DeleteOptions, _object = {}): Promise<ResultData<T>> {
    const config: any = { ..._object };
    if (options?.query) {
      config.params = options.query;
    }
    if (options?.data) {
      config.data = options.data;
    }
    return this.service.delete(url, config);
  }
  download(url: string, params?: object, _object?: CustomAxiosRequestConfig): Promise<AxiosResponse<Blob, any>> {
    return this.service.post<Blob>(url, params, { ..._object, responseType: "blob" });
  }
}

export default new RequestHttp(config);
