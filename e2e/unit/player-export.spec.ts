import { expect, test } from "@playwright/test";

import { generatePlayerHtml } from "../../src/composables/usePlayerExport";
import type { ProjectDetail, SceneAnimationNode, SceneVideoNode } from "../../src/interface/project";

test("standalone player keeps videos and animations independently scoped", () => {
  const now = new Date().toISOString();
  const video = (id: string, order: number): SceneVideoNode => ({
    id,
    projectId: "project",
    name: id,
    type: "video",
    sortOrder: order,
    videoSrc: `/${id}.mp4`,
    videoDuration: 4,
    videoWidth: 640,
    videoHeight: 360,
    videoDisplayWidth: 640,
    createdAt: now,
    updatedAt: now
  });
  const animation = (id: string, parentId: string, endX: number): SceneAnimationNode => ({
    id,
    projectId: "project",
    name: id,
    type: "animation",
    parentId,
    sortOrder: 0,
    subtitle: "",
    startTime: 0,
    endTime: 4,
    color: "#409eff",
    camera: {
      position: [0, 0, 5],
      target: [0, 0, 0],
      fov: 50,
      transitionSec: 0
    },
    modelConfigs: {},
    clips: [
      {
        id: `${id}-clip`,
        name: "clip",
        start: 0,
        end: 1,
        pauseTime: 0,
        animTime: 1,
        camera: {
          position: [1, 2, 3],
          target: [0, 0, 0],
          fov: 40,
          transitionSec: 0
        },
        targets: [
          {
            modelId: "model",
            nodeId: null,
            pauseTime: 0,
            animTime: 0,
            pivot: "top",
            startPos: [0, 0, 0],
            endPos: [endX, 0, 0],
            startScale: 1,
            endScale: 2,
            startRot: [0, 0, 0],
            endRot: [0, 90, 0],
            clipVisual: {
              visible: true,
              outline: true,
              wireframe: false,
              highlight: true,
              outlineColor: "#fff",
              wireframeColor: "#fff",
              modelHighlightColor: "#0f0",
              intro: id
            }
          }
        ]
      }
    ],
    createdAt: now,
    updatedAt: now
  });

  const v1 = video("video-a", 0);
  const v2 = video("video-b", 1);
  const a1 = animation("animation-a", v1.id, 1);
  const a2 = animation("animation-b", v2.id, 2);
  const project: ProjectDetail = {
    id: "project",
    title: "export test",
    videoSrc: null,
    videoDuration: 0,
    videoWidth: 0,
    videoHeight: 0,
    videoDisplayWidth: 0,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 2,
    nodes: [v1, a1, v2, a2],
    models: [],
    subtitles: []
  };

  const html = generatePlayerHtml(
    project,
    [],
    [
      { id: v1.id, name: v1.name, src: v1.videoSrc!, duration: 4, animations: [a1], subtitles: [] },
      { id: v2.id, name: v2.name, src: v2.videoSrc!, duration: 4, animations: [a2], subtitles: [] }
    ]
  );

  expect(html).toContain("const VIDEOS =");
  expect(html).toContain('"id":"video-a"');
  expect(html).toContain('"id":"video-b"');
  expect(html).toContain('"parentId":"video-a"');
  expect(html).toContain('"parentId":"video-b"');
  expect(html).toContain("hasAuthoredTransition");
  expect(html).toContain("getPivotCache");
  expect(html).toContain("video.onended = () => { playBtn.textContent = '播放'; }");
});
