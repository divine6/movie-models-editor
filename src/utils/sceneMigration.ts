import type { Chapter, ProjectDetail, SceneAnimationNode, SceneNode, SceneVideoNode, Subtitle } from "@/interface/project";
import { CHAPTER_TAG_COLOR, DEFAULT_CAMERA } from "@/utils/three/constants";

import { getAnimationNodes, getVideoNodes } from "./sceneNodeTree";

const SCHEMA_VERSION = 2;

function legacyChapterToAnimation(ch: Chapter, videoId: string, sortOrder: number): SceneAnimationNode {
  return {
    id: ch.id,
    projectId: ch.projectId,
    name: ch.name,
    type: "animation",
    parentId: videoId,
    sortOrder,
    subtitle: ch.subtitle || "",
    startTime: ch.startTime,
    endTime: ch.endTime,
    color: ch.color || CHAPTER_TAG_COLOR,
    camera: ch.camera || {
      position: [...DEFAULT_CAMERA.position],
      target: [...DEFAULT_CAMERA.target],
      fov: DEFAULT_CAMERA.fov,
      transitionSec: DEFAULT_CAMERA.transitionSec
    },
    modelConfigs: ch.modelConfigs || {},
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt
  };
}

/**
 * 将 v1（chapters + 项目级 videoSrc）迁移为 v2 nodes。
 * 旧结构：单视频 + 根/子 chapter 均为动画时间段。
 */
export function migrateProjectToSceneNodesV2(project: ProjectDetail): ProjectDetail {
  if (project.schemaVersion === SCHEMA_VERSION && Array.isArray(project.nodes) && project.nodes.length > 0) {
    return project;
  }

  const now = new Date().toISOString();
  const nodes: SceneNode[] = [];
  const legacyChapters = project.chapters || [];
  const videoId = `vid_migrated_${project.id}`;

  const defaultVideo: SceneVideoNode = {
    id: videoId,
    projectId: project.id,
    name: "默认视频",
    type: "video",
    sortOrder: 0,
    videoSrc: project.videoSrc,
    videoDuration: project.videoDuration || 0,
    videoWidth: project.videoWidth || 0,
    videoHeight: project.videoHeight || 0,
    videoDisplayWidth: project.videoDisplayWidth || 0,
    createdAt: now,
    updatedAt: now
  };
  nodes.push(defaultVideo);

  const rootChapters = legacyChapters.filter(ch => !ch.parentId).sort((a, b) => a.startTime - b.startTime);
  const childChapters = legacyChapters.filter(ch => !!ch.parentId);

  let sortOrder = 0;
  for (const ch of rootChapters) {
    nodes.push(legacyChapterToAnimation(ch, videoId, sortOrder++));
  }
  for (const ch of childChapters) {
    nodes.push(legacyChapterToAnimation(ch, videoId, sortOrder++));
  }

  const subtitles: Subtitle[] = (project.subtitles || []).map(sub => ({
    ...sub,
    parentNodeId: sub.parentNodeId || videoId
  }));

  return {
    ...project,
    schemaVersion: SCHEMA_VERSION,
    nodes,
    subtitles,
    chapters: undefined
  };
}

export function ensureProjectNodes(project: ProjectDetail | null): ProjectDetail | null {
  if (!project) return null;
  if (project.schemaVersion === SCHEMA_VERSION && Array.isArray(project.nodes)) {
    return project;
  }
  if (Array.isArray(project.chapters) && project.chapters.length > 0) {
    return migrateProjectToSceneNodesV2(project);
  }
  if (!project.nodes) {
    project.nodes = [];
    project.schemaVersion = SCHEMA_VERSION;
  }
  return project;
}

export function scenePayloadFromProject(project: ProjectDetail) {
  const migrated = ensureProjectNodes(project)!;
  return {
    schemaVersion: SCHEMA_VERSION,
    nodes: migrated.nodes,
    subtitles: migrated.subtitles,
    models: project.models,
    sceneSettings: undefined as unknown
  };
}

export function hasPlayableVideo(nodes: SceneNode[]): boolean {
  return getVideoNodes(nodes).some(v => !!v.videoSrc && v.videoDuration > 0);
}

export function getDefaultVideoNode(nodes: SceneNode[]): SceneVideoNode | null {
  const videos = getVideoNodes(nodes);
  return videos.find(v => !!v.videoSrc) ?? videos[0] ?? null;
}

export function getFirstAnimation(nodes: SceneNode[], videoId?: string): SceneAnimationNode | null {
  const animations = videoId ? getAnimationNodes(nodes).filter(a => a.parentId === videoId) : getAnimationNodes(nodes);
  return animations.sort((a, b) => a.startTime - b.startTime)[0] ?? null;
}

export { SCHEMA_VERSION };
