import * as THREE from "three";

import { disposeObject3D } from "./gizmoLabels";

export interface EnvReflectionProbe {
  group: THREE.Group;
  ball: THREE.Mesh;
}

/** Unity 风格：仅小金属球 + 细线框，无场景内大段文字 */
export function createEnvReflectionProbe(): EnvReflectionProbe {
  const group = new THREE.Group();
  group.name = "EnvReflectionProbe";
  group.userData.isEnvProbe = true;

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 24),
    new THREE.MeshStandardMaterial({
      metalness: 1,
      roughness: 0.04,
      envMapIntensity: 1
    })
  );
  ball.name = "EnvReflectionBall";
  ball.userData.isEnvProbe = true;
  ball.castShadow = false;
  ball.receiveShadow = false;

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.SphereGeometry(0.19, 12, 8)),
    new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.35, depthWrite: false })
  );
  wire.userData.isEnvProbe = true;

  group.add(ball, wire);
  return { group, ball };
}

export function disposeEnvReflectionProbe(probe: EnvReflectionProbe) {
  disposeObject3D(probe.group);
  probe.group.removeFromParent();
}
