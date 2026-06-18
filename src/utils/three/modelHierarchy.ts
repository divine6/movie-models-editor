import * as THREE from "three";

import type { ModelHierarchyNode } from "@/interface/project";

function isHierarchyExempt(obj: THREE.Object3D): boolean {
  return !!(obj.userData?.isEdgeLine || obj.userData?.isSelectionHelper);
}

function defaultObjectName(obj: THREE.Object3D): string {
  const named = obj.name?.trim();
  if (named) return named;
  if ((obj as THREE.Mesh).isMesh) return "Mesh";
  if (obj.type === "Bone") return "Bone";
  if (obj.type === "Group") return "Group";
  return obj.type || "Object";
}

function buildNode(
  obj: THREE.Object3D,
  modelId: string,
  parentPath: string,
  childIndex = 0
): ModelHierarchyNode | null {
  if (isHierarchyExempt(obj)) return null;

  const rawName = defaultObjectName(obj);
  const segment = obj.name?.trim() ? rawName : childIndex > 0 ? `${rawName}_${childIndex}` : rawName;
  const path = parentPath ? `${parentPath}/${segment}#${childIndex}` : segment;
  const id = `${modelId}::${path}`;

  obj.userData.modelId = modelId;
  obj.userData.nodePath = path;
  obj.userData.nodeId = id;
  obj.userData.baseLocalPos = [obj.position.x, obj.position.y, obj.position.z];
  obj.userData.baseLocalRot = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
  obj.userData.baseLocalScale = obj.scale.x;

  const isMesh = (obj as THREE.Mesh).isMesh;
  const objectType: ModelHierarchyNode["objectType"] = isMesh
    ? "mesh"
    : obj.type === "Bone"
      ? "bone"
      : obj.type === "Group" || obj.children.length > 0
        ? "group"
        : "other";

  const geometryKey = isMesh ? getGeometryKey(obj as THREE.Mesh) : undefined;

  const children: ModelHierarchyNode[] = [];
  for (let i = 0; i < obj.children.length; i++) {
    const node = buildNode(obj.children[i], modelId, path, i);
    if (node) children.push(node);
  }

  return { id, modelId, name: segment, path, objectType, children, geometryKey };
}

function normalizeHierarchyRoots(tree: ModelHierarchyNode): ModelHierarchyNode[] {
  const sceneLike = !tree.name || /^scene$/i.test(tree.name);
  if (tree.objectType === "group" && sceneLike) {
    if (tree.children.length === 1) return [tree.children[0]];
    if (tree.children.length > 1) return tree.children;
  }
  return [tree];
}

function normalizeModelDisplayName(name: string): string {
  return name.replace(/\..*$/, "").trim().toLowerCase();
}

function collapseRedundantModelRoot(nodes: ModelHierarchyNode[], modelDisplayName?: string): ModelHierarchyNode[] {
  if (!modelDisplayName?.trim() || nodes.length !== 1) return nodes;
  const root = nodes[0];
  if (normalizeModelDisplayName(root.name) !== normalizeModelDisplayName(modelDisplayName)) return nodes;
  if (root.children.length > 0) return root.children;
  return [];
}

function getMeshBaseName(name: string): string {
  return name.replace(/_\d+$/, "");
}

/** 同几何体、多材质拆分时的命名：X、X_1、X_2 */
function isMaterialSplitNameGroup(nodes: ModelHierarchyNode[]): boolean {
  if (nodes.length < 2) return false;
  if (!nodes.every(n => n.objectType === "mesh")) return false;
  const baseName = getMeshBaseName(nodes[0].name);
  if (!baseName) return false;
  const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(_\\d+)?$`);
  return nodes.every(n => pattern.test(n.name));
}

function getGeometryKey(mesh: THREE.Mesh): string | undefined {
  const geo = mesh.geometry;
  if (!geo) return undefined;
  const pos = geo.attributes.position;
  if (!pos) return geo.uuid;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return geo.uuid;
  const idx = geo.index;
  const idxCount = idx ? idx.count : pos.count;
  const attrKeys = Object.keys(geo.attributes).sort().join(",");
  const bbKey = [
    bb.min.x.toFixed(4),
    bb.min.y.toFixed(4),
    bb.min.z.toFixed(4),
    bb.max.x.toFixed(4),
    bb.max.y.toFixed(4),
    bb.max.z.toFixed(4)
  ].join(",");
  return `v${pos.count}:i${idxCount}:a${attrKeys}:bb${bbKey}`;
}

function meshesShareSameGeometry(a: ModelHierarchyNode, b: ModelHierarchyNode): boolean {
  if (a.geometryKey && b.geometryKey) return a.geometryKey === b.geometryKey;
  return false;
}

function meshesCanMergeAsMaterialSplit(group: ModelHierarchyNode[]): boolean {
  if (group.length < 2) return false;
  if (!group.every(n => n.objectType === "mesh")) return false;
  if (group.every(n => meshesShareSameGeometry(group[0], n))) return true;
  return isMaterialSplitNameGroup(group);
}

function flattenMergedNodeIds(node: ModelHierarchyNode): string[] {
  return node.mergedNodeIds?.length ? [...node.mergedNodeIds] : [node.id];
}

/** 合并同父级下几何体相同、仅材质不同的多个 Mesh */
function mergeMaterialSplitMeshes(children: ModelHierarchyNode[]): ModelHierarchyNode[] {
  const processed = children.map(child =>
    child.children.length ? { ...child, children: mergeMaterialSplitMeshes(child.children) } : child
  );

  const result: ModelHierarchyNode[] = [];
  const consumed = new Set<string>();

  for (let i = 0; i < processed.length; i++) {
    const node = processed[i];
    if (consumed.has(node.id)) continue;

    if (node.objectType !== "mesh") {
      result.push(node);
      continue;
    }

    const baseName = getMeshBaseName(node.name);
    const siblings = processed.filter(
      (n, j) =>
        j >= i &&
        !consumed.has(n.id) &&
        n.objectType === "mesh" &&
        getMeshBaseName(n.name) === baseName
    );

    if (!meshesCanMergeAsMaterialSplit(siblings) || siblings.length <= 1) {
      result.push(node);
      continue;
    }

    siblings.forEach(s => consumed.add(s.id));
    siblings.sort((a, b) => a.name.localeCompare(b.name));
    const primary = siblings[0];
    result.push({
      ...primary,
      name: baseName,
      mergedNodeIds: siblings.map(s => s.id)
    });
  }

  return result;
}

/**
 * Group 下若全部为同几何体的 Mesh（多材质分片），则折叠为父节点本身展示为 Mesh。
 * 例：PS03_down001 下 PS03_CELL002001 / _1 / _2 → 仅显示 PS03_down001 (Mesh)
 */
function absorbMaterialMeshChildrenIntoGroups(nodes: ModelHierarchyNode[]): ModelHierarchyNode[] {
  return nodes.map(absorbMaterialMeshChildrenIntoGroup);
}

function absorbMaterialMeshChildrenIntoGroup(node: ModelHierarchyNode): ModelHierarchyNode {
  const children = node.children.map(absorbMaterialMeshChildrenIntoGroup);

  if (node.objectType === "group" && children.length > 0) {
    const meshChildren = children.filter(c => c.objectType === "mesh");
    const shouldAbsorb =
      meshChildren.length === children.length &&
      meshChildren.length > 0 &&
      (meshChildren.length === 1 || meshesCanMergeAsMaterialSplit(meshChildren));
    if (shouldAbsorb) {
      const geometryKey = meshChildren[0].geometryKey;
      const mergedNodeIds = meshChildren.flatMap(flattenMergedNodeIds);
      return {
        ...node,
        objectType: "mesh",
        geometryKey,
        materialGroupHost: true,
        mergedNodeIds,
        children: []
      };
    }
  }

  return { ...node, children };
}

export function applyMergedNodeMetadata(root: THREE.Object3D, nodes: ModelHierarchyNode[]) {
  const nodeIdMap = new Map<string, THREE.Object3D>();
  root.traverse(obj => {
    if (obj.userData?.nodeId) nodeIdMap.set(obj.userData.nodeId as string, obj);
  });

  const walk = (list: ModelHierarchyNode[]) => {
    for (const node of list) {
      const hostObj = nodeIdMap.get(node.id);

      if (node.materialGroupHost && hostObj) {
        hostObj.userData.materialGroupHost = true;
        hostObj.userData.mergedNodeId = node.id;
        hostObj.userData.mergedNodeIds = node.mergedNodeIds;
        for (const id of node.mergedNodeIds ?? []) {
          const child = nodeIdMap.get(id);
          if (child) {
            child.userData.mergedNodeId = node.id;
            child.userData.mergedNodeIds = node.mergedNodeIds;
          }
        }
      } else if (node.mergedNodeIds?.length) {
        for (const id of node.mergedNodeIds) {
          const obj = nodeIdMap.get(id);
          if (obj) {
            obj.userData.mergedNodeId = node.id;
            obj.userData.mergedNodeIds = node.mergedNodeIds;
          }
        }
        if (hostObj) {
          delete hostObj.userData.materialGroupHost;
          delete hostObj.userData.mergedNodeId;
          delete hostObj.userData.mergedNodeIds;
        }
      } else if (hostObj) {
        delete hostObj.userData.materialGroupHost;
        delete hostObj.userData.mergedNodeId;
        delete hostObj.userData.mergedNodeIds;
      }
      walk(node.children);
    }
  };
  walk(nodes);
}

/** 收集与 nodeId 对应的 Object3D（合并材质 / 材质组宿主） */
export function collectObjectsForNodeId(root: THREE.Object3D, nodeId: string): THREE.Object3D[] {
  let host: THREE.Object3D | null = null;
  const parts: THREE.Object3D[] = [];

  root.traverse(obj => {
    if (isHierarchyExempt(obj)) return;
    if (obj.userData?.nodeId === nodeId) {
      if (obj.userData?.materialGroupHost) {
        host = obj;
      } else {
        parts.push(obj);
      }
    } else if (obj.userData?.mergedNodeId === nodeId && !obj.userData?.materialGroupHost) {
      parts.push(obj);
    }
  });

  if (host) return [host];
  return parts;
}

export function resolveDisplayNodeId(nodes: ModelHierarchyNode[], nodeId: string): string {
  const found = findHierarchyNode(nodes, nodeId);
  return found?.id ?? nodeId;
}

export function buildModelHierarchy(
  root: THREE.Object3D,
  modelId: string,
  modelDisplayName?: string
): ModelHierarchyNode[] {
  const tree = buildNode(root, modelId, "");
  if (!tree) return [];
  let nodes = normalizeHierarchyRoots(tree);
  nodes = collapseRedundantModelRoot(nodes, modelDisplayName);
  nodes = mergeMaterialSplitMeshes(nodes);
  nodes = absorbMaterialMeshChildrenIntoGroups(nodes);
  applyMergedNodeMetadata(root, nodes);
  return nodes;
}

export function findHierarchyNode(nodes: ModelHierarchyNode[], nodeId: string): ModelHierarchyNode | null {
  for (const node of nodes) {
    if (node.id === nodeId || node.mergedNodeIds?.includes(nodeId)) return node;
    const found = findHierarchyNode(node.children, nodeId);
    if (found) return found;
  }
  return null;
}

export function countHierarchyNodes(nodes: ModelHierarchyNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countHierarchyNodes(node.children), 0);
}
