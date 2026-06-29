import * as THREE from "three";

import type { SceneLightSettings } from "@/interface/sceneLight";

import { createMinimalGizmoLabel } from "./gizmoLabels";

const GIZMO_FLAG = { isSceneLightGizmo: true, isEditorGizmo: true };

function lineMat(color: THREE.Color, opacity = 0.7) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

function solidMat(color: THREE.Color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

function tagMesh(mesh: THREE.Object3D) {
  mesh.userData = GIZMO_FLAG;
  if ((mesh as THREE.Mesh).isMesh) {
    const m = mesh as THREE.Mesh;
    m.castShadow = false;
    m.receiveShadow = false;
  }
}

function addWireCone(parent: THREE.Group, dir: THREE.Vector3, height: number, radius: number, color: THREE.Color) {
  const geo = new THREE.ConeGeometry(radius, height, 12, 1, true);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const cone = new THREE.LineSegments(edges, lineMat(color, 0.65));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cone.position.copy(dir.clone().multiplyScalar(height * 0.5));
  tagMesh(cone);
  parent.add(cone);
}

function buildPointGizmo(gizmo: THREE.Group, color: THREE.Color, distance: number, selected: boolean) {
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), solidMat(color));
  tagMesh(core);
  gizmo.add(core);

  if (selected) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.13, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    tagMesh(ring);
    gizmo.add(ring);
  }

  if (distance > 0 && selected) {
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(distance, 10, 6)),
      lineMat(color, 0.18)
    );
    tagMesh(wire);
    gizmo.add(wire);
  }
}

function buildSpotGizmo(gizmo: THREE.Group, color: THREE.Color, config: SceneLightSettings, target: THREE.Object3D, selected: boolean) {
  const dir = target.position.clone().normalize();
  const coneLen = 1.1;
  const radius = Math.tan(THREE.MathUtils.degToRad(config.angle)) * coneLen;

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), solidMat(color));
  tagMesh(bulb);
  gizmo.add(bulb);

  addWireCone(gizmo, dir, coneLen, Math.max(radius, 0.05), color);

  if (selected) {
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), coneLen * 0.85, color.getHex(), 0.08, 0.05);
    tagMesh(arrow);
    gizmo.add(arrow);
  }
}

function buildDirectionalGizmo(gizmo: THREE.Group, color: THREE.Color, target: THREE.Object3D, selected: boolean) {
  const dir = target.position.clone().normalize();

  const icon = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), solidMat(color, 0.9));
  icon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
  tagMesh(icon);
  gizmo.add(icon);

  const shaft = new THREE.ArrowHelper(dir, new THREE.Vector3(), selected ? 1.35 : 1.05, color.getHex(), 0.1, 0.06);
  tagMesh(shaft);
  gizmo.add(shaft);
}

export function createSceneLightGizmo(config: SceneLightSettings, target: THREE.Object3D, selected = false): THREE.Group {
  const gizmo = new THREE.Group();
  gizmo.name = `${config.name}-gizmo`;
  gizmo.userData = GIZMO_FLAG;

  const color = new THREE.Color(config.color);
  if (config.type === "point") buildPointGizmo(gizmo, color, config.distance, selected);
  else if (config.type === "spot") buildSpotGizmo(gizmo, color, config, target, selected);
  else buildDirectionalGizmo(gizmo, color, target, selected);

  if (selected) {
    const axes = new THREE.AxesHelper(0.45);
    axes.userData = GIZMO_FLAG;
    gizmo.add(axes);

    const label = createMinimalGizmoLabel(config.name);
    label.position.y = 0.38;
    gizmo.add(label);
  }

  return gizmo;
}
