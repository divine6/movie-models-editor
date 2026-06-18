<template>
  <div class="three-scene" ref="containerRef">
    <canvas ref="canvasRef" class="three-canvas"></canvas>
    <slot></slot>
  </div>
</template>

<script setup lang="ts" name="ThreeScene">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { onMounted, onUnmounted, provide, ref, watch } from "vue";

import type { CameraConfig, Model, ModelConfig } from "@/interface/project";
import { DEFAULT_CAMERA } from "@/utils/three/constants";

// Props
const props = defineProps<{
  models?: Model[];
  cameraConfig?: CameraConfig;
  currentChapterId?: string;
  modelConfigs?: Record<string, ModelConfig>;
  width?: number;
  height?: number;
}>();

// Emits
const emit = defineEmits<{
  (e: "cameraChange", config: CameraConfig): void;
  (e: "modelLoaded", modelId: string): void;
  (e: "render"): void;
}>();

// Refs
const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

// Three.js objects
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let gltfLoader: GLTFLoader;
let dracoLoader: DRACOLoader;
let meshes: Map<string, THREE.Mesh | THREE.Group> = new Map();
let animationFrameId: number;

// Provide scene context to children
provide("threeScene", {
  getScene: () => scene,
  getCamera: () => camera,
  getRenderer: () => renderer,
  getControls: () => controls,
  getMeshes: () => meshes
});

/** 初始化场景 */
const initScene = () => {
  if (!containerRef.value || !canvasRef.value) return;

  const width = props.width || containerRef.value.clientWidth;
  const height = props.height || containerRef.value.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f0f14);

  // Camera
  const fov = props.cameraConfig?.fov || DEFAULT_CAMERA.fov;
  camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1000);
  const pos = props.cameraConfig?.position || DEFAULT_CAMERA.position;
  camera.position.set(pos[0], pos[1], pos[2]);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  const target = props.cameraConfig?.target || DEFAULT_CAMERA.target;
  controls.target.set(target[0], target[1], target[2]);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // Grid helper
  const gridHelper = new THREE.GridHelper(20, 20, 0x2a2a40, 0x2a2a40);
  scene.add(gridHelper);

  // GLTF Loader + Draco support for compressed GLB
  gltfLoader = new GLTFLoader();
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  // Animate
  animate();
};

/** 动画循环 */
const animate = () => {
  animationFrameId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  emit("render");
};

/** 创建 Primitive 几何体 */
const createPrimitiveMesh = (model: Model): THREE.Mesh => {
  let geometry: THREE.BufferGeometry;

  switch (model.type) {
    case "cube":
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case "sphere":
      geometry = new THREE.SphereGeometry(0.5, 32, 32);
      break;
    case "cylinder":
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      break;
    case "torus":
      geometry = new THREE.TorusGeometry(0.4, 0.15, 16, 48);
      break;
    case "cone":
      geometry = new THREE.ConeGeometry(0.5, 1, 32);
      break;
    case "dodecahedron":
      geometry = new THREE.DodecahedronGeometry(0.5);
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(model.color),
    metalness: 0.3,
    roughness: 0.7
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(model.basePosition[0], model.basePosition[1], model.basePosition[2]);
  mesh.userData.modelId = model.id;

  return mesh;
};

/** 加载 GLB 模型 */
const loadGLBModel = async (model: Model): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    if (!model.url) {
      reject(new Error("Model URL is missing"));
      return;
    }

    gltfLoader.load(
      model.url,
      gltf => {
        const group = gltf.scene;
        group.userData.modelId = model.id;
        group.userData.animations = gltf.animations;

        // 计算地面位置
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.groundY = -box.min.y;
        group.position.set(model.basePosition[0], model.basePosition[1] + model.groundY, model.basePosition[2]);

        emit("modelLoaded", model.id);
        resolve(group);
      },
      undefined,
      reject
    );
  });
};

/** 添加模型到场景 */
const addModelToScene = async (model: Model) => {
  let mesh: THREE.Mesh | THREE.Group;

  if (model.type === "custom" && model.url) {
    mesh = await loadGLBModel(model);
  } else {
    mesh = createPrimitiveMesh(model);
  }

  scene.add(mesh);
  meshes.set(model.id, mesh);
};

/** 移除模型 */
const removeModelFromScene = (modelId: string) => {
  const mesh = meshes.get(modelId);
  if (mesh) {
    scene.remove(mesh);
    // 释放资源
    if (mesh instanceof THREE.Mesh) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    meshes.delete(modelId);
  }
};

/** 更新模型配置 */
const updateModelConfig = (modelId: string, config: ModelConfig) => {
  const mesh = meshes.get(modelId);
  if (!mesh) return;

  mesh.visible = config.visible;

  // 位置偏移
  const model = props.models?.find(m => m.id === modelId);
  if (model) {
    const baseY = model.basePosition[1] + (model.type === "custom" ? model.groundY : 0);
    mesh.position.set(
      model.basePosition[0] + config.posOffset[0],
      baseY + config.posOffset[1],
      model.basePosition[2] + config.posOffset[2]
    );
  }

  // 缩放
  mesh.scale.setScalar(config.scale);

  // 高亮效果
  if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
    mesh.material.emissive = new THREE.Color(config.highlight ? 0x333333 : 0x000000);
  }
};

/** 设置相机 */
const setCamera = (config: CameraConfig) => {
  camera.position.set(config.position[0], config.position[1], config.position[2]);
  controls.target.set(config.target[0], config.target[1], config.target[2]);
  camera.fov = config.fov;
  camera.updateProjectionMatrix();
};

/** 获取当前相机配置 */
const getCameraConfig = (): CameraConfig => {
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    fov: camera.fov
  };
};

/** 相机动画过渡 */
const animateCameraTo = (targetConfig: CameraConfig, duration: number = 1000) => {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const startFov = camera.fov;

  const endPos = new THREE.Vector3(targetConfig.position[0], targetConfig.position[1], targetConfig.position[2]);
  const endTarget = new THREE.Vector3(targetConfig.target[0], targetConfig.target[1], targetConfig.target[2]);
  const endFov = targetConfig.fov;

  const startTime = performance.now();

  const animateTransition = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(startPos, endPos, eased);
    controls.target.lerpVectors(startTarget, endTarget, eased);
    camera.fov = startFov + (endFov - startFov) * eased;
    camera.updateProjectionMatrix();

    if (progress < 1) {
      requestAnimationFrame(animateTransition);
    } else {
      emit("cameraChange", targetConfig);
    }
  };

  animateTransition();
};

/** 处理窗口大小变化 */
const handleResize = () => {
  if (!containerRef.value) return;

  const width = props.width || containerRef.value.clientWidth;
  const height = props.height || containerRef.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};

// Watch models
watch(
  () => props.models,
  async (newModels, oldModels) => {
    // 移除旧模型
    oldModels?.forEach(model => {
      if (!newModels?.find(m => m.id === model.id)) {
        removeModelFromScene(model.id);
      }
    });

    // 添加新模型
    newModels?.forEach(async model => {
      if (!meshes.has(model.id)) {
        await addModelToScene(model);
      }
    });
  },
  { deep: true }
);

// Watch camera config
watch(
  () => props.cameraConfig,
  newConfig => {
    if (newConfig) {
      setCamera(newConfig);
    }
  },
  { deep: true }
);

// Watch model configs
watch(
  () => props.modelConfigs,
  newConfigs => {
    if (newConfigs) {
      Object.entries(newConfigs).forEach(([modelId, config]) => {
        updateModelConfig(modelId, config);
      });
    }
  },
  { deep: true }
);

// Lifecycle
onMounted(() => {
  initScene();
  props.models?.forEach(async model => {
    await addModelToScene(model);
  });
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  // 清理所有模型
  meshes.forEach((_, id) => removeModelFromScene(id));
  renderer.dispose();
  dracoLoader?.dispose?.();
});

// Expose methods
defineExpose({
  addModelToScene,
  removeModelFromScene,
  updateModelConfig,
  setCamera,
  getCameraConfig,
  animateCameraTo,
  getScene: () => scene,
  getCamera: () => camera,
  getRenderer: () => renderer
});
</script>

<style lang="scss" scoped>
.three-scene {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.three-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
