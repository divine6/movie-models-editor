declare global {
  interface Navigator {
    msSaveOrOpenBlob: (blob: Blob, fileName: string) => void;
    browserLanguage: string;
  }
  interface Window {}

  // 声明全局的 t 函数，支持直接调用
  const $t: (key: string, defaultValue?: string, values?: Record<string, any>) => string;
}

export {};
