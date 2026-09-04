import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const OUT_DIR = path.resolve("docs/user-guide/images");
const GLB = path.resolve("models/haiyunji.glb");
const VIDEO = path.resolve("public/e2e/guide-video.mp4");
const API = process.env.E2E_EDITOR_API_URL || "http://127.0.0.1:4000";

test.use({
  viewport: { width: 1680, height: 960 },
  deviceScaleFactor: 1
});

function clampClip(
  box: { x: number; y: number; width: number; height: number },
  vp: { width: number; height: number }
) {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.max(8, Math.min(Math.ceil(box.width), vp.width - x));
  const height = Math.max(8, Math.min(Math.ceil(box.height), vp.height - y));
  return { x, y, width, height };
}

async function unblockFonts(page: Page) {
  await page.evaluate(() => {
    try {
      document.fonts.clear();
    } catch {
      /* ignore */
    }
  });
}

async function shot(page: Page, name: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  await unblockFonts(page);
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    type: "png",
    animations: "disabled",
    caret: "hide",
    timeout: 15000
  });
}

async function shotClip(
  page: Page,
  name: string,
  selectors: string | string[],
  maxHeight = 0
) {
  mkdirSync(OUT_DIR, { recursive: true });
  const list = Array.isArray(selectors) ? selectors : [selectors];
  const vp = page.viewportSize() || { width: 1680, height: 960 };
  let x = Infinity;
  let y = Infinity;
  let r = 0;
  let b = 0;
  for (const sel of list) {
    const loc = page.locator(sel).first();
    await loc.scrollIntoViewIfNeeded().catch(() => undefined);
    const box = await loc.boundingBox();
    if (!box || box.width < 2 || box.height < 2) continue;
    x = Math.min(x, box.x);
    y = Math.min(y, box.y);
    r = Math.max(r, box.x + box.width);
    b = Math.max(b, box.y + box.height);
  }
  if (!Number.isFinite(x)) throw new Error(`no box for ${name}: ${list.join(", ")}`);
  let height = b - y;
  if (maxHeight > 0) height = Math.min(height, maxHeight);
  await unblockFonts(page);
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    type: "png",
    animations: "disabled",
    caret: "hide",
    timeout: 15000,
    clip: clampClip({ x, y, width: r - x, height }, vp)
  });
}

async function shotRange(page: Page, name: string, topSel: string, bottomSel: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  const vp = page.viewportSize() || { width: 1680, height: 960 };
  await page.locator(topSel).first().scrollIntoViewIfNeeded().catch(() => undefined);
  const top = await page.locator(topSel).first().boundingBox();
  const bottom = await page.locator(bottomSel).last().boundingBox();
  if (!top || !bottom) throw new Error(`no range for ${name}`);
  const x = Math.min(top.x, bottom.x);
  const y = Math.min(top.y, bottom.y);
  const r = Math.max(top.x + top.width, bottom.x + bottom.width);
  const b = Math.max(top.y + top.height, bottom.y + bottom.height);
  await unblockFonts(page);
  await page.screenshot({
    path: path.join(OUT_DIR, name),
    type: "png",
    animations: "disabled",
    caret: "hide",
    timeout: 15000,
    clip: clampClip({ x, y, width: r - x, height: b - y }, vp)
  });
}

async function dismissToasts(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll(".el-message, .el-notification").forEach(el => el.remove());
  });
}

async function zoomViewport(page: Page, steps = 10) {
  const box = await page.locator(".viewport").boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -160);
    await page.waitForTimeout(30);
  }
}

async function waitEditorReady(page: Page) {
  await page.waitForSelector(".movie-editor", { timeout: 60000 });
  await page.waitForFunction(() => !!(window as any).__movieEditorTest, { timeout: 45000 });
  await page.waitForFunction(() => !(window as any).__movieEditorTest?.editorInitializing, { timeout: 180000 });
  await page.locator('[data-testid="editor-boot-loading"]').waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
}

test.describe("capture user-guide screenshots", () => {
  test.skip(!process.env.CAPTURE_USER_GUIDE, "set CAPTURE_USER_GUIDE=1 to recapture docs screenshots");
  test.setTimeout(900000);

  test("capture current editor UI", async ({ page, request }) => {
    test.skip(!existsSync(GLB), "models/haiyunji.glb missing");
        test.skip(!existsSync(VIDEO), "public/e2e/guide-video.mp4 missing");

    const created = await request.post(`${API}/api/model-sets`, {
      multipart: {
        name: "产品展示场景",
        companyName: "UltimateBox",
        models: {
          name: "haiyunji.glb",
          mimeType: "model/gltf-binary",
          buffer: readFileSync(GLB)
        }
      },
      timeout: 120000
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const set = await created.json();
    const modelSetCode = set.code as string;

    await page.goto(`/#/project/editor?code=${encodeURIComponent(modelSetCode)}`);
    await waitEditorReady(page);
    await page.addStyleTag({
      content: `
        #__vue-devtools-container__,
        .vue-devtools-frame,
        .vue-devtools__panel,
        iframe[src*="devtools"] { display: none !important; visibility: hidden !important; }
      `
    });
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: "＋ 添加" }).click();
    await page.locator(".el-dropdown-menu__item", { hasText: "视频" }).click();
    await page.waitForSelector('[data-testid="scene-node-video"]');
    await page.waitForSelector(".model-card", { timeout: 90000 });

    const videoRow = page.locator('[data-testid="scene-node-video"]').first();
    await videoRow.click();
    await page.locator('[data-testid="video-node-detail"] input').fill("讲解视频");
    await videoRow.locator('[data-testid="video-upload-btn"]').click();
    await page.setInputFiles("#scene-video-file-input", VIDEO);
    await page.waitForFunction(() => {
      const api = (window as any).__movieEditorTest;
      return !!api?.hasVideo && Number(api?.getVideoState?.()?.duration || 0) > 1;
    }, null, { timeout: 60000 });
    await page.waitForTimeout(400);

    const animRows = page.locator('[data-testid="scene-node-animation"]');
    for (let i = 0; i < 3; i++) {
      const before = await animRows.count();
      await page.locator('[data-testid="video-add-animation-btn"]').first().click();
      await expect(animRows).toHaveCount(before + 1, { timeout: 15000 });
    }
    await expect(animRows.first()).toBeVisible();
    await animRows.first().click();
    await page.waitForSelector('[data-testid="animation-timeline"]');
    await page.locator(".model-card").first().click();
    await page.waitForTimeout(800);
    await zoomViewport(page, 6);
    await page.waitForTimeout(400);
    await dismissToasts(page);

    await shot(page, "guide-01-overview.png");
    await shotClip(page, "guide-header.png", ".editor-topbar");
    await shotRange(page, "guide-node-tree.png", ".scene-node-tree-toolbar", '[data-testid="scene-node-animation"]');
    await page.locator(".at-card-clip").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shotClip(page, "guide-07-animation-timeline.png", [".at-toolbar", ".at-clips", ".at-card-clip"], 380);
    await shotClip(page, "guide-viewport.png", ".panel-center");

    await page.locator(".right-tab", { hasText: "模型" }).click();
    await page.locator(".model-card").first().click();
    await page.waitForTimeout(400);
    await dismissToasts(page);
    await shotRange(page, "guide-02-model-config.png", ".model-tab .panel-model-head", ".model-tab .model-tree-root");

    const clipModel = page.locator(".at-model-row").first();
    if (await clipModel.count()) {
      await clipModel.click();
      await page.waitForTimeout(400);
    }
    await page.locator(".at-card-models").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await dismissToasts(page);
    await shotClip(page, "guide-clip-edit.png", [".at-card-models", ".md-clip-editor .md-section"], 360);

    await page.locator(".right-tab", { hasText: "字幕" }).click();
    await page.waitForTimeout(300);
    const subStart = page.locator(".subtitle-form-field").filter({ hasText: "开始时间" }).locator(".el-input-number input");
    const subEnd = page.locator(".subtitle-form-field").filter({ hasText: "结束时间" }).locator(".el-input-number input");
    await subStart.fill("0");
    await subEnd.fill("1");
    await page.locator(".subtitle-form-field--text textarea").fill("这是当前段落的讲解字幕示例");
    await page.getByRole("button", { name: /添加字幕/ }).click();
    await page.locator(".subtitle-item").first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    await dismissToasts(page);
    if (await page.locator(".subtitle-item").count()) {
      await shotRange(page, "guide-03-subtitle.png", ".subtitle-form-card", ".subtitle-item");
    } else {
      await shotClip(page, "guide-03-subtitle.png", ".subtitle-form-card");
    }

    await page.locator(".right-tab", { hasText: "场景" }).click();
    await page.waitForTimeout(400);
    await dismissToasts(page);
    await page.locator(".scene-tab .base-form-group").filter({ hasText: "灯光" }).first().scrollIntoViewIfNeeded();
    await shotClip(page, "guide-04-scene.png", ".scene-tab .base-form-group:has-text('灯光')", 360);
    await page.locator(".scene-tab .base-form-group").filter({ hasText: "环境贴图" }).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shotClip(page, "guide-04-scene-env.png", ".scene-tab .base-form-group:has-text('环境贴图')", 360);

    const previewBtn = page.getByRole("button", { name: "预览" });
    await expect(previewBtn).toBeEnabled();
    await previewBtn.click();
    await page.waitForSelector(".movie-editor.preview-mode");
    await page.waitForTimeout(800);
    await zoomViewport(page, 5);
    await page.waitForTimeout(400);
    await dismissToasts(page);
    await shot(page, "guide-05-preview.png");

    await page.getByRole("button", { name: /退出预览/ }).click();
    await page.waitForSelector(".movie-editor:not(.preview-mode)");
    await page.waitForTimeout(600);

    const saveBtn = page.locator(".editor-topbar__save-btn");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await page.locator(".editor-persist-mask").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await page.locator(".editor-persist-mask").waitFor({ state: "detached", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(800);
    await dismissToasts(page);

    await page.getByRole("button", { name: "编辑列表" }).click();
    await page.waitForSelector(".editor-scene-list-drawer .el-table");
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.querySelectorAll(".scene-preview-link").forEach(a => {
        a.textContent = "（展示链接由工作人员另行发放）";
        a.removeAttribute("href");
      });
      document.querySelectorAll(".scene-code-badge").forEach(el => {
        el.textContent = "xxxxxxxx";
      });
    });
    await shotRange(
      page,
      "guide-06-edit-list.png",
      ".editor-scene-list-drawer .el-drawer__header",
      ".editor-scene-list-drawer__table"
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    const sceneCode = await page.evaluate(() => (window as any).__movieEditorTest?.sceneCode || "");
    if (sceneCode) {
      await page.goto(`/#/project/editor?mode=view&code=${encodeURIComponent(sceneCode)}`);
      await waitEditorReady(page);
      await page.waitForTimeout(1200);
      await zoomViewport(page, 5);
      await page.waitForTimeout(400);
      await dismissToasts(page);
      await shot(page, "guide-11-view-mode.png");
    }

    await request.delete(`${API}/api/model-sets/${encodeURIComponent(modelSetCode)}`).catch(() => {});
  });
});
