import * as THREE from "three";

/** Unity 风格：无背景、小字号、仅选中时显示 */
export function createMinimalGizmoLabel(text: string) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 11;
  const padding = 4;
  ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width + padding * 2);
  canvas.height = fontSize + padding * 2;

  ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = 2;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(0.42 * aspect, 0.42, 1);
  sprite.renderOrder = 999;
  sprite.userData.isEditorGizmo = true;
  return sprite;
}

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else if (mat) mat.dispose();
    if (obj instanceof THREE.Sprite) {
      (obj.material as THREE.SpriteMaterial).map?.dispose();
    }
    if (obj instanceof THREE.ArrowHelper) {
      obj.line.geometry.dispose();
      (obj.line.material as THREE.Material).dispose();
      obj.cone.geometry.dispose();
      (obj.cone.material as THREE.Material).dispose();
    }
    if (obj instanceof THREE.AxesHelper) {
      obj.geometry.dispose();
      (obj.material as THREE.Material).dispose();
    }
  });
}
