import { defineStore } from "pinia";

import type { Model, Project, ProjectDetail } from "@/interface/project";

import piniaPersistConfig from "../helper/persist";
import { getSuspendedPersistSnapshot, isProjectPersistSuspended } from "@/utils/projectPersist";

function sanitizeModelForPersist(model: Model): Model {
  const { file: _file, glbData: _glbData, url, ...rest } = model;
  return {
    ...rest,
    url: url && !url.startsWith("blob:") ? url : undefined
  };
}

function sanitizeProjectDetail(project: ProjectDetail | null): ProjectDetail | null {
  if (!project) return null;
  return {
    ...project,
    models: project.models.map(sanitizeModelForPersist)
  };
}

function sanitizeProjectState(state: {
  currentProject: ProjectDetail | null;
  projects: Project[];
  projectIdCounter: number;
}) {
  return {
    ...state,
    currentProject: sanitizeProjectDetail(state.currentProject)
  };
}

interface ProjectState {
  currentProject: ProjectDetail | null;
  projects: Project[];
  projectIdCounter: number;
}

export const useProjectStore = defineStore("project", {
  state: (): ProjectState => ({
    currentProject: null,
    projects: [],
    projectIdCounter: 0
  }),

  getters: {
    hasCurrentProject: state => state.currentProject !== null,
    projectList: state => state.projects
  },

  actions: {
    /** 创建新项目 */
    createProject(title: string, videoSrc?: string): ProjectDetail {
      const id = `project_${++this.projectIdCounter}`;
      const now = new Date().toISOString();
      const project: ProjectDetail = {
        id,
        title,
        videoSrc: videoSrc || null,
        videoDuration: 0,
        videoWidth: 0,
        videoHeight: 0,
        createdAt: now,
        updatedAt: now,
        chapters: [],
        models: [],
        subtitles: []
      };
      this.projects.push(project);
      this.currentProject = project;
      return project;
    },

    /** 设置当前项目 */
    setCurrentProject(project: ProjectDetail | null) {
      this.currentProject = project;
    },

    /** 更新项目信息 */
    updateProject(updates: Partial<Project>) {
      if (this.currentProject) {
        Object.assign(this.currentProject, updates, { updatedAt: new Date().toISOString() });
      }
    },

    /** 更新视频信息 */
    setVideoInfo(videoSrc: string, duration: number, width: number, height: number) {
      if (this.currentProject) {
        this.currentProject.videoSrc = videoSrc;
        this.currentProject.videoDuration = duration;
        this.currentProject.videoWidth = width;
        this.currentProject.videoHeight = height;
        this.currentProject.updatedAt = new Date().toISOString();
      }
    },

    /** 删除项目 */
    deleteProject(projectId: string) {
      const index = this.projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        this.projects.splice(index, 1);
        if (this.currentProject?.id === projectId) {
          this.currentProject = null;
        }
      }
    },

    /** 清空当前项目 */
    clearCurrentProject() {
      this.currentProject = null;
    },

    /** 清除无效的视频数据（刷新页面后 blob URL 失效） */
    clearInvalidVideoData() {
      if (this.currentProject?.videoSrc) {
        // blob URL 和 data URL 刷新后仍然有效，但 blob URL 需要检查
        const src = this.currentProject.videoSrc;
        // 如果是 blob URL，刷新后一定失效
        if (src.startsWith("blob:")) {
          this.currentProject.videoSrc = null;
          this.currentProject.videoDuration = 0;
          this.currentProject.videoWidth = 0;
          this.currentProject.videoHeight = 0;
          // 同时清除相关数据
          this.currentProject.chapters = [];
          this.currentProject.models = [];
          this.currentProject.subtitles = [];
        }
        // http/https URL 可能仍然有效，但需要验证
        // 这里暂时保留，让组件层面去验证
      }
    }
  },

  persist: {
    ...piniaPersistConfig("movie-model-editor-project", ["currentProject", "projects", "projectIdCounter"]),
    serializer: {
      serialize: value => {
        if (isProjectPersistSuspended()) return getSuspendedPersistSnapshot();
        return JSON.stringify(sanitizeProjectState(value as Parameters<typeof sanitizeProjectState>[0]));
      },
      deserialize: value => JSON.parse(value)
    }
  }
});
