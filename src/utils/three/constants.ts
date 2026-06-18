/**
 * Three.js 相关常量配置
 */

import type { PrimitiveTypeConfig } from "@/interface/project";

/** 节点标签统一颜色（与主题主色一致） */
export const CHAPTER_TAG_COLOR = "#2426c0";

/** Primitive 模型类型配置（内置几何体已移除，仅保留类型供历史数据兼容） */
export const PRIMITIVE_TYPES: PrimitiveTypeConfig[] = [];

/** 默认相机配置 */
export const DEFAULT_CAMERA = {
  position: [6, 4, 8] as [number, number, number],
  target: [0, 0.5, 0] as [number, number, number],
  fov: 50,
  transitionSec: 0.5
};

/** 节点自动检测参数 */
export const CHAPTER_DETECTION = {
  ANALYSIS_INTERVAL: 0.4, // 帧采样间隔（秒）
  SCENE_CHANGE_THRESHOLD: 0.25, // 场景变化阈值
  MIN_CHAPTER_DURATION: 2.0 // 最小节点长度（秒）
};

/** 手动拆分节点时的默认间隔（秒） */
export const CHAPTER_SPLIT_INTERVAL = 10;

/** 动画参数 */
export const ANIMATION = {
  CAMERA_TRANSITION_DURATION: 1000, // 相机过渡时长（ms）
  SUBTITLE_TYPewriter_SPEED: 80 // 打字机速度（ms/字符）
};

/** 节点切换镜头运镜时长（秒） */
export const CHAPTER_CAMERA_TRANSITION_SEC = 0.5;

/** 选中模型后镜头聚焦运镜时长（秒） */
export const MODEL_CAMERA_FOCUS_SEC = 0.6;

/** 动画旋转中心指示球半径 */
export const PIVOT_HELPER_RADIUS = 0.008;

/** 视口默认背景色（three.js car materials 风格） */
export const SCENE_VIEWPORT_BG = "#333333";

/** 视口网格线颜色（柔和深灰，在 #333 背景上清晰可见、不偏白） */
export const SCENE_GRID_COLOR_CENTER = 0x4a4a4a;
export const SCENE_GRID_COLOR = 0x5c5c5c;

/** 默认网格尺寸与细分（Ferrari 示例 20 / 40） */
export const SCENE_GRID_SIZE = 20;
export const SCENE_GRID_DIVISIONS = 40;

/** 雾效距离（Ferrari 示例：near 10, far 15） */
export const SCENE_FOG_NEAR = 10;
export const SCENE_FOG_FAR = 15;

/** 色调映射曝光（Ferrari 示例 0.85） */
export const SCENE_TONE_MAPPING_EXPOSURE = 0.85;
