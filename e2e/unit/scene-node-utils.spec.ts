import { expect, test } from "@playwright/test";

import type { ProjectDetail, SceneAnimationNode, SceneVideoNode } from "../../src/interface/project";
import { migrateProjectToSceneNodesV2, SCHEMA_VERSION } from "../../src/utils/sceneMigration";
import {
  canDropVideoInTarget,
  findAnimationAtTime,
  flattenSceneNodeTree,
  getAnimationNodes,
  getVideoAnimations,
  getVideoNodes,
  isAnimationNode,
  isGroupNode,
  isVideoNode
} from "../../src/utils/sceneNodeTree";
import { DEFAULT_CAMERA } from "../helpers/scene-test-api";

test.describe("scene node utils (unit)", () => {
  test("migrates legacy chapters to default video + animations", () => {
    const project: ProjectDetail = {
      id: "p1",
      title: "legacy",
      videoSrc: "/v.mp4",
      videoDuration: 10,
      videoWidth: 1920,
      videoHeight: 1080,
      videoDisplayWidth: 0,
      createdAt: "",
      updatedAt: "",
      nodes: [],
      models: [],
      subtitles: [],
      chapters: [
        {
          id: "ch1",
          projectId: "p1",
          name: "A",
          type: "animation",
          sortOrder: 0,
          subtitle: "",
          startTime: 0,
          endTime: 5,
          color: "#409eff",
          camera: { ...DEFAULT_CAMERA },
          modelConfigs: {},
          createdAt: "",
          updatedAt: ""
        }
      ]
    };

    const migrated = migrateProjectToSceneNodesV2(project);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(getVideoNodes(migrated.nodes)).toHaveLength(1);
    expect(getVideoNodes(migrated.nodes)[0].name).toBe("默认视频");
    expect(getAnimationNodes(migrated.nodes)).toHaveLength(1);
    expect(getAnimationNodes(migrated.nodes)[0].parentId).toBe(getVideoNodes(migrated.nodes)[0].id);
    expect(migrated.subtitles.every(s => !!s.parentNodeId)).toBe(true);
  });

  test("flattenSceneNodeTree preserves group > video > animation hierarchy", () => {
    const now = new Date().toISOString();
    const videoId = "v1";
    const nodes: ProjectDetail["nodes"] = [
      {
        id: "g1",
        projectId: "p",
        name: "G",
        type: "group",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: videoId,
        projectId: "p",
        name: "V",
        type: "video",
        parentId: "g1",
        sortOrder: 0,
        videoSrc: "/v.mp4",
        videoDuration: 5,
        videoWidth: 1,
        videoHeight: 1,
        videoDisplayWidth: 0,
        createdAt: now,
        updatedAt: now
      } satisfies SceneVideoNode,
      {
        id: "a1",
        projectId: "p",
        name: "A",
        type: "animation",
        parentId: videoId,
        sortOrder: 0,
        subtitle: "",
        startTime: 0,
        endTime: 2,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {},
        createdAt: now,
        updatedAt: now
      } satisfies SceneAnimationNode
    ];

    const flat = flattenSceneNodeTree(nodes);
    expect(flat.map(x => x.node.type)).toEqual(["group", "video", "animation"]);
    expect(getVideoAnimations(nodes, videoId)).toHaveLength(1);
  });

  test("canDropVideoInTarget allows move to group and blocks invalid targets", () => {
    const now = new Date().toISOString();
    const nodes: ProjectDetail["nodes"] = [
      {
        id: "g1",
        projectId: "p",
        name: "G",
        type: "group",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "v1",
        projectId: "p",
        name: "V",
        type: "video",
        sortOrder: 0,
        videoSrc: null,
        videoDuration: 0,
        videoWidth: 0,
        videoHeight: 0,
        videoDisplayWidth: 0,
        createdAt: now,
        updatedAt: now
      }
    ];

    expect(canDropVideoInTarget(nodes, "v1", "g1")).toBe(true);
    expect(canDropVideoInTarget(nodes, "v1", null)).toBe(false);
    expect(canDropVideoInTarget(nodes, "v1", "v1")).toBe(false);
  });

  test("findAnimationAtTime returns null in gaps between chapters", () => {
    const now = new Date().toISOString();
    const videoId = "v1";
    const nodes: ProjectDetail["nodes"] = [
      {
        id: videoId,
        projectId: "p",
        name: "V",
        type: "video",
        sortOrder: 0,
        videoSrc: "/v.mp4",
        videoDuration: 10,
        videoWidth: 1,
        videoHeight: 1,
        videoDisplayWidth: 0,
        createdAt: now,
        updatedAt: now
      } satisfies SceneVideoNode,
      {
        id: "a1",
        projectId: "p",
        name: "A",
        type: "animation",
        parentId: videoId,
        sortOrder: 0,
        subtitle: "",
        startTime: 0,
        endTime: 2,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {},
        createdAt: now,
        updatedAt: now
      } satisfies SceneAnimationNode,
      {
        id: "a2",
        projectId: "p",
        name: "B",
        type: "animation",
        parentId: videoId,
        sortOrder: 1,
        subtitle: "",
        startTime: 5,
        endTime: 8,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {},
        createdAt: now,
        updatedAt: now
      } satisfies SceneAnimationNode
    ];

    expect(findAnimationAtTime(nodes, videoId, 1)).not.toBeNull();
    expect(findAnimationAtTime(nodes, videoId, 3)).toBeNull();
    expect(findAnimationAtTime(nodes, videoId, 6)).not.toBeNull();
  });

  test("type guards", () => {
    const now = new Date().toISOString();
    const g = { id: "g", projectId: "p", name: "g", type: "group" as const, sortOrder: 0, createdAt: now, updatedAt: now };
    const v = {
      id: "v",
      projectId: "p",
      name: "v",
      type: "video" as const,
      sortOrder: 0,
      videoSrc: null,
      videoDuration: 0,
      videoWidth: 0,
      videoHeight: 0,
      videoDisplayWidth: 0,
      createdAt: now,
      updatedAt: now
    };
    expect(isGroupNode(g)).toBe(true);
    expect(isVideoNode(v)).toBe(true);
    expect(isAnimationNode(g)).toBe(false);
  });
});
