import { expect, test } from "@playwright/test";

import {
  apiAvailable,
  createScene,
  deleteScene,
  expandGroup,
  getScene,
  legacyScenePayload,
  loadSceneInEditor,
  openViewScene,
  readEditorTestState,
  updateScene,
  v2ScenePayload,
  waitForEditorBoot
} from "./helpers/scene-test-api";

test.describe("scene nodes editor UI", () => {
  test.beforeEach(async ({ request }) => {
    const ok = await apiAvailable(request);
    test.skip(!ok, "movie-models-server not running on :4000");
  });

  test("legacy scene loads migrated tree in edit mode", async ({ page, request }) => {
    test.setTimeout(120000);
    const created = await createScene(request, legacyScenePayload(`E2E UI Legacy ${Date.now()}`));
    const code = created.code as string;

    try {
      await loadSceneInEditor(page, code);
      const treeText = await page.locator('[data-testid="scene-node-tree"]').innerText();
      expect(treeText).toContain("默认视频");
      expect(treeText).toContain("开场动画");

      await page.locator('[data-testid="scene-node-animation"]').filter({ hasText: "开场动画" }).click();
      const state = await readEditorTestState(page);
      expect(state?.selectedChapterId || state?.selectedNodeId).toBeTruthy();
    } finally {
      await deleteScene(request, code);
    }
  });

  test("v2 scene shows group > video > animation tree in edit mode", async ({ page, request }) => {
    test.setTimeout(120000);
    const created = await createScene(request, v2ScenePayload(`E2E UI V2 ${Date.now()}`));
    const code = created.code as string;

    try {
      await loadSceneInEditor(page, code);
      await expect(page.locator('[data-testid="scene-node-video"]').filter({ hasText: "E2E视频A" })).toBeVisible();
      await expect(page.locator('[data-testid="scene-node-animation"]').filter({ hasText: "E2E动画" })).toBeVisible();
    } finally {
      await deleteScene(request, code);
    }
  });

  test("selecting video enables video-only mode; animation disables it", async ({ page, request }) => {
    test.setTimeout(180000);
    const created = await createScene(request, v2ScenePayload(`E2E UI Mode ${Date.now()}`));
    const code = created.code as string;

    try {
      await loadSceneInEditor(page, code);

      await page.locator('[data-node-id="vid_e2e_a"]').click({ timeout: 15000 });
      let state = await readEditorTestState(page);
      expect(state?.videoOnlyMode).toBe(true);
      await expect(page.locator('[data-testid="video-node-detail"]')).toBeVisible();

      const videoRow = page.locator('[data-node-id="vid_e2e_a"]');
      await expect(videoRow.locator('[data-testid="video-upload-btn"]')).toBeVisible();
      await expect(videoRow.locator('[data-testid="video-add-animation-btn"]')).toBeVisible();

      const animRow = page.locator('[data-node-id="anim_e2e_1"]');
      await expect(animRow.locator(".scene-node-actions .el-dropdown")).toHaveCount(0);

      await page.locator('[data-node-id="anim_e2e_1"]').click();
      state = await readEditorTestState(page);
      expect(state?.videoOnlyMode).toBe(false);
      await expect(page.locator(".chapter-detail-panel")).toBeVisible();
    } finally {
      await deleteScene(request, code);
    }
  });

  test("subtitles scoped to selected video vs animation", async ({ page, request }) => {
    test.setTimeout(180000);
    const created = await createScene(request, v2ScenePayload(`E2E UI Sub ${Date.now()}`));
    const code = created.code as string;

    try {
      await loadSceneInEditor(page, code);

      await page.locator('[data-node-id="vid_e2e_a"]').click({ timeout: 15000 });
      await page.locator(".right-tab").filter({ hasText: "字幕" }).click();
      let state = await readEditorTestState(page);
      expect(state?.chapterSubtitles.map(s => s.text)).toEqual(["video A subtitle"]);

      await page.locator('[data-node-id="anim_e2e_1"]').click();
      state = await readEditorTestState(page);
      expect(state?.chapterSubtitles.map(s => s.text)).toEqual(["animation subtitle"]);
    } finally {
      await deleteScene(request, code);
    }
  });

  test("video drag-and-drop moves video into group", async ({ page, request }) => {
    test.setTimeout(120000);
    const created = await createScene(request, v2ScenePayload(`E2E UI Drag ${Date.now()}`));
    const code = created.code as string;

    try {
      await loadSceneInEditor(page, code);
      await page.locator('[data-node-id="vid_e2e_b"]').dragTo(page.locator('[data-node-id="grp_e2e_1"]'));
      await page.waitForTimeout(800);

      const state = await readEditorTestState(page);
      expect(state?.nodes.find(n => n.id === "vid_e2e_b")?.parentId).toBe("grp_e2e_1");
    } finally {
      await deleteScene(request, code);
    }
  });

  test("save and reload restores nodes from server", async ({ page, request }) => {
    test.setTimeout(180000);
    const title = `E2E UI Save ${Date.now()}`;
    const created = await createScene(request, v2ScenePayload(title));
    const code = created.code as string;

    try {
      await loadSceneInEditor(page, code);
      await updateScene(request, code, { ...(await getScene(request, code)), title: `${title}-saved` });

      await page.reload();
      await page.waitForFunction(() => !!(window as any).__movieEditorTest?.loadSceneForEdit, { timeout: 45000 });
      await page.evaluate(async c => (window as any).__movieEditorTest.loadSceneForEdit(c), code);
      await page.waitForSelector('[data-testid="scene-node-tree"]', { timeout: 30000 });

      const state = await readEditorTestState(page);
      expect(state?.nodes.length).toBe(4);

      const fromApi = await getScene(request, code);
      expect(fromApi.nodes).toHaveLength(4);
    } finally {
      await deleteScene(request, code);
    }
  });

  test("local editor: add group and video workflow", async ({ page }) => {
    test.setTimeout(120000);
    await waitForEditorBoot(page);

    await page.locator('[data-testid="scene-node-tree"] .el-dropdown').first().click();
    await page.getByRole("menuitem", { name: "分组" }).click();

    let state = await readEditorTestState(page);
    expect(state?.nodes.some(n => n.type === "group")).toBe(true);

    await page.locator('[data-testid="scene-node-tree"] .el-dropdown').first().click();
    await page.getByRole("menuitem", { name: "视频" }).click();

    state = await readEditorTestState(page);
    expect(state?.nodes.some(n => n.type === "video")).toBe(true);
  });
});

test.describe("existing production scene smoke", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiAvailable(request)), "movie-models-server not running");
  });

  test("known view scene k0yxvtgc loads nodes", async ({ page, request }) => {
    test.setTimeout(120000);
    const scene = await getScene(request, "k0yxvtgc").catch(() => null);
    test.skip(!scene, "k0yxvtgc not in database");

    await openViewScene(page, "k0yxvtgc");
    const state = await readEditorTestState(page);
    expect((state?.nodes.length ?? 0) > 0).toBe(true);
  });
});
