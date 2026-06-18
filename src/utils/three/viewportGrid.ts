import * as THREE from "three";

import { SCENE_GRID_COLOR, SCENE_GRID_COLOR_CENTER } from "./constants";

function createGridMaterial(color: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    depthWrite: false,
    fog: true,
    toneMapped: false
  });
}

/**
 * 自定义灰色网格（不用 GridHelper 顶点色，避免渲染偏白）
 */
export function createViewportGrid(
  size: number,
  divisions: number,
  colorCenter = SCENE_GRID_COLOR_CENTER,
  colorGrid = SCENE_GRID_COLOR
): THREE.Group {
  const group = new THREE.Group();
  const step = size / divisions;
  const half = size / 2;
  const centerIdx = divisions / 2;

  const centerVertices: number[] = [];
  const gridVertices: number[] = [];

  for (let i = 0, k = -half; i <= divisions; i++, k += step) {
    const isCenter = i === centerIdx;
    const bucket = isCenter ? centerVertices : gridVertices;
    bucket.push(-half, 0, k, half, 0, k);
    bucket.push(k, 0, -half, k, 0, half);
  }

  if (gridVertices.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(gridVertices, 3));
    group.add(new THREE.LineSegments(geometry, createGridMaterial(colorGrid)));
  }

  if (centerVertices.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(centerVertices, 3));
    group.add(new THREE.LineSegments(geometry, createGridMaterial(colorCenter)));
  }

  return group;
}

export function disposeViewportGrid(grid: THREE.Object3D) {
  grid.traverse(child => {
    const line = child as THREE.LineSegments;
    if (!line.isLineSegments && !(child as THREE.Line).isLine) return;
    line.geometry?.dispose();
    const mat = line.material;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else mat?.dispose();
  });
}
