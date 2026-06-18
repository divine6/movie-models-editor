import { defineStore } from "pinia";

import type { Chapter, ModelConfig } from "@/interface/project";
import { CHAPTER_TAG_COLOR, DEFAULT_CAMERA } from "@/utils/three/constants";

import piniaPersistConfig from "../helper/persist";

interface ChapterState {
  chapterIdCounter: number;
}

export const useChapterStore = defineStore("chapter", {
  state: (): ChapterState => ({
    chapterIdCounter: 0
  }),

  actions: {
    /** 创建节点（支持指定父节点 parentId） */
    createChapter(projectId: string, name: string, startTime: number, endTime: number, parentId?: string): Chapter {
      const id = `ch_${++this.chapterIdCounter}`;
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        name,
        subtitle: "",
        startTime,
        endTime,
        color: CHAPTER_TAG_COLOR,
        camera: {
          position: [...DEFAULT_CAMERA.position],
          target: [...DEFAULT_CAMERA.target],
          fov: DEFAULT_CAMERA.fov,
          transitionSec: DEFAULT_CAMERA.transitionSec
        },
        modelConfigs: {},
        parentId,
        createdAt: now,
        updatedAt: now
      };
    },

    /** 更新节点 */
    updateChapter(chapter: Chapter, updates: Partial<Chapter>) {
      Object.assign(chapter, updates, { updatedAt: new Date().toISOString() });
    },

    /** 设置节点相机配置 */
    setChapterCamera(chapter: Chapter, position: [number, number, number], target: [number, number, number], fov: number) {
      chapter.camera = {
        position,
        target,
        fov,
        transitionSec: chapter.camera.transitionSec ?? DEFAULT_CAMERA.transitionSec
      };
      chapter.updatedAt = new Date().toISOString();
    },

    /** 设置节点模型配置 */
    setChapterModelConfig(chapter: Chapter, modelId: string, config: ModelConfig) {
      chapter.modelConfigs[modelId] = config;
      chapter.updatedAt = new Date().toISOString();
    },

    /** 删除节点模型配置 */
    deleteChapterModelConfig(chapter: Chapter, modelId: string) {
      delete chapter.modelConfigs[modelId];
      chapter.updatedAt = new Date().toISOString();
    }
  },

  persist: piniaPersistConfig("movie-model-editor-chapter", ["chapterIdCounter"])
});
