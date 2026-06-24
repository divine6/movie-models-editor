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

export const CHAPTER_TIME_EPS = 0.05;
export const CHAPTER_END_EPS = 0.02;
export const SEEK_READY_TIMEOUT_MS = 4000;
export const SEEK_EVENT_TIMEOUT_MS = 800;

export const DEFAULT_SCENE_SETTINGS = {
  ambIntensity: 0.35,
  dirIntensity: 0.65,
  dirPos: [5, 10, 5] as [number, number, number],
  fillIntensity: 0.2,
  fillPos: [-5, 3, 5] as [number, number, number],
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
  envMapUrl: null as string | null,
  envMapIsHdr: false,
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
  gridHeight: 0
};
