import { defineStore } from "pinia";

import type { SceneAnimationNode, SceneGroupNode, SceneNode, SceneVideoNode } from "@/interface/project";
import { CHAPTER_TAG_COLOR, DEFAULT_CAMERA } from "@/utils/three/constants";

import piniaPersistConfig from "../helper/persist";

interface SceneNodeState {
  nodeIdCounter: number;
}

export const useSceneNodeStore = defineStore("sceneNode", {
  state: (): SceneNodeState => ({
    nodeIdCounter: 0
  }),

  actions: {
    createGroup(projectId: string, name: string, parentId?: string, sortOrder = 0): SceneGroupNode {
      const id = `grp_${++this.nodeIdCounter}`;
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

    createVideo(projectId: string, name: string, parentId?: string, sortOrder = 0): SceneVideoNode {
      const id = `vid_${++this.nodeIdCounter}`;
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
      sortOrder = 0
    ): SceneAnimationNode {
      const id = `anim_${++this.nodeIdCounter}`;
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
