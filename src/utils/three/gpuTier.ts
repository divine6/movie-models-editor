import type * as THREE from "three";

import { getDevicePixelRatio } from "@/composables/movie-editor/constants";

/** 0（弱）~ 3（强），对齐 Oxide rack-explorer 分档思路 */
export type GpuTierLevel = 0 | 1 | 2 | 3;

export interface GpuTierProfile {
  tier: GpuTierLevel;
  /** 展示模式允许的最大渲染 DPR */
  maxPresentationDpr: number;
  /** WebGL2 下是否对 Composer RT 开 MSAA */
  enableComposerMsaa: boolean;
}

const HIGH_TIER_RENDERER_RE =
  /(rtx\s*[3-9]\d{3}|geforce\s*(rtx\s*)?[3-9]\d{3}|radeon\s*rx\s*[6-9]\d{3}|apple\s*m\d|apple\s*gpu|adreno \(tm\) [6-9]|mali-g[7-9])/i;

function readRendererString(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  if (!ext) return "";
  try {
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
  } catch {
    return "";
  }
}

export function probeMaxTextureSize(gl: WebGLRenderingContext | WebGL2RenderingContext): number {
  const size = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  return Number.isFinite(size) && size > 0 ? size : 4096;
}

/**
 * 轻量 GPU 分档（不引入额外 npm 包）：结合 WebGL 能力 + 渲染器字符串
 * 仅用于展示模式清晰度 / 抗锯齿策略，不影响业务逻辑
 */
export function detectGpuTierProfile(
  renderer: THREE.WebGLRenderer,
  coarsePointer: boolean
): GpuTierProfile {
  const gl = renderer.getContext();
  const maxTex = probeMaxTextureSize(gl);
  const isWebGL2 = gl instanceof WebGL2RenderingContext;
  const rendererStr = readRendererString(gl);
  const dpr = getDevicePixelRatio();

  let tier: GpuTierLevel = 1;
  if (HIGH_TIER_RENDERER_RE.test(rendererStr) || (isWebGL2 && maxTex >= 16384)) {
    tier = 3;
  } else if (isWebGL2 && maxTex >= 8192) {
    tier = 2;
  } else if (maxTex >= 4096) {
    tier = 1;
  } else {
    tier = 0;
  }

  // 手机触屏设备上限 tier 2，避免误判高端桌面串到手机
  if (coarsePointer) tier = Math.min(tier, 2) as GpuTierLevel;

  const maxDprTable: Record<GpuTierLevel, number> = {
    0: coarsePointer ? Math.min(dpr, 1.5) : 1.25,
    1: coarsePointer ? Math.min(dpr, 2) : 1.75,
    2: coarsePointer ? Math.min(dpr, 2.5) : 2,
    3: coarsePointer ? Math.min(dpr, 2.5) : 2
  };

  return {
    tier,
    maxPresentationDpr: maxDprTable[tier],
    /** tier≥1 且 WebGL2 时启用 Composer MSAA（具体 sample 数由渲染层按动画状态调节） */
    enableComposerMsaa: tier >= 1 && isWebGL2
  };
}
