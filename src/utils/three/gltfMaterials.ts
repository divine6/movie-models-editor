import * as THREE from "three";

/** 颜色类贴图：需 sRGB */
const COLOR_MAP_KEYS = [
  "map",
  "emissiveMap",
  "specularMap",
  "specularColorMap",
  "sheenColorMap"
] as const;

/** 数据类贴图：无颜色空间 */
const DATA_MAP_KEYS = [
  "normalMap",
  "bumpMap",
  "displacementMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "alphaMap",
  "lightMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "specularIntensityMap",
  "iridescenceMap",
  "iridescenceThicknessMap"
] as const;

const ALL_TEXTURE_KEYS = [...COLOR_MAP_KEYS, ...DATA_MAP_KEYS] as const;

const BASE_ENV_KEY = "__baseEnvMapIntensity";
const BASE_ROUGH_KEY = "__baseRoughness";
const BASE_METAL_KEY = "__baseMetalness";
const BASE_NORMAL_KEY = "__baseNormalScale";
const BASE_NORMAL_SIGN_KEY = "__baseNormalSign";
const BASE_EMISSIVE_KEY = "__baseEmissiveIntensity";
const BASE_COLOR_KEY = "__baseColorHex";
const PREPARED_KEY = "__gltfMaterialPrepared";

type PbrMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

function isPbrMaterial(mat: THREE.Material): mat is PbrMaterial {
  return (
    (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial === true ||
    (mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial === true
  );
}

function forEachMaterial(root: THREE.Object3D, fn: (mat: THREE.Material, mesh: THREE.Mesh) => void) {
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat) fn(mat, mesh);
    }
  });
}

function configureTexture(
  tex: THREE.Texture | null | undefined,
  kind: "color" | "data",
  aniso: number
) {
  if (!tex) return;
  if (kind === "color") {
    if (tex.colorSpace !== THREE.SRGBColorSpace && tex.colorSpace !== THREE.LinearSRGBColorSpace) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  } else if (tex.colorSpace !== THREE.NoColorSpace && tex.colorSpace !== THREE.LinearSRGBColorSpace) {
    tex.colorSpace = THREE.NoColorSpace;
  }

  if (aniso > 1) {
    tex.anisotropy = Math.max(tex.anisotropy || 1, aniso);
  }

  // 压缩贴图不可强制 generateMipmaps，否则可能变黑/丢失
  const compressed = (tex as THREE.CompressedTexture).isCompressedTexture;
  if (!compressed) {
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
  }
  tex.needsUpdate = true;
}

/** 快照 GLTF 原始 PBR 参数，供场景滑杆在不破坏贴图的前提下调节 */
export function snapshotGltfMaterialBases(mat: THREE.Material) {
  if (!isPbrMaterial(mat)) return;
  const ud = mat.userData;
  if (typeof ud[BASE_ENV_KEY] !== "number" && typeof mat.envMapIntensity === "number") {
    ud[BASE_ENV_KEY] = mat.envMapIntensity;
  }
  if (typeof ud[BASE_ROUGH_KEY] !== "number" && typeof mat.roughness === "number") {
    ud[BASE_ROUGH_KEY] = mat.roughness;
  }
  if (typeof ud[BASE_METAL_KEY] !== "number" && typeof mat.metalness === "number") {
    ud[BASE_METAL_KEY] = mat.metalness;
  }
  if (mat.normalScale) {
    if (typeof ud[BASE_NORMAL_SIGN_KEY] !== "number") {
      ud[BASE_NORMAL_SIGN_KEY] = mat.normalScale.x < 0 ? -1 : 1;
    }
    if (typeof ud[BASE_NORMAL_KEY] !== "number") {
      ud[BASE_NORMAL_KEY] = Math.abs(mat.normalScale.x) || 1;
    }
  }
  if (typeof ud[BASE_EMISSIVE_KEY] !== "number" && typeof mat.emissiveIntensity === "number") {
    ud[BASE_EMISSIVE_KEY] = mat.emissiveIntensity;
  }
  if (typeof ud[BASE_COLOR_KEY] !== "string" && mat.color) {
    ud[BASE_COLOR_KEY] = `#${mat.color.getHexString()}`;
  }
}

/** 将粗糙度/金属度恢复为 GLTF 原始值（撤销错误的场景反射改写） */
export function restoreGltfMaterialBases(mat: THREE.Material) {
  if (!isPbrMaterial(mat)) return;
  const ud = mat.userData;
  if (typeof ud[BASE_ROUGH_KEY] === "number") mat.roughness = ud[BASE_ROUGH_KEY] as number;
  if (typeof ud[BASE_METAL_KEY] === "number") mat.metalness = ud[BASE_METAL_KEY] as number;
  if (typeof ud[BASE_NORMAL_KEY] === "number" && mat.normalScale) {
    const sign = typeof ud[BASE_NORMAL_SIGN_KEY] === "number" ? (ud[BASE_NORMAL_SIGN_KEY] as number) : 1;
    mat.normalScale.setScalar(sign * Math.abs(ud[BASE_NORMAL_KEY] as number));
  }
  if (typeof ud[BASE_EMISSIVE_KEY] === "number") {
    mat.emissiveIntensity = ud[BASE_EMISSIVE_KEY] as number;
  }
  if (typeof ud[BASE_COLOR_KEY] === "string" && mat.color) {
    mat.color.set(ud[BASE_COLOR_KEY] as string);
  }
  mat.needsUpdate = true;
}

/**
 * 加载后整理材质：保留 3ds Max / DCC 导出的全部贴图与 PBR 参数，
 * 仅修正颜色空间与各向异性过滤，不改写 roughness/metalness/color。
 */
export function prepareGltfMaterials(root: THREE.Object3D, renderer?: THREE.WebGLRenderer | null) {
  const aniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;

  forEachMaterial(root, mat => {
    if (mat.userData?.[PREPARED_KEY]) {
      snapshotGltfMaterialBases(mat);
      return;
    }

    for (const key of COLOR_MAP_KEYS) {
      configureTexture((mat as any)[key] as THREE.Texture | undefined, "color", aniso);
    }
    for (const key of DATA_MAP_KEYS) {
      configureTexture((mat as any)[key] as THREE.Texture | undefined, "data", aniso);
    }

    // 有金属/粗糙度贴图时，确保标量通道能完整乘上贴图（glTF 惯例常为 1）
    if (isPbrMaterial(mat)) {
      if (mat.metalnessMap && typeof mat.metalness === "number" && mat.metalness <= 0) {
        mat.metalness = 1;
      }
      if (mat.roughnessMap && typeof mat.roughness === "number" && mat.roughness <= 0) {
        mat.roughness = 1;
      }
      // 网孔等细节依赖法线贴图：强度被置 0 时恢复为 1（保留原始正负号）
      if (mat.normalMap && mat.normalScale && Math.abs(mat.normalScale.x) < 1e-4) {
        const sign = mat.normalScale.x < 0 || mat.normalScale.y < 0 ? -1 : 1;
        mat.normalScale.setScalar(sign);
      }
      // 透明文字/贴花：保证贴图可见，避免被不透明物体深度写坏
      if (mat.transparent || mat.opacity < 0.999 || !!mat.alphaMap) {
        mat.depthWrite = false;
        mat.transparent = true;
      }
      snapshotGltfMaterialBases(mat);
    }

    mat.userData[PREPARED_KEY] = true;
    mat.needsUpdate = true;
  });
}

/**
 * 仅缩放环境反射强度，绝不改写粗糙度/金属度。
 * intensity=1 表示保持 GLTF 原始 envMapIntensity。
 */
export function applyGltfEnvMapIntensity(root: THREE.Object3D, intensity: number) {
  const scale = Math.max(0, intensity);
  forEachMaterial(root, mat => {
    if (!isPbrMaterial(mat) || typeof mat.envMapIntensity !== "number") return;
    snapshotGltfMaterialBases(mat);
    restoreGltfMaterialBases(mat);
    const base =
      typeof mat.userData[BASE_ENV_KEY] === "number"
        ? (mat.userData[BASE_ENV_KEY] as number)
        : mat.envMapIntensity;
    mat.userData[BASE_ENV_KEY] = base;
    mat.envMapIntensity = base * scale;
    mat.needsUpdate = true;
  });
}

export function updateGltfMaterialBaseOverrides(
  mat: THREE.Material,
  overrides: {
    roughness?: number;
    metalness?: number;
    /** 法线强度（绝对值 0~N）；保留 glTF 原始正负号，避免网孔法线被抹平 */
    normalScale?: number;
    emissiveIntensity?: number;
    color?: string;
  }
) {
  if (!isPbrMaterial(mat)) return;
  snapshotGltfMaterialBases(mat);
  if (overrides.roughness !== undefined) {
    mat.roughness = overrides.roughness;
    mat.userData[BASE_ROUGH_KEY] = overrides.roughness;
  }
  if (overrides.metalness !== undefined) {
    mat.metalness = overrides.metalness;
    mat.userData[BASE_METAL_KEY] = overrides.metalness;
  }
  if (overrides.normalScale !== undefined && mat.normalScale) {
    const sign =
      typeof mat.userData[BASE_NORMAL_SIGN_KEY] === "number"
        ? (mat.userData[BASE_NORMAL_SIGN_KEY] as number)
        : mat.normalScale.x < 0
          ? -1
          : 1;
    const mag = Math.abs(overrides.normalScale);
    mat.normalScale.setScalar(sign * mag);
    mat.userData[BASE_NORMAL_SIGN_KEY] = sign;
    mat.userData[BASE_NORMAL_KEY] = mag;
  }
  if (overrides.emissiveIntensity !== undefined) {
    mat.emissiveIntensity = overrides.emissiveIntensity;
    mat.userData[BASE_EMISSIVE_KEY] = overrides.emissiveIntensity;
  }
  if (overrides.color !== undefined && mat.color) {
    mat.color.set(overrides.color);
    mat.userData[BASE_COLOR_KEY] = `#${mat.color.getHexString()}`;
  }
  mat.needsUpdate = true;
}

export { ALL_TEXTURE_KEYS, BASE_ENV_KEY, BASE_ROUGH_KEY, BASE_METAL_KEY };
