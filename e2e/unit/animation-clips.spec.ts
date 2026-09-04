import { expect, test } from "@playwright/test";

import {
  cloneAnimationClip,
  projectClipsToModelAnimConfigs,
  rebuildClipAbsoluteTimes
} from "../../src/composables/movie-editor/utils/animationClips";
import type { AnimationClip, ModelConfig, ProjectDetail } from "../../src/interface/project";
import { ensureProjectNodes } from "../../src/utils/sceneMigration";

test.describe("animation clip normalization", () => {
  test("preserves explicit zero clip and target durations", () => {
    const clip: AnimationClip = {
      id: "instant",
      name: "instant",
      start: 0,
      end: 0,
      pauseTime: 0,
      animTime: 0,
      camera: {
        position: [1, 2, 3],
        target: [0, 0, 0],
        fov: 45,
        transitionSec: 0
      },
      targets: [
        {
          modelId: "m1",
          nodeId: null,
          pauseTime: 0,
          animTime: 0,
          startPos: [0, 0, 0],
          endPos: [3, 2, 1],
          startScale: 1,
          endScale: 2,
          startRot: [0, 0, 0],
          endRot: [10, 20, 30]
        }
      ]
    };

    const clips = [cloneAnimationClip(clip)];
    rebuildClipAbsoluteTimes(clips);
    expect(clips[0]).toMatchObject({ start: 0, end: 0, pauseTime: 0, animTime: 0 });
    expect(clips[0].camera?.transitionSec).toBe(0);

    const configs = new Map<string, ModelConfig>();
    projectClipsToModelAnimConfigs(
      clips,
      (modelId, nodeId) => {
        const key = `${modelId}|${nodeId ?? ""}`;
        let config = configs.get(key);
        if (!config) {
          config = {
            visible: true,
            posOffset: [0, 0, 0],
            scale: 1,
            highlight: false,
            outline: false,
            animation: false
          };
          configs.set(key, config);
        }
        return config;
      },
      () => undefined
    );

    const segment = configs.get("m1|")?.animConfig?.segments[0];
    expect(segment).toMatchObject({
      start: 0,
      end: 0,
      pauseTime: 0,
      animTime: 0,
      endPos: [3, 2, 1],
      endScale: 2,
      endRot: [10, 20, 30]
    });
  });

  test("migrates legacy chapters when a v2 payload has an empty nodes array", () => {
    const project: ProjectDetail = {
      id: "legacy-empty-v2",
      title: "legacy",
      videoSrc: "/video.mp4",
      videoDuration: 5,
      videoWidth: 640,
      videoHeight: 360,
      videoDisplayWidth: 640,
      createdAt: "",
      updatedAt: "",
      schemaVersion: 2,
      nodes: [],
      models: [],
      subtitles: [],
      chapters: [
        {
          id: "legacy-animation",
          projectId: "legacy-empty-v2",
          name: "legacy animation",
          type: "animation",
          sortOrder: 0,
          subtitle: "",
          startTime: 0,
          endTime: 5,
          color: "#409eff",
          camera: { position: [0, 0, 5], target: [0, 0, 0], fov: 50 },
          modelConfigs: {},
          createdAt: "",
          updatedAt: ""
        }
      ]
    };

    const normalized = ensureProjectNodes(project)!;
    expect(normalized.nodes.some(node => node.type === "video")).toBe(true);
    expect(normalized.nodes.some(node => node.id === "legacy-animation")).toBe(true);
  });
});
