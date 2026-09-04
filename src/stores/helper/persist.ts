import { PersistedStateOptions } from "pinia-plugin-persistedstate";

interface PersistConfigOptions {
  defer?: boolean;
  deferTimeout?: number;
}

function createDeferredStorage(storageKey: string, timeout: number): Pick<Storage, "getItem" | "setItem"> {
  let pendingValue: string | null = null;
  let lastWrittenValue: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingValue === null || pendingValue === lastWrittenValue) return;
    const value = pendingValue;
    localStorage.setItem(storageKey, value);
    lastWrittenValue = value;
  };

  const scheduleFlush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, timeout);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
  }

  return {
    getItem(key) {
      if (key === storageKey && pendingValue !== null) return pendingValue;
      const value = localStorage.getItem(key);
      if (key === storageKey) lastWrittenValue = value;
      return value;
    },
    setItem(key, value) {
      if (key !== storageKey) {
        localStorage.setItem(key, value);
        return;
      }
      if (value === pendingValue || (pendingValue === null && value === lastWrittenValue)) return;
      pendingValue = value;
      scheduleFlush();
    }
  };
}

/**
 * @description pinia 持久化参数配置
 * @param {String} key 存储到持久化的 name
 * @param {Array} paths 需要持久化的 state name
 * @param {PersistConfigOptions} options 可选的延迟写入配置
 * @return persist
 * */
const piniaPersistConfig = (key: string, paths?: string[], options: PersistConfigOptions = {}) => {
  const defaultSerializer = {
    key,
    storage: options.defer ? createDeferredStorage(key, options.deferTimeout ?? 250) : localStorage,
    paths
  };

  const persist: PersistedStateOptions = defaultSerializer;

  return persist;
};

export default piniaPersistConfig;
