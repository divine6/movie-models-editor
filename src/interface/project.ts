/**
 * 项目接口定义
 */

/** 项目 */
export interface Project {
  id: string;
  title: string;
  videoSrc: string | null; // Blob URL 或远程 URL
  videoDuration: number;
  videoWidth: number;
  videoHeight: number;
  createdAt: string;
  updatedAt: string;
}

/** 项目详情（含节点、模型、字幕） */
export interface ProjectDetail extends Project {
  chapters: Chapter[];
  models: Model[];
  subtitles: Subtitle[];
}

/** 节点 */
export interface Chapter {
  id: string;
  projectId: string;
  name: string;
  subtitle: string;
  startTime: number;
  endTime: number;
  color: string;
  camera: CameraConfig;
  modelConfigs: Record<string, ModelConfig>;
  /** 父节点ID，用于构建树状结构 */
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

/** 相机配置 */
export interface CameraConfig {
  position: [number, number, number]; // XYZ
  target: [number, number, number]; // Look-at XYZ
  fov: number; // Field of view (20-120)
  /** 切换到该节点镜头时的运镜时长（秒） */
  transitionSec?: number;
}

/** 动画时间段 */
export interface AnimSegment {
  id: string;
  startTime: number; // 开始时间（秒）
  endTime: number; // 结束时间（秒）
  startPos: [number, number, number];
  endPos: [number, number, number];
  startScale: number;
  endScale: number;
  startRot: [number, number, number];
  endRot: [number, number, number];
}

/** 动画配置 */
export interface AnimationConfig {
  duration: number; // 总时长（秒）
  segments: AnimSegment[];
}

/** 模型配置（节点级别） */
export interface ModelConfig {
  visible: boolean;
  posOffset: [number, number, number];
  scale: number;
  highlight: boolean;
  highlightColor: string; // 边框高亮颜色
  outline: boolean; // 显示轮廓边线
  animation: boolean;
  intro?: string; // 节点内模型介绍文案
  animConfig?: AnimationConfig;
  /** GLB 子层级独立配置，key 为 hierarchy nodeId */
  nodeConfigs?: Record<string, ModelConfig>;
}

/** 3D 模型 */
export interface Model {
  id: string;
  projectId: string;
  name: string;
  type: ModelType;
  color: string;
  url?: string; // GLB Blob URL
  sourcePath?: string; // 后端模型相对路径，用于保存场景后复原
  file?: File; // 原始文件引用（本地上传时）
  glbData?: ArrayBuffer; // 原始 GLB 数据（用于导出）
  groundY: number; // 自动计算的地面位置
  basePosition: [number, number, number];
  createdAt: string;
  updatedAt: string;
}

/** 模型类型 */
export type ModelType = "cube" | "sphere" | "cylinder" | "torus" | "cone" | "dodecahedron" | "custom";

/** GLB 模型内部层级节点（导入后从场景图解析） */
export interface ModelHierarchyNode {
  id: string;
  modelId: string;
  name: string;
  path: string;
  objectType: "group" | "mesh" | "bone" | "other";
  children: ModelHierarchyNode[];
  /** 同几何体、多材质拆分的 Mesh 合并展示时，包含的全部 nodeId */
  mergedNodeIds?: string[];
  /** 原为 Group，子级均为同几何体 Mesh；展示为 Mesh，变换作用在 Group 上 */
  materialGroupHost?: boolean;
  /** 仅 mesh：用于识别同源几何体 */
  geometryKey?: string;
}

/** 字幕 */
export interface Subtitle {
  id: string;
  projectId: string;
  startTime: number;
  endTime: number;
  text: string;
  color: string;
  backgroundColor?: string;
  displayMode: SubtitleDisplayMode;
  createdAt: string;
  updatedAt: string;
}

/** 字幕显示模式 */
export type SubtitleDisplayMode = "fadeIn" | "typewriter";

/** 字幕文本最大长度 */
export const SUBTITLE_TEXT_MAX_LENGTH = 100;

/** 字幕默认背景色 */
export const SUBTITLE_DEFAULT_BACKGROUND = "transparent";

/** Primitive 模型类型配置 */
export interface PrimitiveTypeConfig {
  type: ModelType;
  name: string;
  defaultColor: string;
}

/** 项目创建参数 */
export interface CreateProjectParams {
  title: string;
  videoSrc?: string;
  videoFile?: File;
}

/** 节点创建参数 */
export interface CreateChapterParams {
  projectId: string;
  name: string;
  startTime: number;
  endTime: number;
  color?: string;
}

/** 模型创建参数 */
export interface CreateModelParams {
  projectId: string;
  name: string;
  type: ModelType;
  color?: string;
  file?: File;
}
