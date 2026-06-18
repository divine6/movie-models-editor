import { ElMessage } from "element-plus";

export type ToastType = "success" | "warning" | "error" | "info";

const TOAST_CLASS = "app-toast";

/** 全局 Toast，基于 ElMessage + 自定义 app-toast 样式 */
export function toastShow(message: string, type: ToastType = "success") {
  return ElMessage({
    message,
    type,
    customClass: TOAST_CLASS,
    grouping: true,
    duration: 3000,
    showClose: false
  });
}
