/**
 * Three.js 相关常量配置
 */

import type { PrimitiveTypeConfig } from "@/interface/project";

/** 节点标签统一颜色（与主题主色一致） */
export const CHAPTER_TAG_COLOR = "#2426c0";

/** Primitive 模型类型配置（内置几何体已移除，仅保留类型供历史数据兼容） */
export const PRIMITIVE_TYPES: PrimitiveTypeConfig[] = [];

/** 模型默认根节点位置（Y 由加载时贴地计算） */
export const DEFAULT_MODEL_BASE_POSITION = [0, 0, 0] as [number, number, number];

/** 默认相机配置 */
export const DEFAULT_CAMERA = {
  position: [4.199, 2.414, -2.519] as [number, number, number],
  target: [0.014, 1.202, 0] as [number, number, number],
  fov: 45,
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

/** 快速连点节点时合并运镜/重逻辑的防抖间隔（毫秒） */
export const CHAPTER_NAV_DEBOUNCE_MS = 80;

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

/** 雾效默认距离（加载模型后会按场景范围动态调整） */
export const SCENE_FOG_NEAR = 10;
export const SCENE_FOG_FAR = 28;

/** 最远轨道距离时，模型至少保留的可见度（0–1，越大越清晰） */
export const SCENE_FOG_MIN_VISIBILITY_AT_MAX_ORBIT = 0.35;

/** 色调映射曝光（Ferrari 示例 0.85） */
export const SCENE_TONE_MAPPING_EXPOSURE = 0.85;
