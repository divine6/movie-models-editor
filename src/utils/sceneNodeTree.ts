import type { SceneAnimationNode, SceneGroupNode, SceneNode, SceneVideoNode } from "@/interface/project";

export interface SceneNodeTreeItem {
  node: SceneNode;
  depth: number;
}

export function isGroupNode(node: SceneNode): node is SceneGroupNode {
  return node.type === "group";
}

export function isVideoNode(node: SceneNode): node is SceneVideoNode {
  return node.type === "video";
}

export function isAnimationNode(node: SceneNode): node is SceneAnimationNode {
  return node.type === "animation";
}

export function getNodeById(nodes: SceneNode[], id: string): SceneNode | undefined {
  return nodes.find(n => n.id === id);
}

export function getAnimationNodes(nodes: SceneNode[]): SceneAnimationNode[] {
  return nodes.filter(isAnimationNode);
}

export function getVideoNodes(nodes: SceneNode[]): SceneVideoNode[] {
  return nodes.filter(isVideoNode);
}

export function getGroupNodes(nodes: SceneNode[]): SceneGroupNode[] {
  return nodes.filter(isGroupNode);
}

/** 根层节点（无 parentId），按 sortOrder 排序 */
export function getRootNodes(nodes: SceneNode[]): SceneNode[] {
  return nodes
    .filter(n => !n.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

/** 某父节点下的直接子节点 */
export function getChildNodes(nodes: SceneNode[], parentId?: string): SceneNode[] {
  return nodes
    .filter(n => (n.parentId || undefined) === (parentId || undefined))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

/** 树形扁平列表（用于 UI） */
export function flattenSceneNodeTree(nodes: SceneNode[], parentId?: string, depth = 0): SceneNodeTreeItem[] {
  const children = getChildNodes(nodes, parentId);
  const result: SceneNodeTreeItem[] = [];
  for (const node of children) {
    result.push({ node, depth });
    if (isGroupNode(node) || isVideoNode(node)) {
      result.push(...flattenSceneNodeTree(nodes, node.id, depth + 1));
    }
  }
  return result;
}

/** 获取所有子孙节点 ID */
export function getDescendantNodeIds(nodes: SceneNode[], nodeId: string): string[] {
  const result: string[] = [];
  for (const child of getChildNodes(nodes, nodeId)) {
    result.push(child.id);
    result.push(...getDescendantNodeIds(nodes, child.id));
  }
  return result;
}

export function getNodeDepth(nodes: SceneNode[], node: SceneNode): number {
  let depth = 0;
  let parentId = node.parentId;
  while (parentId) {
    depth++;
    const parent = getNodeById(nodes, parentId);
    if (!parent) break;
    parentId = parent.parentId;
  }
  return depth;
}

/** 动画节点的父视频 */
export function getParentVideoNode(nodes: SceneNode[], node: SceneNode): SceneVideoNode | null {
  if (isVideoNode(node)) return node;
  if (isAnimationNode(node)) {
    const parent = node.parentId ? getNodeById(nodes, node.parentId) : undefined;
    return parent && isVideoNode(parent) ? parent : null;
  }
  return null;
}

export function getParentVideoNodeById(nodes: SceneNode[], nodeId: string): SceneVideoNode | null {
  const node = getNodeById(nodes, nodeId);
  return node ? getParentVideoNode(nodes, node) : null;
}

/** 视频下动画节点，按时间排序 */
export function getVideoAnimations(nodes: SceneNode[], videoId: string): SceneAnimationNode[] {
  return getChildNodes(nodes, videoId).filter(isAnimationNode).sort((a, b) => a.startTime - b.startTime);
}

/** 当前视频下用于时间轴/播放的动画列表 */
export function getTimelineAnimations(nodes: SceneNode[], videoId?: string | null): SceneAnimationNode[] {
  if (!videoId) return [];
  return getVideoAnimations(nodes, videoId);
}

const TIME_EPS = 0.05;

/** 严格匹配：仅当 t 落在某动画节点时间区间内时返回，否则 null */
export function findAnimationAtTime(nodes: SceneNode[], videoId: string, t: number): SceneAnimationNode | null {
  const animations = getVideoAnimations(nodes, videoId);
  return animations.find(ch => t >= ch.startTime - TIME_EPS && t < ch.endTime) ?? null;
}

/** 取当前时间命中的最具体动画节点 */
export function resolveActiveAnimationAtTime(nodes: SceneNode[], videoId: string, t: number): SceneAnimationNode | null {
  const hit = findAnimationAtTime(nodes, videoId, t);
  if (hit) return hit;
  const animations = getVideoAnimations(nodes, videoId);
  if (animations.length === 0) return null;
  // 间隙时段：不回落到上一节点，由播放逻辑恢复默认模型态
  return null;
}

/** 校验父子关系是否合法 */
export function canNodeBeChildOf(parent: SceneNode | null, childType: SceneNode["type"]): boolean {
  if (!parent) return childType === "group" || childType === "video";
  if (isGroupNode(parent)) return childType === "group" || childType === "video";
  if (isVideoNode(parent)) return childType === "animation";
  return false;
}

/** 视频是否可拖放到目标（分组或根） */
export function canDropVideoInTarget(nodes: SceneNode[], videoId: string, targetParentId: string | null): boolean {
  const video = getNodeById(nodes, videoId);
  if (!video || !isVideoNode(video)) return false;
  if (videoId === targetParentId) return false;

  if (targetParentId) {
    const target = getNodeById(nodes, targetParentId);
    if (!target || !isGroupNode(target)) return false;
    const descendants = new Set(getDescendantNodeIds(nodes, videoId));
    if (descendants.has(targetParentId)) return false;
  }

  return video.parentId !== (targetParentId || undefined);
}

export function nextSortOrder(nodes: SceneNode[], parentId?: string): number {
  const siblings = getChildNodes(nodes, parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map(s => s.sortOrder)) + 1;
}
