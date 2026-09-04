import { defineStore } from "pinia";

import type { SceneAnimationNode, SceneGroupNode, SceneNode, SceneVideoNode } from "@/interface/project";
import { CHAPTER_TAG_COLOR, DEFAULT_CAMERA } from "@/utils/three/constants";

import piniaPersistConfig from "../helper/persist";

interface SceneNodeState {
  nodeIdCounter: number;
}

/** 从 grp_12 / vid_3 / anim_50 中取数字后缀 */
function parseNodeIdCounter(id: string | null | undefined): number {
  if (!id || typeof id !== "string") return 0;
  const m = /^(?:grp|vid|anim)_(\d+)$/.exec(id.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export const useSceneNodeStore = defineStore("sceneNode", {
  state: (): SceneNodeState => ({
    nodeIdCounter: 0
  }),

  actions: {
    /** 加载/导入场景后调用：计数器至少高于已有节点，避免再生成重复 PRIMARY */
    syncCounterFromNodes(nodes: SceneNode[] | null | undefined) {
      let max = this.nodeIdCounter;
      for (const n of nodes || []) {
        max = Math.max(max, parseNodeIdCounter(n.id));
      }
      if (max > this.nodeIdCounter) this.nodeIdCounter = max;
    },

    /**
     * scene_node.id 在库内全局唯一。本地计数器只保证本机不重复，
     * 新建场景落库前跳到时间戳，避免 anim_58 这类序号撞上其它场景。
     */
    bumpCounterForGlobalUniqueness() {
      const floor = Date.now();
      if (this.nodeIdCounter < floor) this.nodeIdCounter = floor;
    },

    nextUniqueId(prefix: "grp" | "vid" | "anim", existingIds?: Set<string>) {
      let id = "";
      do {
        id = `${prefix}_${++this.nodeIdCounter}`;
      } while (existingIds?.has(id));
      return id;
    },

    createGroup(
      projectId: string,
      name: string,
      parentId?: string,
      sortOrder = 0,
      existingIds?: Set<string>
    ): SceneGroupNode {
      const id = this.nextUniqueId("grp", existingIds);
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        name,
        type: "group",
        parentId,
        sortOrder,
        createdAt: now,
        updatedAt: now
      };
    },

    createVideo(
      projectId: string,
      name: string,
      parentId?: string,
      sortOrder = 0,
      existingIds?: Set<string>
    ): SceneVideoNode {
      const id = this.nextUniqueId("vid", existingIds);
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        name,
        type: "video",
        parentId,
        sortOrder,
        videoSrc: null,
        videoDuration: 0,
        videoWidth: 0,
        videoHeight: 0,
        videoDisplayWidth: 0,
        createdAt: now,
        updatedAt: now
      };
    },

    createAnimation(
      projectId: string,
      name: string,
      parentVideoId: string,
      startTime: number,
      endTime: number,
      sortOrder = 0,
      existingIds?: Set<string>
    ): SceneAnimationNode {
      const id = this.nextUniqueId("anim", existingIds);
      const now = new Date().toISOString();
      return {
        id,
        projectId,
        name,
        type: "animation",
        parentId: parentVideoId,
        sortOrder,
        subtitle: "",
        startTime,
        endTime,
        color: CHAPTER_TAG_COLOR,
        camera: {
          position: [...DEFAULT_CAMERA.position],
          target: [...DEFAULT_CAMERA.target],
          fov: DEFAULT_CAMERA.fov,
          transitionSec: DEFAULT_CAMERA.transitionSec
        },
        modelConfigs: {},
        clips: [],
        createdAt: now,
        updatedAt: now
      };
    },

    updateNode(node: SceneNode, updates: Partial<SceneNode>) {
      Object.assign(node, updates, { updatedAt: new Date().toISOString() });
    },

    setVideoInfo(
      video: SceneVideoNode,
      videoSrc: string,
      duration: number,
      width: number,
      height: number,
      displayWidth?: number
    ) {
      let changed = false;
      if (video.videoSrc !== videoSrc) {
        video.videoSrc = videoSrc;
        changed = true;
      }
      if (video.videoDuration !== duration) {
        video.videoDuration = duration;
        changed = true;
      }
      if (video.videoWidth !== width) {
        video.videoWidth = width;
        changed = true;
      }
      if (video.videoHeight !== height) {
        video.videoHeight = height;
        changed = true;
      }
      if (typeof displayWidth === "number" && Number.isFinite(displayWidth) && video.videoDisplayWidth !== displayWidth) {
        video.videoDisplayWidth = displayWidth;
        changed = true;
      }
      if (!changed) return;
      video.updatedAt = new Date().toISOString();
    }
  },

  persist: piniaPersistConfig("movie-model-editor-scene-node", ["nodeIdCounter"])
});
