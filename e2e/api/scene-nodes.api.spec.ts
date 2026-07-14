import { expect, test } from "@playwright/test";

import {
  apiAvailable,
  createScene,
  deleteScene,
  getScene,
  legacyScenePayload,
  updateScene,
  v2ScenePayload
} from "../helpers/scene-test-api";

test.describe("scene nodes API / persistence", () => {
  test.beforeEach(async ({ request }) => {
    const ok = await apiAvailable(request);
    test.skip(!ok, "movie-models-server not running on :4000");
  });

  test("legacy scene auto-migrates to nodes on GET", async ({ request }) => {
    const title = `E2E Legacy ${Date.now()}`;
    const created = await createScene(request, legacyScenePayload(title));
    const code = created.code as string;

    try {
      const scene = await getScene(request, code);
      expect(Array.isArray(scene.nodes)).toBe(true);
      expect(scene.nodes.length).toBeGreaterThanOrEqual(2);

      const videos = scene.nodes.filter((n: { type: string }) => n.type === "video");
      const animations = scene.nodes.filter((n: { type: string }) => n.type === "animation");
      expect(videos.length).toBeGreaterThanOrEqual(1);
      expect(animations.length).toBe(2);
      expect(animations.every((a: { parentId: string }) => a.parentId === videos[0].id)).toBe(true);
      expect(scene.subtitles[0].parentNodeId).toBeTruthy();
    } finally {
      await deleteScene(request, code);
    }
  });

  test("v2 nodes persist through PUT and reload from scene_node table", async ({ request }) => {
    const title = `E2E V2 ${Date.now()}`;
    const created = await createScene(request, v2ScenePayload(title));
    const code = created.code as string;

    try {
      const loaded = await getScene(request, code);
      expect(loaded.nodes).toHaveLength(4);

      const updatedNodes = loaded.nodes.map((n: { id: string; name: string }) =>
        n.id === "grp_e2e_1" ? { ...n, name: "E2E分组-已改" } : n
      );
      await updateScene(request, code, { ...loaded, nodes: updatedNodes, title: `${title}-updated` });

      const reloaded = await getScene(request, code);
      expect(reloaded.nodes.find((n: { id: string }) => n.id === "grp_e2e_1")?.name).toBe("E2E分组-已改");

      const moved = reloaded.nodes.map((n: { id: string; parentId?: string }) =>
        n.id === "vid_e2e_b" ? { ...n, parentId: "grp_e2e_1" } : n
      );
      await updateScene(request, code, { ...reloaded, nodes: moved });

      const afterMove = await getScene(request, code);
      expect(afterMove.nodes.find((n: { id: string }) => n.id === "vid_e2e_b")?.parentId).toBe("grp_e2e_1");
    } finally {
      await deleteScene(request, code);
    }
  });

  test("subtitles retain parentNodeId binding", async ({ request }) => {
    const created = await createScene(request, v2ScenePayload(`E2E Sub ${Date.now()}`));
    const code = created.code as string;

    try {
      const scene = await getScene(request, code);
      expect(scene.subtitles.find((s: { id: string }) => s.id === "sub_e2e_1").parentNodeId).toBe("vid_e2e_a");
      expect(scene.subtitles.find((s: { id: string }) => s.id === "sub_e2e_2").parentNodeId).toBe("anim_e2e_1");
    } finally {
      await deleteScene(request, code);
    }
  });
});
