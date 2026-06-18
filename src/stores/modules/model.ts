import { defineStore } from "pinia";

import type { Model, ModelType } from "@/interface/project";
import { PRIMITIVE_TYPES } from "@/utils/three/constants";

import piniaPersistConfig from "../helper/persist";

interface ModelState {
  modelIdCounter: number;
}

export const useModelStore = defineStore("model", {
  state: (): ModelState => ({
    modelIdCounter: 0
  }),

  getters: {
    primitiveTypes: () => PRIMITIVE_TYPES,
    /** 获取 Primitive 类型的默认颜色 */
    getDefaultColor: () => (type: ModelType) => {
      const config = PRIMITIVE_TYPES.find(p => p.type === type);
      return config?.defaultColor || "#5b8def";
    }
  },

  actions: {
    /** 创建 Primitive 模型 */
    createPrimitiveModel(projectId: string, type: ModelType, name?: string): Model {
      const id = `model_${++this.modelIdCounter}`;
      const config = PRIMITIVE_TYPES.find(p => p.type === type);
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        name: name || config?.name || type,
        type,
        color: config?.defaultColor || "#5b8def",
        groundY: 0,
        basePosition: [0, 0.5, 0],
        createdAt: now,
        updatedAt: now
      };
    },

    /** 创建自定义模型（GLB） */
    createCustomModel(projectId: string, name: string, url: string, file?: File, glbData?: ArrayBuffer): Model {
      const id = `model_${++this.modelIdCounter}`;
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        name,
        type: "custom",
        color: "#5b8def",
        url,
        file,
        glbData,
        groundY: 0,
        basePosition: [0, 0.5, 0],
        createdAt: now,
        updatedAt: now
      };
    },

    /** 更新模型 */
    updateModel(model: Model, updates: Partial<Model>) {
      Object.assign(model, updates, { updatedAt: new Date().toISOString() });
    },

    /** 设置模型基础位置 */
    setModelBasePosition(model: Model, position: [number, number, number]) {
      model.basePosition = position;
      model.updatedAt = new Date().toISOString();
    },

    /** 设置模型地面位置 */
    setModelGroundY(model: Model, groundY: number) {
      model.groundY = groundY;
      model.updatedAt = new Date().toISOString();
    }
  },

  persist: piniaPersistConfig("movie-model-editor-model", ["modelIdCounter"])
});
