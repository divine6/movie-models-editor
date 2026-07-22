import * as THREE from "three";

import { getDevicePixelRatio, normalizeAntialiasRatio } from "@/composables/movie-editor/constants";

import type { GpuTierProfile } from "./gpuTier";

/** 提升 GLB 贴图在斜视角下的清晰度（覆盖 Standard / Physical 常用贴图槽） */
const TEXTURE_MAP_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "bumpMap",
  "displacementMap",
  "lightMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "specularMap",
  "specularIntensityMap",
  "specularColorMap",
  "iridescenceMap",
  "iridescenceThicknessMap"
] as const;

/** Oxide 风格：根据 GPU 最大纹理边长计算 DPR 上限 */
export function probePresentationBufferCap(viewportEdgePx: number, maxTextureSize: number): number {
  if (viewportEdgePx <= 0 || maxTextureSize <= 0) return 2;
  return Math.max(1, (maxTextureSize * 0.98) / viewportEdgePx);
}

/**
 * 展示模式像素比：min(设备DPR, 配置档位, GPU分档上限, 缓冲上限) × 性能缩放
 * 掉帧时由 perfScale 降负荷；保持 SMAA，不靠过高 DPR/MSAA 硬扛
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
  // 配置档与 GPU 上限取交，再不超过设备 DPR
  const qualityCap = Math.min(Math.max(tier, 1.25), gpuProfile.maxPresentationDpr, dpr);
  const ratio = Math.min(qualityCap, bufferCap) * Math.max(0.78, Math.min(perfScale, 1));
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
        const tex = (mat as THREE.MeshStandardMaterial & Record<string, THREE.Texture | null>)[key];
        if (!tex || !(tex as THREE.Texture).isTexture) continue;
        tex.anisotropy = aniso;
        const compressed = (tex as THREE.CompressedTexture).isCompressedTexture;
        if (!compressed) {
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
        }
        tex.needsUpdate = true;
      }
    }
  });
}
