import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { onMounted, onUnmounted, ref, shallowRef } from "vue";

import type { CameraConfig, Model, ModelConfig } from "@/interface/project";
import { DEFAULT_CAMERA } from "@/utils/three/constants";

export function useThreeScene() {
  const scene = shallowRef<THREE.Scene | null>(null);
  const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
  const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
  const controls = shallowRef<OrbitControls | null>(null);

  const meshes = new Map<string, THREE.Mesh | THREE.Group>();
  const animationId = ref<number>(0);

  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  /** 初始化场景 */
  const init = (container: HTMLElement, width?: number, height?: number) => {
    const w = width || container.clientWidth;
    const h = height || container.clientHeight;

    // Scene
    scene.value = new THREE.Scene();
    scene.value.background = new THREE.Color(0x0f0f14);

    // Camera
    camera.value = new THREE.PerspectiveCamera(DEFAULT_CAMERA.fov, w / h, 0.1, 1000);
    camera.value.position.set(DEFAULT_CAMERA.position[0], DEFAULT_CAMERA.position[1], DEFAULT_CAMERA.position[2]);

    // Renderer
    renderer.value = new THREE.WebGLRenderer({ antialias: true });
    renderer.value.setSize(w, h);
    renderer.value.setPixelRatio(window.devicePixelRatio);
    renderer.value.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.value.domElement);

    // Controls
    controls.value = new OrbitControls(camera.value, renderer.value.domElement);
    controls.value.target.set(DEFAULT_CAMERA.target[0], DEFAULT_CAMERA.target[1], DEFAULT_CAMERA.target[2]);
    controls.value.enableDamping = true;
    controls.value.dampingFactor = 0.05;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.value.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7.5);
    scene.value.add(directional);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x2a2a40, 0x2a2a40);
    scene.value.add(grid);

    // Animation loop
    animate();
  };

  /** 动画循环 */
  const animate = () => {
    animationId.value = requestAnimationFrame(animate);
    if (controls.value) {
      controls.value.update();
    }
    if (renderer.value && scene.value && camera.value) {
      renderer.value.render(scene.value, camera.value);
    }
  };

  /** 创建 Primitive 几何体 */
  const createPrimitive = (model: Model): THREE.Mesh => {
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

  /** 加载 GLB */
  const loadGLB = async (model: Model): Promise<THREE.Group> => {
    return new Promise((resolve, reject) => {
      if (!model.url) {
        reject(new Error("Model URL missing"));
        return;
      }

      gltfLoader.load(
        model.url,
        gltf => {
          const group = gltf.scene;
          group.userData.modelId = model.id;
          group.userData.animations = gltf.animations;

          // Calculate ground Y
          const box = new THREE.Box3().setFromObject(group);
          model.groundY = -box.min.y;
          group.position.set(model.basePosition[0], model.basePosition[1] + model.groundY, model.basePosition[2]);

          resolve(group);
        },
        undefined,
        reject
      );
    });
  };

  /** 添加模型 */
  const addModel = async (model: Model) => {
    if (!scene.value) return;

    let mesh: THREE.Mesh | THREE.Group;
    if (model.type === "custom" && model.url) {
      mesh = await loadGLB(model);
    } else {
      mesh = createPrimitive(model);
    }

    scene.value.add(mesh);
    meshes.set(model.id, mesh);
  };

  /** 移除模型 */
  const removeModel = (modelId: string) => {
    if (!scene.value) return;

    const mesh = meshes.get(modelId);
    if (mesh) {
      scene.value.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      meshes.delete(modelId);
    }
  };

  /** 更新模型配置 */
  const updateModelConfig = (modelId: string, config: ModelConfig, basePosition?: [number, number, number], groundY?: number) => {
    const mesh = meshes.get(modelId);
    if (!mesh) return;

    mesh.visible = config.visible;

    if (basePosition) {
      const y = basePosition[1] + (groundY || 0) + config.posOffset[1];
      mesh.position.set(basePosition[0] + config.posOffset[0], y, basePosition[2] + config.posOffset[2]);
    }

    mesh.scale.setScalar(config.scale);

    if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissive = new THREE.Color(config.highlight ? 0x333333 : 0x000000);
    }
  };

  /** 设置相机 */
  const setCamera = (config: CameraConfig) => {
    if (!camera.value || !controls.value) return;

    camera.value.position.set(config.position[0], config.position[1], config.position[2]);
    controls.value.target.set(config.target[0], config.target[1], config.target[2]);
    camera.value.fov = config.fov;
    camera.value.updateProjectionMatrix();
  };

  /** 获取相机配置 */
  const getCameraConfig = (): CameraConfig | null => {
    if (!camera.value || !controls.value) return null;

    return {
      position: [camera.value.position.x, camera.value.position.y, camera.value.position.z],
      target: [controls.value.target.x, controls.value.target.y, controls.value.target.z],
      fov: camera.value.fov
    };
  };

  /** 相机动画 */
  const animateCameraTo = (targetConfig: CameraConfig, duration = 1000) => {
    if (!camera.value || !controls.value) return;

    const startPos = camera.value.position.clone();
    const startTarget = controls.value.target.clone();
    const startFov = camera.value.fov;

    const endPos = new THREE.Vector3(targetConfig.position[0], targetConfig.position[1], targetConfig.position[2]);
    const endTarget = new THREE.Vector3(targetConfig.target[0], targetConfig.target[1], targetConfig.target[2]);
    const endFov = targetConfig.fov;

    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      camera.value!.position.lerpVectors(startPos, endPos, eased);
      controls.value!.target.lerpVectors(startTarget, endTarget, eased);
      camera.value!.fov = startFov + (endFov - startFov) * eased;
      camera.value!.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    tick();
  };

  /** 处理窗口大小变化 */
  const handleResize = (width: number, height: number) => {
    if (!camera.value || !renderer.value) return;

    camera.value.aspect = width / height;
    camera.value.updateProjectionMatrix();
    renderer.value.setSize(width, height);
  };

  /** 清理 */
  const dispose = () => {
    cancelAnimationFrame(animationId.value);

    meshes.forEach((_, id) => removeModel(id));

    if (renderer.value) {
      renderer.value.dispose();
    }

    scene.value = null;
    camera.value = null;
    renderer.value = null;
    controls.value = null;
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    meshes,
    init,
    addModel,
    removeModel,
    updateModelConfig,
    setCamera,
    getCameraConfig,
    animateCameraTo,
    handleResize,
    dispose
  };
}
