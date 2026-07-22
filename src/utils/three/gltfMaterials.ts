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
const BASE_CLEARCOAT_KEY = "__baseClearcoat";
const BASE_CLEARCOAT_ROUGH_KEY = "__baseClearcoatRoughness";
const BASE_SPECULAR_INT_KEY = "__baseSpecularIntensity";
const BASE_IOR_KEY = "__baseIor";
const BASE_ROUGH_MAP_KEY = "__baseRoughnessMap";
const BASE_METAL_MAP_KEY = "__baseMetalnessMap";
const SPECULAR_MAPS_DETACHED_KEY = "__specularMapsDetached";
const BOUND_SCENE_ENV_KEY = "__boundSceneEnvMap";
const PREPARED_KEY = "__gltfMaterialPrepared";
const GLTF_MATERIAL_NAME_KEY = "__gltfMaterialName";

type PbrMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

/**
 * Three.js (r167+) 会把 material.name 直接写入 `#define SHADER_NAME ${name}`。
 * GLB 里常见名称如 `T_text_hole` / 含换行或连字符 时，会在顶点着色器直接语法错误。
 */
function sanitizeMaterialShaderName(mat: THREE.Material) {
  const original = mat.name || "";
  if (original && mat.userData[GLTF_MATERIAL_NAME_KEY] === undefined) {
    mat.userData[GLTF_MATERIAL_NAME_KEY] = original;
  }
  // 清空 name：Three 会生成 `#define SHADER_NAME `（空值，合法），
  // 并彻底避免 T_text_* 这类名称把 `#define SHADER_NAME T` + `_text` 拆成非法语句。
  mat.name = "";
}

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
  if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const phys = mat as THREE.MeshPhysicalMaterial;
    if (typeof ud[BASE_CLEARCOAT_KEY] !== "number") {
      ud[BASE_CLEARCOAT_KEY] = typeof phys.clearcoat === "number" ? phys.clearcoat : 0;
    }
    if (typeof ud[BASE_CLEARCOAT_ROUGH_KEY] !== "number") {
      ud[BASE_CLEARCOAT_ROUGH_KEY] =
        typeof phys.clearcoatRoughness === "number" ? phys.clearcoatRoughness : 0;
    }
    if (typeof ud[BASE_SPECULAR_INT_KEY] !== "number" && typeof phys.specularIntensity === "number") {
      ud[BASE_SPECULAR_INT_KEY] = phys.specularIntensity;
    }
    if (typeof ud[BASE_IOR_KEY] !== "number" && typeof phys.ior === "number") {
      ud[BASE_IOR_KEY] = phys.ior;
    }
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

  forEachMaterial(root, (mat, mesh) => {
    // 始终确保着色器名合法；已 prepare 的材质也要修（热更新后旧 name 仍在）
    const hadUnsafeName = !!(mat.name && mat.name.length > 0);
    sanitizeMaterialShaderName(mat);
    if (hadUnsafeName) mat.needsUpdate = true;

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
      sanitizePhysicalMaterialForWebGL(mat, mesh);
      snapshotGltfMaterialBases(mat);
    }

    mat.userData[PREPARED_KEY] = true;
    mat.needsUpdate = true;
  });
}

/**
 * 部分 DCC 导出的文字/孔洞 MeshPhysicalMaterial（如 T_text / T_text_hole）
 * 在 ANGLE/驱动上会顶点着色器编译失败；关掉易崩特性并纠正 morph/皮肤标志。
 */
function sanitizePhysicalMaterialForWebGL(mat: PbrMaterial, mesh: THREE.Mesh) {
  const geo = mesh.geometry;
  const hasUv = !!geo?.attributes?.uv;
  const hasMorph = !!(geo?.morphAttributes && Object.keys(geo.morphAttributes).length);
  const hasSkin = !!(mesh as THREE.SkinnedMesh).isSkinnedMesh;

  // 材质开启了贴图相关通道但几何没有 UV → 着色器编译/链接失败
  if (!hasUv) {
    for (const key of ALL_TEXTURE_KEYS) {
      if ((mat as any)[key]) (mat as any)[key] = null;
    }
  }

  mat.morphTargets = hasMorph && !!geo?.morphAttributes?.position;
  mat.morphNormals = hasMorph && !!geo?.morphAttributes?.normal;
  (mat as any).skinning = hasSkin;

  if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const phys = mat as THREE.MeshPhysicalMaterial;
    // 文字类材质名常见问题：开启 transmission/dispersion 等高级通道易触发 VALIDATE_STATUS false
    const name = (phys.name || "").toLowerCase();
    const looksLikeTextDecal = /text|label|decal|孔|字/.test(name) || name.includes("t_text");
    if (looksLikeTextDecal || phys.transparent || (phys.transmission ?? 0) > 0) {
      if (typeof phys.transmission === "number" && phys.transmission > 0) {
        // 用透明度近似透光，避免 Physical transmission 着色器路径
        phys.opacity = Math.min(phys.opacity, Math.max(0.15, 1 - phys.transmission));
        phys.transparent = true;
        phys.depthWrite = false;
        phys.transmission = 0;
      }
      if (typeof (phys as any).dispersion === "number") (phys as any).dispersion = 0;
      if (typeof phys.thickness === "number") phys.thickness = 0;
      if (typeof phys.attenuationDistance === "number") {
        phys.attenuationDistance = Infinity;
      }
      phys.transmissionMap = null;
      phys.thicknessMap = null;
    }
  }
}

/**
 * 仅缩放环境反射强度（适合自带 material.envMap 的材质）。
 * intensity=1 表示保持 GLTF 原始 envMapIntensity。
 */
export function applyGltfEnvMapIntensity(root: THREE.Object3D, intensity: number) {
  const scale = Math.max(0, intensity);
  forEachMaterial(root, mat => {
    if (!isPbrMaterial(mat)) return;
    if (typeof mat.envMapIntensity !== "number") {
      mat.envMapIntensity = 1;
    }
    snapshotGltfMaterialBases(mat);
    let base =
      typeof mat.userData[BASE_ENV_KEY] === "number"
        ? (mat.userData[BASE_ENV_KEY] as number)
        : mat.envMapIntensity;
    if (!(base > 0)) {
      base = 1;
      mat.userData[BASE_ENV_KEY] = 1;
    }
    mat.envMapIntensity = base * scale;
    mat.needsUpdate = true;
  });
}

/**
 * 模型镜面/玻璃反射（恢复首版逻辑）。
 * intensity=1 原始；约 3 满玻璃感：压低粗糙度 + 适度抬环境反射 + 清漆。
 *
 * Three r184：绑定 scene 环境贴图到 material.envMap，镜面强度才可控。
 */
export function applyGltfSpecularGlassReflection(
  root: THREE.Object3D,
  intensity: number,
  sceneEnvMap?: THREE.Texture | null,
  environmentIntensity = 1
) {
  const t = Math.max(0, intensity);
  const envI = Math.max(0, environmentIntensity);
  // 1→0，约 3 达到满玻璃感
  const glassAmount = t <= 1 ? 0 : Math.min(1, (t - 1) / 2);
  const dullAmount = t >= 1 ? 0 : 1 - t;

  forEachMaterial(root, (mat, mesh) => {
    if (!isPbrMaterial(mat)) return;
    snapshotGltfMaterialBases(mat);
    let ud = mat.userData;

    // Standard 升级 Physical，使首版清漆逻辑对常见 GLB 也生效
    let workMat: PbrMaterial = mat;
    if (
      glassAmount > 0 &&
      !(mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial &&
      (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial
    ) {
      workMat = upgradeStandardToPhysicalForGlass(mat as THREE.MeshStandardMaterial, mesh);
      snapshotGltfMaterialBases(workMat);
      ud = workMat.userData;
    }

    if (sceneEnvMap) {
      if (workMat.envMap !== sceneEnvMap) {
        workMat.envMap = sceneEnvMap;
        ud[BOUND_SCENE_ENV_KEY] = true;
      }
    }

    let baseEnv =
      typeof ud[BASE_ENV_KEY] === "number"
        ? (ud[BASE_ENV_KEY] as number)
        : workMat.envMapIntensity || 1;
    if (!(baseEnv > 0)) {
      baseEnv = 1;
      ud[BASE_ENV_KEY] = 1;
    }
    // 环境贴图强度 × 镜面增强；t<1 时整体变哑
    const specularBoost = (1 + glassAmount * 1.8) * (t < 1 ? Math.max(t, 0) : 1);
    workMat.envMapIntensity = baseEnv * envI * specularBoost;

    const baseRough =
      typeof ud[BASE_ROUGH_KEY] === "number" ? (ud[BASE_ROUGH_KEY] as number) : workMat.roughness;
    const baseMetal =
      typeof ud[BASE_METAL_KEY] === "number" ? (ud[BASE_METAL_KEY] as number) : workMat.metalness;

    // 首版不拉金属度；顺带清掉后续试验留下的金属/贴图改动
    workMat.metalness = baseMetal;
    if (ud[SPECULAR_MAPS_DETACHED_KEY]) {
      if (ud[BASE_ROUGH_MAP_KEY]) {
        workMat.roughnessMap = ud[BASE_ROUGH_MAP_KEY] as THREE.Texture;
        delete ud[BASE_ROUGH_MAP_KEY];
      }
      if (ud[BASE_METAL_MAP_KEY]) {
        workMat.metalnessMap = ud[BASE_METAL_MAP_KEY] as THREE.Texture;
        delete ud[BASE_METAL_MAP_KEY];
      }
      delete ud[SPECULAR_MAPS_DETACHED_KEY];
    }

    if (dullAmount > 0) {
      workMat.roughness = THREE.MathUtils.lerp(baseRough, Math.min(1, baseRough + 0.55), dullAmount);
    } else {
      // 压低粗糙度 → 锐利镜面/玻璃反射
      const targetRough = Math.min(baseRough, 0.06);
      workMat.roughness = THREE.MathUtils.lerp(baseRough, targetRough, glassAmount * 0.92);
    }

    if ((workMat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
      const phys = workMat as THREE.MeshPhysicalMaterial;
      const baseCc =
        typeof ud[BASE_CLEARCOAT_KEY] === "number" ? (ud[BASE_CLEARCOAT_KEY] as number) : 0;
      const baseCcRough =
        typeof ud[BASE_CLEARCOAT_ROUGH_KEY] === "number"
          ? (ud[BASE_CLEARCOAT_ROUGH_KEY] as number)
          : 0;
      const baseSpec =
        typeof ud[BASE_SPECULAR_INT_KEY] === "number"
          ? (ud[BASE_SPECULAR_INT_KEY] as number)
          : typeof phys.specularIntensity === "number"
            ? phys.specularIntensity
            : 1;

      if (dullAmount > 0) {
        phys.clearcoat = THREE.MathUtils.lerp(baseCc, 0, dullAmount);
        phys.clearcoatRoughness = THREE.MathUtils.lerp(baseCcRough, 1, dullAmount);
        phys.specularIntensity = THREE.MathUtils.lerp(baseSpec, Math.max(0, baseSpec * 0.2), dullAmount);
      } else {
        // 清漆层：玻璃/烤漆镜面感
        phys.clearcoat = THREE.MathUtils.lerp(baseCc, 1, glassAmount);
        phys.clearcoatRoughness = THREE.MathUtils.lerp(baseCcRough, 0.02, glassAmount);
        phys.specularIntensity = THREE.MathUtils.lerp(
          baseSpec,
          Math.max(baseSpec, 1) * 1.35,
          glassAmount
        );
      }
    }

    workMat.needsUpdate = true;
  });
}

/** 将 MeshStandardMaterial 升级为 Physical，以便使用 clearcoat 做玻璃感 */
function upgradeStandardToPhysicalForGlass(
  mat: THREE.MeshStandardMaterial,
  mesh: THREE.Mesh
): THREE.MeshPhysicalMaterial {
  if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    return mat as THREE.MeshPhysicalMaterial;
  }

  let phys = mat.userData.__physicalGlassMat as THREE.MeshPhysicalMaterial | undefined;
  if (!phys || !phys.isMeshPhysicalMaterial) {
    phys = new THREE.MeshPhysicalMaterial();
    phys.copy(mat);
    phys.clearcoat = 0;
    phys.clearcoatRoughness = 0;
    phys.userData = { ...mat.userData, __upgradedToPhysicalForGlass: true };
    mat.userData.__upgradedToPhysicalForGlass = true;
    mat.userData.__physicalGlassMat = phys;
  }

  if (Array.isArray(mesh.material)) {
    const idx = mesh.material.indexOf(mat);
    if (idx >= 0) mesh.material[idx] = phys;
  } else if (mesh.material === mat) {
    mesh.material = phys;
  }
  return phys;
}

/** 解除由镜面反射滑杆绑定的 scene.environment → material.envMap，并恢复被摘掉的贴图 */
export function clearBoundSceneEnvMaps(root: THREE.Object3D) {
  forEachMaterial(root, mat => {
    if (!isPbrMaterial(mat)) {
      if (mat.userData?.[BOUND_SCENE_ENV_KEY]) {
        mat.envMap = null;
        delete mat.userData[BOUND_SCENE_ENV_KEY];
        mat.needsUpdate = true;
      }
      return;
    }
    const ud = mat.userData;
    if (ud[SPECULAR_MAPS_DETACHED_KEY]) {
      if (ud[BASE_ROUGH_MAP_KEY]) {
        mat.roughnessMap = ud[BASE_ROUGH_MAP_KEY] as THREE.Texture;
        delete ud[BASE_ROUGH_MAP_KEY];
      }
      if (ud[BASE_METAL_MAP_KEY]) {
        mat.metalnessMap = ud[BASE_METAL_MAP_KEY] as THREE.Texture;
        delete ud[BASE_METAL_MAP_KEY];
      }
      delete ud[SPECULAR_MAPS_DETACHED_KEY];
    }
    if (ud[BOUND_SCENE_ENV_KEY]) {
      mat.envMap = null;
      delete ud[BOUND_SCENE_ENV_KEY];
    }
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
