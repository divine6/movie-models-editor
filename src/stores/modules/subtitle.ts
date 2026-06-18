import { defineStore } from "pinia";

import { SUBTITLE_DEFAULT_BACKGROUND, type Subtitle, type SubtitleDisplayMode } from "@/interface/project";

import piniaPersistConfig from "../helper/persist";

interface SubtitleState {
  subtitleIdCounter: number;
}

export const useSubtitleStore = defineStore("subtitle", {
  state: (): SubtitleState => ({
    subtitleIdCounter: 0
  }),

  actions: {
    /** 创建字幕 */
    createSubtitle(
      projectId: string,
      text: string,
      startTime: number,
      endTime: number,
      displayMode: SubtitleDisplayMode = "fadeIn"
    ): Subtitle {
      const id = `sub_${++this.subtitleIdCounter}`;
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        startTime,
        endTime,
        text,
        color: "#ffffff",
        backgroundColor: SUBTITLE_DEFAULT_BACKGROUND,
        displayMode,
        createdAt: now,
        updatedAt: now
      };
    },

    /** 更新字幕 */
    updateSubtitle(subtitle: Subtitle, updates: Partial<Subtitle>) {
      Object.assign(subtitle, updates, { updatedAt: new Date().toISOString() });
    },

    /** 设置字幕颜色 */
    setSubtitleColor(subtitle: Subtitle, color: string) {
      subtitle.color = color;
      subtitle.updatedAt = new Date().toISOString();
    },

    /** 设置字幕显示模式 */
    setSubtitleDisplayMode(subtitle: Subtitle, displayMode: SubtitleDisplayMode) {
      subtitle.displayMode = displayMode;
      subtitle.updatedAt = new Date().toISOString();
    }
  },

  persist: piniaPersistConfig("movie-model-editor-subtitle", ["subtitleIdCounter"])
});
