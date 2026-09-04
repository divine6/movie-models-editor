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

/** 动画片段内某个模型/子节点的动作（相对该片段时间窗） */
export interface AnimationClipTarget {
  modelId: string;
  nodeId?: string | null;
  easing?: string;
  pivot?: string;
  /**
   * 姿态：相对本片段起点的间隔（秒），与片段窗长无关。
   * 缺省 0。
   */
  pauseTime?: number;
  /**
   * 姿态：起始→结束插值时长（秒），与片段窗长无关；可为 0（瞬移）。
   * 缺省 0.5。播放时落在片段时间窗内，超出窗长则截断到片段结束。
   */
  animTime?: number;
  clipVisual?: AnimSegment["clipVisual"];
  startPos: [number, number, number];
  endPos: [number, number, number];
  startScale: number;
  endScale: number;
  startRot: [number, number, number];
  endRot: [number, number, number];
}

/**
 * 动画时间片段（时间轨）：用户创建的时间段。
 * 片段下可配置运镜，以及该时段内任意模型的动画内容。
 */
export interface AnimationClip {
  id: string;
  name: string;
  /** 相对动画起点的绝对开始（秒） */
  start: number;
  /** 相对动画起点的绝对结束（秒） */
  end: number;
  /**
   * 相对上一段结束后的间隔（秒），默认 0。
   * 与 animTime 一起驱动片段窗：start = prevEnd + pauseTime，end = start + animTime。
   * 注意：这是片段占用时间轴的长度，与目标姿态的「间隔/起始→结束」独立。
   */
  pauseTime?: number;
  /**
   * 本片段在时间轴上的时长（秒），默认 0.5。
   * 播放时必须播完本窗长才进入下一片段；与姿态插值时长独立。
   */
  animTime?: number;
  /** 本片段运镜；缺省则用动画节点默认 camera */
  camera?: CameraConfig;
  targets: AnimationClipTarget[];
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
  /**
   * 动画时间片段列表（编辑主数据）。
   * 保存时会投影到 modelConfigs.*.animConfig，以复用既有播放逻辑。
   */
  clips?: AnimationClip[];
  /** 该动画下视频框显示宽度（px）；未设置则用默认大小 */
  videoDisplayWidth?: number;
  videoDisplayWidthRatio?: number;
  videoDisplayLeft?: number;
  videoDisplayTop?: number;
  videoDisplayXRatio?: number;
  videoDisplayYRatio?: number;
  /** 落盘时的视口宽高，用于编辑↔预览像素换算 */
  videoDisplayViewportWidth?: number;
  videoDisplayViewportHeight?: number;
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

/** 动画时间段（存盘为 pause+anim 链；编辑态可带绝对 start/end） */
export interface AnimSegment {
  id: string;
  /** 相对上一段结束的待机（秒） */
  pauseTime?: number;
  /** 本段变换插值时长（秒） */
  animTime?: number;
  easing?: string;
  pivot?: string;
  /** @deprecated 旧字段；新数据用 pauseTime/animTime */
  startTime?: number;
  /** @deprecated 旧字段；新数据用 pauseTime/animTime */
  endTime?: number;
  /** 编辑态：相对动画起点的绝对开始（不落盘） */
  start?: number;
  /** 编辑态：相对动画起点的绝对结束（不落盘） */
  end?: number;
  /** 片段时间窗内的外观（显隐/高亮/线框/介绍） */
  clipVisual?: {
    visible: boolean;
    outline: boolean;
    wireframe: boolean;
    highlight: boolean;
    outlineColor: string;
    wireframeColor: string;
    modelHighlightColor: string;
    intro: string;
  };
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
  easing?: string;
  relativeTransform?: boolean;
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
