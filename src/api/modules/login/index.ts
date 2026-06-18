import { PORT1 } from "@/api/config/servicePort";
import http from "@/api/http";
import { Login } from "@/api/interface";

// 登录模块
export const LoginServiceApi = {
  login: (params: Login.ReqLoginForm) => {
    console.log("params.tenantId :>> ", params.tenantId);
    return http.post<Login.ResLogin>(PORT1 + `/v1/auth/login`, params, {
      headers: {
        "x-tenant-id": params.tenantId,
        lang: "zh-CN",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  },
  logout: () => http.post(PORT1 + `/v1/auth/logout`),
  updateTimezone: (params: { timezoneId: string }) => http.put(PORT1 + `/v1/auth/update/timezone`, params)
};
