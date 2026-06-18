// 请求响应参数（不包含data）
export * from "./business-components";

export interface Result {
  code: number;
  key: string;
  success: boolean;
  msg: string;
  result: any;
  extra: any;
}

// 表单类型 查看 编辑 新增
export type FormType = "view" | "edit" | "add";

// 组件使用模式 页面模式 组件模式
export type Mode = "page" | "component";

// 表单配置
export interface FormConfig {
  type: FormType;
  data: Record<string, any>;
}
