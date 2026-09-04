import { defineStore } from "pinia";

import type { Model, Project, ProjectDetail, SceneNode } from "@/interface/project";
import { getSuspendedPersistSnapshot, isProjectPersistSuspended } from "@/utils/projectPersist";

import piniaPersistConfig from "../helper/persist";

function sanitizeModelForPersist(model: Model): Model {
  const { file: _file, glbData: _glbData, url, ...rest } = model;
  return {
    ...rest,
    url: url && !url.startsWith("blob:") ? url : undefined
  };
}

function sanitizeNodeForPersist(node: SceneNode): SceneNode {
  if (node.type !== "video" || !node.videoSrc?.startsWith("blob:")) return node;
  return {
    ...node,
    videoSrc: null
  };
}

function sanitizeProjectDetail(project: ProjectDetail | null): ProjectDetail | null {
  if (!project) return null;
  return {
    ...project,
    nodes: (project.nodes || []).map(sanitizeNodeForPersist),
    models: (project.models || []).map(sanitizeModelForPersist)
  };
}

interface PersistedProjectState {
  currentProject?: ProjectDetail | null;
  currentProjectId?: string | null;
  projects?: Project[];
  projectIdCounter?: number;
}

function sanitizeProjectList(projects: Project[], currentProject: ProjectDetail | null): Project[] {
  const deduplicated = new Map<string, Project>();
  for (const project of projects) {
    const detail = project as ProjectDetail;
    deduplicated.set(project.id, Array.isArray(detail.models) ? sanitizeProjectDetail(detail)! : project);
  }
  if (currentProject) deduplicated.set(currentProject.id, sanitizeProjectDetail(currentProject)!);
  return [...deduplicated.values()];
}

function sanitizeProjectState(state: ProjectState) {
  const currentProject = sanitizeProjectDetail(state.currentProject);
  return {
    currentProjectId: currentProject?.id ?? null,
    projects: sanitizeProjectList(state.projects, currentProject),
    projectIdCounter: state.projectIdCounter
  };
}

function deserializeProjectState(value: string): ProjectState {
  const persisted = JSON.parse(value) as PersistedProjectState;
  const legacyCurrentProject = sanitizeProjectDetail(persisted.currentProject ?? null);
  const projects = sanitizeProjectList(persisted.projects ?? [], legacyCurrentProject);
  const currentProjectId = persisted.currentProjectId ?? legacyCurrentProject?.id ?? null;
  const currentProject = currentProjectId
    ? ((projects.find(project => project.id === currentProjectId) as ProjectDetail | undefined) ?? legacyCurrentProject)
    : null;
  return {
    currentProject,
    projects,
    projectIdCounter: persisted.projectIdCounter ?? 0
  };
}

interface ProjectState {
  currentProject: ProjectDetail | null;
  projects: Project[];
  projectIdCounter: number;
}

let lastProjectPersistSnapshot: string | null = null;
let lastProjectSerializeAt = 0;
let queuedProjectPersistState: ProjectState | null = null;
let projectSerializeTimer: ReturnType<typeof setTimeout> | null = null;
const PROJECT_SERIALIZE_MIN_MS = 2500;

function stringifyProjectState(state: ProjectState) {
  lastProjectPersistSnapshot = JSON.stringify(sanitizeProjectState(state));
  lastProjectSerializeAt = Date.now();
  return lastProjectPersistSnapshot;
}

function flushQueuedProjectPersist() {
  if (projectSerializeTimer) {
    clearTimeout(projectSerializeTimer);
    projectSerializeTimer = null;
  }
  if (!queuedProjectPersistState || isProjectPersistSuspended()) return;
  const snap = stringifyProjectState(queuedProjectPersistState);
  queuedProjectPersistState = null;
  try {
    localStorage.setItem("movie-model-editor-project", snap);
  } catch {
    /* quota / private mode */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushQueuedProjectPersist);
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
    /** 打开已有项目，或按指定 id 创建新项目 */
    ensureProject(id: string, title: string, videoSrc?: string): ProjectDetail {
      const existing = this.projects.find(p => p.id === id);
      if (existing) {
        this.currentProject = existing as ProjectDetail;
        return existing as ProjectDetail;
      }
      const now = new Date().toISOString();
      const project: ProjectDetail = {
        id,
        title,
        videoSrc: videoSrc || null,
        videoDuration: 0,
        videoWidth: 0,
        videoHeight: 0,
        videoDisplayWidth: 0,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 2,
        nodes: [],
        models: [],
        subtitles: []
      };
      this.projects.push(project);
      this.currentProject = project;
      return project;
    },

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
        videoDisplayWidth: 0,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 2,
        nodes: [],
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
      if (!this.currentProject?.videoSrc?.startsWith("blob:")) return;
      // v2 的视频、模型和字幕均由场景节点持有；废弃的项目级 blob 失效时只清理兼容字段。
      this.currentProject.videoSrc = null;
      this.currentProject.videoDuration = 0;
      this.currentProject.videoWidth = 0;
      this.currentProject.videoHeight = 0;
      this.currentProject.videoDisplayWidth = 0;
    }
  },

  persist: {
    ...piniaPersistConfig("movie-model-editor-project", ["currentProject", "projects", "projectIdCounter"], {
      defer: true
    }),
    serializer: {
      serialize: value => {
        if (isProjectPersistSuspended()) {
          return lastProjectPersistSnapshot ?? getSuspendedPersistSnapshot();
        }
        const state = value as ProjectState;
        const now = Date.now();
        // 选中含大量 clips 的动画后，任何字段写入都会 JSON.stringify 整项目；
        // 转镜头每帧写 camera 时会把主线程打满。限频序列化，交互才转得动。
        if (lastProjectPersistSnapshot && now - lastProjectSerializeAt < PROJECT_SERIALIZE_MIN_MS) {
          queuedProjectPersistState = state;
          if (!projectSerializeTimer) {
            const wait = PROJECT_SERIALIZE_MIN_MS - (now - lastProjectSerializeAt);
            projectSerializeTimer = setTimeout(() => {
              projectSerializeTimer = null;
              flushQueuedProjectPersist();
            }, Math.max(250, wait));
          }
          return lastProjectPersistSnapshot;
        }
        return stringifyProjectState(state);
      },
      deserialize: value => {
        lastProjectPersistSnapshot = value;
        return deserializeProjectState(value);
      }
    }
  }
});
