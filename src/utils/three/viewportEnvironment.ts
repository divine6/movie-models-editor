import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** 为 PBR 模型提供室内环境反射（无需外部 HDR 资源） */
export function createViewportEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const texture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();
  return texture;
}

export function disposeViewportEnvironment(texture: THREE.Texture | null) {
  texture?.dispose();
}
