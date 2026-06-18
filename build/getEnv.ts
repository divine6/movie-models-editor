import path from "path";

export function isDevFn(mode: string): boolean {
  return mode === "development";
}

export function isProdFn(mode: string): boolean {
  return mode === "production";
}

export function isTestFn(mode: string): boolean {
  return mode === "test";
}
// 是否生成包报告
export function isReportMode(): boolean {
  return process.env.VITE_REPORT === "true";
}

// 包装环境变量，将环境变量转换为对象
export function wrapperEnv(envConf: Recordable): ViteEnv {
  const ret: any = {};

  for (const envName of Object.keys(envConf)) {
    let realName = envConf[envName].replace(/\\n/g, "\n");
    realName = realName === "true" ? true : realName === "false" ? false : realName;
    if (envName === "VITE_PORT") realName = Number(realName);
    if (envName === "VITE_PROXY") {
      try {
        realName = JSON.parse(realName);
      } catch (error) {}
    }
    ret[envName] = realName;
  }
  return ret;
}

// 获取用户根目录
export function getRootPath(...dir: string[]) {
  return path.resolve(process.cwd(), ...dir);
}
