/**
 * 项目接口定义
 */

/** 项目 */
export interface Project {
  id: string;
  title: string;
  /** @deprecated v2 起视频挂在 video 节点上 */
  videoSrc: string | null;
  /** @deprecated */
  videoDuration: number;
  /** @deprecated */
  videoWidth: number;
  /** @deprecated */
  videoHeight: number;
  /** @deprecated */
  videoDisplayWidth: number;
  createdAt: string;
  updatedAt: string;
}

/** 场景节点类型 */
export type SceneNodeType = "group" | "video" | "animation";

export interface SceneNodeBase {
  id: string;
  projectId: string;
  name: string;
  type: SceneNodeType;
  parentId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 分组节点 */
export interface SceneGroupNode extends SceneNodeBase {
  type: "group";
}

/** 视频节点 */
export interface SceneVideoNode extends SceneNodeBase {
  type: "video";
  videoSrc: string | null;
  videoPath?: string;
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  videoDisplayWidth: number;
  videoDisplayWidthRatio?: number;
  videoDisplayLeft?: number;
  videoDisplayTop?: number;
  videoDisplayXRatio?: number;
  videoDisplayYRatio?: number;
  /** 落盘时的视口宽高，用于编辑↔预览像素换算 */
  videoDisplayViewportWidth?: number;
  videoDisplayViewportHeight?: number;
}

/** 视频节点动画（原 Chapter） */
export interface SceneAnimationNode extends SceneNodeBase {
  type: "animation";
  subtitle: string;
  startTime: number;
  endTime: number;
  color: string;
  camera: CameraConfig;
  modelConfigs: Record<string, ModelConfig>;
}

export type SceneNode = SceneGroupNode | SceneVideoNode | SceneAnimationNode;

/** @deprecated 使用 SceneAnimationNode */
export type Chapter = SceneAnimationNode;

/** 项目详情（含节点、模型、字幕） */
export interface ProjectDetail extends Project {
  schemaVersion?: number;
  nodes: SceneNode[];
  /** @deprecated v1 兼容，加载后自动迁移为 nodes */
  chapters?: Chapter[];
  models: Model[];
  subtitles: Subtitle[];
}

/** 相机配置 */
export interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  transitionSec?: number;
}

/** 动画时间段 */
export interface AnimSegment {
  id: string;
  startTime: number;
  endTime: number;
  startPos: [number, number, number];
  endPos: [number, number, number];
  startScale: number;
  endScale: number;
  startRot: [number, number, number];
  endRot: [number, number, number];
}

/** 动画配置 */
export interface AnimationConfig {
  duration: number;
  segments: AnimSegment[];
}

/** 模型配置（节点级别） */
export interface ModelConfig {
  visible: boolean;
  posOffset: [number, number, number];
  scale: number;
  wireframe?: boolean;
  highlight: boolean;
  /** @deprecated 请使用 outlineColor / modelHighlightColor */
  highlightColor?: string;
  outlineColor?: string;
  wireframeColor?: string;
  modelHighlightColor?: string;
  outline: boolean;
  animation: boolean;
  intro?: string;
  animConfig?: AnimationConfig;
  nodeConfigs?: Record<string, ModelConfig>;
}

/** 3D 模型 */
export interface Model {
  id: string;
  projectId: string;
  name: string;
  type: ModelType;
  color: string;
  url?: string;
  sourcePath?: string;
  file?: File;
  glbData?: ArrayBuffer;
  groundY: number;
  basePosition: [number, number, number];
  createdAt: string;
  updatedAt: string;
}

export type ModelType = "cube" | "sphere" | "cylinder" | "torus" | "cone" | "dodecahedron" | "custom";

export interface ModelHierarchyNode {
  id: string;
  modelId: string;
  name: string;
  path: string;
  objectType: "group" | "mesh" | "bone" | "other";
  children: ModelHierarchyNode[];
  mergedNodeIds?: string[];
  materialGroupHost?: boolean;
  geometryKey?: string;
  localPosKey?: string;
}

/** 字幕 — 绑定在视频或动画节点下 */
export interface Subtitle {
  id: string;
  projectId: string;
  /** 所属视频节点或动画节点 ID */
  parentNodeId: string;
  startTime: number;
  endTime: number;
  text: string;
  color: string;
  backgroundColor?: string;
  displayMode: SubtitleDisplayMode;
  createdAt: string;
  updatedAt: string;
}

export type SubtitleDisplayMode = "fadeIn" | "typewriter";

export const SUBTITLE_TEXT_MAX_LENGTH = 100;
export const SUBTITLE_DEFAULT_BACKGROUND = "transparent";

export interface PrimitiveTypeConfig {
  type: ModelType;
  name: string;
  defaultColor: string;
}

export interface CreateProjectParams {
  title: string;
  videoSrc?: string;
  videoFile?: File;
}

export interface CreateChapterParams {
  projectId: string;
  name: string;
  startTime: number;
  endTime: number;
  color?: string;
}

export interface CreateModelParams {
  projectId: string;
  name: string;
  type: ModelType;
  color?: string;
  file?: File;
}
