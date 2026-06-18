import { StateTree } from "pinia";
import { PersistedStateOptions } from "pinia-plugin-persistedstate";

/**
 * @description pinia 持久化参数配置
 * @param {String} key 存储到持久化的 name
 * @param {Array} paths 需要持久化的 state name
 * @return persist
 * */
const piniaPersistConfig = (key: string, paths?: string[]) => {
  const defaultSerializer = {
    key,
    storage: localStorage,
    paths
  };

  const persist: PersistedStateOptions = defaultSerializer;

  return persist;
};

export default piniaPersistConfig;
