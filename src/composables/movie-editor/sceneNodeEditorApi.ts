/**
 * 场景节点编辑 API — 从 useMovieEditor 抽离，降低主文件复杂度
 */
import { ElMessageBox } from "element-plus";
import type { Ref } from "vue";

import type { ProjectDetail, SceneAnimationNode, SceneNode, SceneVideoNode } from "@/interface/project";
import { useSceneNodeStore } from "@/stores/modules/sceneNode";
import { ensureProjectNodes } from "@/utils/sceneMigration";
import {
  canDropVideoInTarget,
  getChildNodes,
  getDescendantNodeIds,
  getNodeById,
  getRootNodes,
  getTimelineAnimations,
  getVideoAnimations,
  isAnimationNode,
  isGroupNode,
  isVideoNode,
  nextSortOrder
} from "@/utils/sceneNodeTree";
import { toastShow } from "@/utils/toast";

type Deps = {
  currProj: Ref<ProjectDetail | null | undefined>;
  nodes: Ref<SceneNode[]>;
  activeVideoId: Ref<string | null>;
  selectedNodeId: Ref<string | null>;
  selectedChapterId: Ref<string | null>;
  expandedNodeIds: Ref<Set<string>>;
  sceneNodeDraggingId: Ref<string | null>;
  sceneNodeDropTargetId: Ref<string | null>;
  videoNodeUploadTargetId: Ref<string | null>;
  duration: Ref<number>;
  getNextChapterRange: (
    parentVideoId?: string
  ) => { startTime: number; endTime: number; splitChapter?: SceneAnimationNode } | null;
  ensureChapterModelConfigsMap: (ch: SceneAnimationNode) => void;
  syncChapterForm: (ch: SceneAnimationNode) => void;
  applyChapter: (ch: SceneAnimationNode) => void;
  applyVideoNodePlayback: (video: SceneVideoNode) => void;
  syncVideoElementSrc: (src?: string) => void;
  resetAllModelsToDefault: () => void;
  onClearAnimationSelection: () => void;
  hideVideoPip?: () => void;
  videoOnlyMode: Ref<boolean>;
  chapterFormRevision: Ref<number>;
};

export function createSceneNodeEditorApi(deps: Deps) {
  const nStore = useSceneNodeStore();

  function ensureNodes() {
    if (!deps.currProj.value) return [];
    ensureProjectNodes(deps.currProj.value);
    return deps.currProj.value.nodes;
  }

  function getSceneNodeChildren(nodeId: string) {
    return getChildNodes(deps.nodes.value, nodeId);
  }

  function rootSceneNodes() {
    return getRootNodes(deps.nodes.value);
  }

  function isSceneNodeExpanded(id: string) {
    return deps.expandedNodeIds.value.has(id);
  }

  function collapseExpandableDescendants(nodeId: string, set: Set<string>) {
    for (const child of getChildNodes(deps.nodes.value, nodeId)) {
      if (isGroupNode(child) || isVideoNode(child)) {
        set.delete(child.id);
        collapseExpandableDescendants(child.id, set);
      }
    }
  }

  function toggleSceneNodeExpanded(id: string, options?: { accordion?: boolean }) {
    const node = getNodeById(deps.nodes.value, id);
    if (!node) return;
    const next = new Set(deps.expandedNodeIds.value);
    const expanding = !next.has(id);

    if (expanding && options?.accordion) {
      const siblings = getChildNodes(deps.nodes.value, node.parentId);
      for (const sibling of siblings) {
        if (sibling.id === id) continue;
        if (isGroupNode(sibling) || isVideoNode(sibling)) {
          collapseExpandableDescendants(sibling.id, next);
          next.delete(sibling.id);
        }
      }
    }

    if (expanding) next.add(id);
    else {
      collapseExpandableDescendants(id, next);
      next.delete(id);
    }
    deps.expandedNodeIds.value = next;
  }

  function expandAncestors(nodeId: string) {
    const next = new Set(deps.expandedNodeIds.value);
    let current = getNodeById(deps.nodes.value, nodeId);
    while (current?.parentId) {
      next.add(current.parentId);
      current = getNodeById(deps.nodes.value, current.parentId);
    }
    deps.expandedNodeIds.value = next;
  }

  function addExpandedNode(id: string) {
    if (deps.expandedNodeIds.value.has(id)) return;
    const next = new Set(deps.expandedNodeIds.value);
    next.add(id);
    deps.expandedNodeIds.value = next;
  }

  function isSceneNodeSelected(node: SceneNode) {
    return deps.selectedNodeId.value === node.id;
  }

  function getVideoNodeSrc(node: SceneNode) {
    return isVideoNode(node) ? node.videoSrc : null;
  }

  function setActiveVideo(videoId: string | null, options?: { syncElement?: boolean }) {
    deps.activeVideoId.value = videoId;
    const video = videoId ? getNodeById(deps.nodes.value, videoId) : null;
    if (video && isVideoNode(video)) {
      const storedDur = video.videoDuration;
      if (Number.isFinite(storedDur) && storedDur > 0) deps.duration.value = storedDur;
      // 默认不挂载 video 元素；仅显式要求时同步（点击视频节点 / 预览）
      if (options?.syncElement && video.videoSrc) {
        deps.syncVideoElementSrc(video.videoSrc);
      }
    }
  }

  function selectSceneNode(node: SceneNode) {
    deps.selectedNodeId.value = node.id;
    expandAncestors(node.id);

    if (isAnimationNode(node)) {
      deps.selectedChapterId.value = node.id;
      deps.videoOnlyMode.value = false;
      if (node.parentId) setActiveVideo(node.parentId, { syncElement: true });
      deps.applyChapter(node);
      return;
    }

    deps.selectedChapterId.value = null;
    deps.onClearAnimationSelection();
    deps.resetAllModelsToDefault();

    if (isVideoNode(node)) {
      deps.videoOnlyMode.value = true;
      setActiveVideo(node.id, { syncElement: false });
      deps.applyVideoNodePlayback(node);
      return;
    }

    // 分组或其他节点：隐藏视频窗，仅展示默认模型
    deps.videoOnlyMode.value = false;
    deps.hideVideoPip?.();
  }

  function addGroupNode(parentId?: string) {
    const proj = deps.currProj.value;
    if (!proj) return;
    ensureNodes();
    const sortOrder = nextSortOrder(proj.nodes, parentId);
    const count = getChildNodes(proj.nodes, parentId).filter(isGroupNode).length + 1;
    const group = nStore.createGroup(proj.id, `分组 ${count}`, parentId, sortOrder);
    proj.nodes.push(group);
    if (parentId) expandAncestors(parentId);
    addExpandedNode(group.id);
    selectSceneNode(group);
    toastShow("已添加分组");
  }

  function addVideoNode(parentId?: string) {
    const proj = deps.currProj.value;
    if (!proj) return;
    ensureNodes();
    const sortOrder = nextSortOrder(proj.nodes, parentId);
    const count = getChildNodes(proj.nodes, parentId).filter(isVideoNode).length + 1;
    const video = nStore.createVideo(proj.id, `视频 ${count}`, parentId, sortOrder);
    proj.nodes.push(video);
    if (parentId) expandAncestors(parentId);
    addExpandedNode(video.id);
    selectSceneNode(video);
    toastShow("已添加视频节点");
  }

  function addAnimationNode(videoId: string) {
    const proj = deps.currProj.value;
    if (!proj) return;
    const video = getNodeById(proj.nodes, videoId);
    if (!video || !isVideoNode(video)) return;

    if (!video.videoSrc || video.videoDuration <= 0) {
      toastShow("请先为该视频上传视频文件", "warning");
      return;
    }

    const nextRange = deps.getNextChapterRange(videoId);
    if (!nextRange) {
      toastShow("视频时间已无可用区间，无法再添加动画节点", "warning");
      return;
    }

    if (nextRange.splitChapter) {
      nStore.updateNode(nextRange.splitChapter, { endTime: nextRange.startTime });
    }

    const animCount = getVideoAnimations(proj.nodes, videoId).length;
    const anim = nStore.createAnimation(
      proj.id,
      `动画 ${animCount + 1}`,
      videoId,
      nextRange.startTime,
      nextRange.endTime,
      nextSortOrder(proj.nodes, videoId)
    );
    deps.ensureChapterModelConfigsMap(anim);
    proj.nodes.push(anim);
    expandAncestors(videoId);
    addExpandedNode(videoId);
    selectSceneNode(anim);
    deps.chapterFormRevision.value++;
    toastShow("已添加动画节点");
  }

  function deleteSceneNode(node: SceneNode) {
    const label = node.type === "group" ? "分组" : node.type === "video" ? "视频" : "动画节点";
    ElMessageBox.confirm(`删除${label}"${node.name}"？`, "确认", { type: "warning" })
      .then(() => {
        const proj = deps.currProj.value;
        if (!proj) return;
        const deleteIds = new Set([node.id, ...getDescendantNodeIds(proj.nodes, node.id)]);
        proj.nodes = proj.nodes.filter(n => !deleteIds.has(n.id));
        proj.subtitles = proj.subtitles.filter(s => !deleteIds.has(s.parentNodeId));

        if (deps.selectedNodeId.value && deleteIds.has(deps.selectedNodeId.value)) {
          deps.selectedNodeId.value = null;
          deps.selectedChapterId.value = null;
        }
        if (deps.activeVideoId.value && deleteIds.has(deps.activeVideoId.value)) {
          const fallback = proj.nodes.find(isVideoNode);
          setActiveVideo(fallback?.id ?? null);
        }
        toastShow("已删除");
      })
      .catch(() => {});
  }

  function moveSceneVideoToGroup(videoId: string, targetParentId: string | null) {
    const proj = deps.currProj.value;
    if (!proj) return;
    const normalizedTarget = targetParentId === "__root__" ? null : targetParentId;
    if (!canDropVideoInTarget(proj.nodes, videoId, normalizedTarget)) return;

    const video = getNodeById(proj.nodes, videoId);
    if (!video || !isVideoNode(video)) return;

    video.parentId = normalizedTarget || undefined;
    video.sortOrder = nextSortOrder(proj.nodes, normalizedTarget || undefined);
    video.updatedAt = new Date().toISOString();

    if (normalizedTarget) expandAncestors(normalizedTarget);
    toastShow("视频已移动");
  }

  function startDragSceneVideo(videoId: string) {
    deps.sceneNodeDraggingId.value = videoId;
  }

  function endDragSceneVideo() {
    deps.sceneNodeDraggingId.value = null;
    deps.sceneNodeDropTargetId.value = null;
  }

  function setSceneNodeDropTarget(id: string | null) {
    deps.sceneNodeDropTargetId.value = id;
  }

  function triggerVideoNodeUpload(videoId: string) {
    deps.videoNodeUploadTargetId.value = videoId;
    const input = document.getElementById("scene-video-file-input") as HTMLInputElement | null;
    input?.click();
  }

  function setVideoNodeInfo(video: SceneVideoNode, src: string, dur: number, w: number, h: number) {
    const srcChanged = video.videoSrc !== src;
    nStore.setVideoInfo(video, src, dur, w, h);
    if (deps.activeVideoId.value === video.id) {
      deps.duration.value = Number.isFinite(dur) && dur > 0 ? dur : deps.duration.value;
      // 元数据回调时 src 未变，勿再次 load()，否则会陷入加载循环
      if (srcChanged) deps.syncVideoElementSrc(src);
    }
  }

  return {
    getSceneNodeChildren,
    rootSceneNodes,
    isSceneNodeExpanded,
    toggleSceneNodeExpanded,
    isSceneNodeSelected,
    getVideoNodeSrc,
    selectSceneNode,
    addGroupNode,
    addVideoNode,
    addAnimationNode,
    deleteSceneNode,
    moveSceneVideoToGroup,
    startDragSceneVideo,
    endDragSceneVideo,
    setSceneNodeDropTarget,
    triggerVideoNodeUpload,
    setVideoNodeInfo,
    setActiveVideo,
    getTimelineForActiveVideo: () => getTimelineAnimations(deps.nodes.value, deps.activeVideoId.value)
  };
}
