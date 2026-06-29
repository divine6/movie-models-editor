import * as THREE from "three";

import { getDevicePixelRatio, normalizeAntialiasRatio } from "@/composables/movie-editor/constants";

import type { GpuTierProfile } from "./gpuTier";

const TEXTURE_MAP_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const;

/** Oxide 风格：根据 GPU 最大纹理边长计算 DPR 上限 */
export function probePresentationBufferCap(viewportEdgePx: number, maxTextureSize: number): number {
  if (viewportEdgePx <= 0 || maxTextureSize <= 0) return 2;
  return Math.max(1, (maxTextureSize * 0.98) / viewportEdgePx);
}

/**
 * 展示模式像素比：min(设备DPR, 配置档位, GPU分档上限, 缓冲上限) × 性能缩放
 * perfScale 仅在动画播放掉帧时由渲染层自动降低，不改动画逻辑
 */
export function resolvePresentationPixelRatio(
  configuredTier: number,
  viewportWidth: number,
  viewportHeight: number,
  maxTextureSize: number,
  gpuProfile: GpuTierProfile,
  perfScale = 1
): number {
  const tier = normalizeAntialiasRatio(configuredTier);
  const dpr = getDevicePixelRatio();
  const edge = Math.max(viewportWidth, viewportHeight, 1);
  const bufferCap = probePresentationBufferCap(edge, maxTextureSize);
  const qualityCap = Math.min(tier, gpuProfile.maxPresentationDpr, dpr);
  const ratio = Math.min(qualityCap, bufferCap) * Math.max(0.75, Math.min(perfScale, 1));
  return Math.max(1, Math.round(ratio * 100) / 100);
}

/** 提升 GLB 贴图在斜视角下的清晰度 */
export function applyMeshTextureQuality(root: THREE.Object3D, renderer: THREE.WebGLRenderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  if (aniso <= 1) return;
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of TEXTURE_MAP_KEYS) {
        const tex = (mat as THREE.MeshStandardMaterial)[key];
        if (!tex) continue;
        tex.anisotropy = aniso;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
      }
    }
  });
}
