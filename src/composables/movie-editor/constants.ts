import * as THREE from "three";

import { SCENE_GRID_DIVISIONS, SCENE_GRID_SIZE, SCENE_TONE_MAPPING_EXPOSURE, SCENE_VIEWPORT_BG } from "@/utils/three/constants";

/** 色调映射选项（与 Three.js renderer.toneMapping 对应） */
export const TONE_MAPPING_OPTIONS = [
  { value: "NoToneMapping", label: "None" },
  { value: "LinearToneMapping", label: "Linear" },
  { value: "ReinhardToneMapping", label: "Reinhard" },
  { value: "CineonToneMapping", label: "Cineon" },
  { value: "ACESFilmicToneMapping", label: "ACES Filmic" },
  { value: "AgXToneMapping", label: "AgX" },
  { value: "NeutralToneMapping", label: "Neutral" }
] as const;

export const TONE_MAPPING_MAP: Record<string, THREE.ToneMapping> = {
  NoToneMapping: THREE.NoToneMapping,
  LinearToneMapping: THREE.LinearToneMapping,
  ReinhardToneMapping: THREE.ReinhardToneMapping,
  CineonToneMapping: THREE.CineonToneMapping,
  ACESFilmicToneMapping: THREE.ACESFilmicToneMapping,
  AgXToneMapping: THREE.AgXToneMapping,
  NeutralToneMapping: THREE.NeutralToneMapping
};

export const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.5] as const;

export const EASING_LIST = ["linear", "easeIn", "easeOut", "easeInOut", "bounce", "elastic"] as const;

export const CURVE_LABELS: Record<string, string> = {
  linear: "线性",
  easeIn: "渐入",
  easeOut: "渐出",
  easeInOut: "渐入渐出",
  bounce: "弹跳",
  elastic: "弹性"
};

export const SCENE_SETTINGS_STORAGE_KEY = "movie-editor-scene-settings";

/** 后处理抗锯齿模式（编辑器走 EffectComposer，MSAA 对最终画面几乎无效） */
export type AntialiasingMode = "none" | "ssaa" | "smaa" | "fxaa";

/** 按模型集 code 隔离场景面板设置，避免多项目互相覆盖 */
export function getSceneSettingsStorageKey(modelSetCode?: string | null) {
  const code = modelSetCode?.trim();
  return code ? `${SCENE_SETTINGS_STORAGE_KEY}-${code}` : SCENE_SETTINGS_STORAGE_KEY;
}

export const CHAPTER_TIME_EPS = 0.05;
export const CHAPTER_END_EPS = 0.02;
export const SEEK_READY_TIMEOUT_MS = 4000;
export const SEEK_EVENT_TIMEOUT_MS = 280;
export const CHAPTER_CAMERA_SWITCH_EDIT_SEC = 0.15;
export const CHAPTER_CAMERA_SWITCH_PLAYBACK_SEC = 0.18;
export const CHAPTER_CAMERA_SWITCH_MIN_SEC = 0.1;
export const CHAPTER_CAMERA_SWITCH_MAX_SEC = 0.28;

export const TARGET_FPS_OPTIONS = [30, 45, 60] as const;
export type TargetFps = (typeof TARGET_FPS_OPTIONS)[number];

export function normalizeTargetFps(value: unknown): TargetFps {
  const n = Number(value);
  if (n === 30 || n === 45 || n === 60) return n;
  return 30;
}

export const DEFAULT_SCENE_SETTINGS = {
  ambIntensity: 0.35,
  dirIntensity: 0.65,
  fillIntensity: 0.2,
  matColor: "#ffffff",
  matRoughness: 0.5,
  matMetalness: 0,
  matNormalStr: 1,
  matEmissiveInt: 0,
  matAoInt: 1,
  bloomIntensity: 0,
  bloomThreshold: 0.2,
  bloomRadius: 0.5,
  ppExposure: SCENE_TONE_MAPPING_EXPOSURE,
  ppContrast: 0,
  ppSaturation: 0,
  toneMapping: "ACESFilmicToneMapping",
  envIntensityVal: 1,
  envReflectionIntensity: 1,
  envRotation: 0,
  envMapUrl: null as string | null,
  envMapIsHdr: true,
  envReflectionSphereVisible: false,
  bgColorVal: SCENE_VIEWPORT_BG,
  fogEnabled: true,
  fogNear: 4,
  fogFar: 32,
  shadowEnabled: false,
  shadowIntensity: 1,
  shadowMapSize: 2048,
  shadowBias: 0.0001,
  shadowNormalBias: 0,
  shadowType: "pcfsoft",
  gridVisible: true,
  gridSize: SCENE_GRID_SIZE,
  gridDivisions: SCENE_GRID_DIVISIONS,
  gridHeight: 0,
  msaaEnabled: true,
  /** none | ssaa | smaa | fxaa */
  antialiasingMode: "fxaa" as AntialiasingMode,
  maxPixelRatio: 2,
  targetFps: 30 as TargetFps
};

export const ANTIALIASING_MODE_OPTIONS: ReadonlyArray<{ value: AntialiasingMode; label: string; hint: string }> = [
  { value: "fxaa", label: "FXAA", hint: "边缘平滑，性能友好" },
  { value: "smaa", label: "SMAA", hint: "清晰度高，GPU 占用略高" },
  { value: "ssaa", label: "SSAA 超采样", hint: "配合高采样倍数最清晰" },
  { value: "none", label: "关闭", hint: "无后处理抗锯齿" }
];

/** 渲染采样倍数范围与步进 */
export const ANTIALIAS_RATIO_MIN = 1;
export const ANTIALIAS_RATIO_MAX = 3;
export const ANTIALIAS_RATIO_STEP = 0.5;

/** 渲染像素比上限：编辑器 */
export const RENDER_PIXEL_RATIO_MAX_EDITOR = 3;

export type RenderPixelRatioContext = "editor" | "presentation";
export const ANTIALIAS_RATIO_PRESETS = [
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
  { value: 2.5, label: "2.5x" },
  { value: 3, label: "3x" }
] as const;

/** 将采样倍数归一化到 [1, 3] 且对齐 0.5 步进 */
export function normalizeAntialiasRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SCENE_SETTINGS.maxPixelRatio;
  const clamped = Math.min(ANTIALIAS_RATIO_MAX, Math.max(ANTIALIAS_RATIO_MIN, value));
  return Math.round(clamped / ANTIALIAS_RATIO_STEP) * ANTIALIAS_RATIO_STEP;
}

/** 设备像素比（至少 1） */
export function getDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return Math.max(window.devicePixelRatio || 1, 1);
}

/** 配置的采样档位（存入场景 / 面板展示，不含 DPR） */
export function getConfiguredRenderSampleRatio(ratio: number): number {
  return normalizeAntialiasRatio(ratio);
}

/** 展示模式像素比上限 */
export const PRESENTATION_PIXEL_RATIO_CAP = 2;

/** 编辑器模式：后处理 + 配置档位 */
export function resolveEditorRenderPixelRatio(ratio: number): number {
  const tier = normalizeAntialiasRatio(ratio);
  const dpr = getDevicePixelRatio();
  return Math.min(Math.max(tier, Math.min(dpr, 2)), RENDER_PIXEL_RATIO_MAX_EDITOR);
}
