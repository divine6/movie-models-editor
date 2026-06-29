import * as THREE from "three";

import type { SceneLightSettings, SceneLightType } from "@/interface/sceneLight";
import { createSceneLightGizmo } from "@/utils/three/sceneLightGizmo";
import { disposeObject3D } from "@/utils/three/gizmoLabels";

export interface SceneLightRuntime {
  config: SceneLightSettings;
  group: THREE.Group;
  light: THREE.Light;
  target: THREE.Object3D;
  gizmo: THREE.Group;
}

const _dir = new THREE.Vector3();
const _offset = new THREE.Vector3();

/** 相对模型中心的最大默认距离（米） */
export const SCENE_LIGHT_DEFAULT_DISTANCE: Record<SceneLightType, number> = {
  directional: 5,
  point: 2,
  spot: 3
};

const LIGHT_OFFSET_DIRS: Record<SceneLightType, THREE.Vector3[]> = {
  directional: [
    new THREE.Vector3(0.55, 0.75, 0.55).normalize(),
    new THREE.Vector3(-0.5, 0.65, -0.45).normalize()
  ],
  point: [new THREE.Vector3(0.65, 0.35, 0.65).normalize(), new THREE.Vector3(-0.6, 0.45, 0.5).normalize()],
  spot: [new THREE.Vector3(-0.45, 0.8, 0.4).normalize(), new THREE.Vector3(0.5, 0.7, -0.45).normalize()]
};

export function computeSceneLightPosition(
  type: SceneLightType,
  center: THREE.Vector3 | null | undefined,
  variantIndex = 0
): [number, number, number] {
  const dist = SCENE_LIGHT_DEFAULT_DISTANCE[type];
  const dirs = LIGHT_OFFSET_DIRS[type];
  const dir = dirs[variantIndex % dirs.length] ?? dirs[0];
  _offset.copy(dir).multiplyScalar(dist);
  const base = center ?? new THREE.Vector3(0, 0, 0);
  return [base.x + _offset.x, base.y + _offset.y, base.z + _offset.z];
}

export function createSceneLightId() {
  return `light_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultSceneLightName(type: SceneLightType, index: number) {
  switch (type) {
    case "directional":
      return `平行光 ${index}`;
    case "spot":
      return `聚光灯 ${index}`;
    case "point":
      return `点光源 ${index}`;
  }
}

export function createDefaultSceneLight(
  type: SceneLightType,
  index: number,
  center?: THREE.Vector3 | null
): SceneLightSettings {
  const base: SceneLightSettings = {
    id: createSceneLightId(),
    type,
    name: defaultSceneLightName(type, index),
    color: "#ffffff",
    intensity: type === "directional" ? 0.65 : 1,
    position: computeSceneLightPosition(type, center, Math.max(0, index - 1)),
    rotation: type === "spot" ? [-50, 25, 0] : [-45, 30, 0],
    distance: 0,
    decay: 2,
    angle: 45,
    penumbra: 0.2,
    castShadow: type === "directional"
  };
  return base;
}

export function migrateLegacySceneLights(
  data: {
    dirIntensity?: number;
    dirPos?: [number, number, number];
    fillIntensity?: number;
    fillPos?: [number, number, number];
  },
  center?: THREE.Vector3 | null
): SceneLightSettings[] {
  const lights: SceneLightSettings[] = [];
  if (data.dirPos) {
    lights.push({
      id: createSceneLightId(),
      type: "directional",
      name: "主平行光",
      color: "#ffffff",
      intensity: data.dirIntensity ?? 0.65,
      position: [...data.dirPos],
      rotation: [-50, 30, 0],
      distance: 0,
      decay: 2,
      angle: 45,
      penumbra: 0.2,
      castShadow: true
    });
  } else {
    lights.push(createDefaultSceneLight("directional", 1, center));
  }
  if (data.fillPos) {
    lights.push({
      id: createSceneLightId(),
      type: "directional",
      name: "补光",
      color: "#88bbff",
      intensity: data.fillIntensity ?? 0.2,
      position: [...data.fillPos],
      rotation: [-35, -120, 0],
      distance: 0,
      decay: 2,
      angle: 45,
      penumbra: 0.2,
      castShadow: false
    });
  }
  if (lights.length === 0) {
    lights.push(createDefaultSceneLight("directional", 1, center));
  }
  return lights;
}

function applyLightDirection(light: THREE.DirectionalLight | THREE.SpotLight, target: THREE.Object3D, rotation: [number, number, number]) {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2])
  );
  _dir.set(0, 0, -1).applyEuler(euler).normalize();
  target.position.copy(_dir.multiplyScalar(5));
  target.updateMatrixWorld();
}

function rebuildSceneLightGizmo(runtime: SceneLightRuntime, selected = false) {
  runtime.group.remove(runtime.gizmo);
  disposeObject3D(runtime.gizmo);
  runtime.gizmo = createSceneLightGizmo(runtime.config, runtime.target, selected);
  runtime.group.add(runtime.gizmo);
}

export function buildSceneLightRuntime(config: SceneLightSettings, selected = false): SceneLightRuntime {
  const group = new THREE.Group();
  group.name = config.name;
  group.position.set(config.position[0], config.position[1], config.position[2]);
  group.userData.sceneLightId = config.id;

  const color = new THREE.Color(config.color);
  let light: THREE.Light;
  const target = new THREE.Object3D();

  switch (config.type) {
    case "directional": {
      const dl = new THREE.DirectionalLight(color, config.intensity);
      dl.castShadow = config.castShadow;
      dl.position.set(0, 0, 0);
      applyLightDirection(dl, target, config.rotation);
      light = dl;
      break;
    }
    case "spot": {
      const sl = new THREE.SpotLight(color, config.intensity);
      sl.distance = config.distance;
      sl.decay = config.decay;
      sl.angle = THREE.MathUtils.degToRad(config.angle);
      sl.penumbra = config.penumbra;
      sl.castShadow = config.castShadow;
      sl.position.set(0, 0, 0);
      applyLightDirection(sl, target, config.rotation);
      light = sl;
      break;
    }
    case "point": {
      const pl = new THREE.PointLight(color, config.intensity, config.distance, config.decay);
      pl.castShadow = config.castShadow;
      pl.position.set(0, 0, 0);
      light = pl;
      break;
    }
  }

  const gizmo = createSceneLightGizmo(config, target, selected);

  group.add(light);
  if (config.type !== "point") {
    group.add(target);
    if (light instanceof THREE.DirectionalLight) {
      light.target = target;
    } else if (light instanceof THREE.SpotLight) {
      light.target = target;
    }
  }
  group.add(gizmo);

  return { config, group, light, target, gizmo };
}

export function syncSceneLightRuntime(runtime: SceneLightRuntime, config: SceneLightSettings, selected = false) {
  runtime.config = config;
  runtime.group.name = config.name;
  runtime.group.position.set(config.position[0], config.position[1], config.position[2]);

  const color = new THREE.Color(config.color);
  runtime.light.color.copy(color);
  runtime.light.intensity = config.intensity;
  runtime.light.castShadow = config.castShadow;

  if (runtime.light instanceof THREE.DirectionalLight) {
    applyLightDirection(runtime.light, runtime.target, config.rotation);
  } else if (runtime.light instanceof THREE.SpotLight) {
    runtime.light.distance = config.distance;
    runtime.light.decay = config.decay;
    runtime.light.angle = THREE.MathUtils.degToRad(config.angle);
    runtime.light.penumbra = config.penumbra;
    applyLightDirection(runtime.light, runtime.target, config.rotation);
  } else if (runtime.light instanceof THREE.PointLight) {
    runtime.light.distance = config.distance;
    runtime.light.decay = config.decay;
  }

  rebuildSceneLightGizmo(runtime, selected);
}

export function disposeSceneLightRuntime(runtime: SceneLightRuntime) {
  disposeObject3D(runtime.gizmo);
  runtime.group.removeFromParent();
}
