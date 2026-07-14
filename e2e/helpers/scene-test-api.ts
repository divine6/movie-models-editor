import type { APIRequestContext, Page } from "@playwright/test";

export const DEFAULT_CAMERA = {
  position: [0, 2, 5] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  fov: 50,
  transitionSec: 0.5
};

const API_BASE = process.env.E2E_EDITOR_API_URL || "http://127.0.0.1:4000";

export function legacyScenePayload(title: string) {
  const now = new Date().toISOString();
  return {
    title,
    videoSrc: "/uploads/videos/e2e-placeholder.mp4",
    videoDuration: 12,
    videoWidth: 1920,
    videoHeight: 1080,
    videoDisplayWidth: 640,
    chapters: [
      {
        id: "ch_legacy_1",
        projectId: "e2e",
        name: "开场动画",
        subtitle: "",
        startTime: 0,
        endTime: 6,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {},
        createdAt: now,
        updatedAt: now
      },
      {
        id: "ch_legacy_2",
        projectId: "e2e",
        name: "结尾动画",
        subtitle: "",
        startTime: 6,
        endTime: 12,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {},
        createdAt: now,
        updatedAt: now
      }
    ],
    subtitles: [
      {
        id: "sub_legacy_1",
        projectId: "e2e",
        startTime: 0,
        endTime: 3,
        text: "legacy subtitle",
        color: "#ffffff",
        backgroundColor: "transparent",
        displayMode: "fadeIn",
        createdAt: now,
        updatedAt: now
      }
    ],
    models: [],
    sceneSettings: {}
  };
}

export function v2ScenePayload(title: string) {
  const now = new Date().toISOString();
  const groupId = "grp_e2e_1";
  const videoAId = "vid_e2e_a";
  const videoBId = "vid_e2e_b";
  const animId = "anim_e2e_1";

  return {
    title,
    schemaVersion: 2,
    videoSrc: "/uploads/videos/e2e-placeholder.mp4",
    videoDuration: 10,
    videoWidth: 1280,
    videoHeight: 720,
    nodes: [
      {
        id: groupId,
        projectId: "e2e",
        name: "E2E分组",
        type: "group",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now
      },
      {
        id: videoAId,
        projectId: "e2e",
        name: "E2E视频A",
        type: "video",
        parentId: groupId,
        sortOrder: 0,
        videoSrc: "/uploads/videos/e2e-a.mp4",
        videoDuration: 10,
        videoWidth: 1280,
        videoHeight: 720,
        videoDisplayWidth: 640,
        createdAt: now,
        updatedAt: now
      },
      {
        id: videoBId,
        projectId: "e2e",
        name: "E2E视频B",
        type: "video",
        sortOrder: 1,
        videoSrc: "/uploads/videos/e2e-b.mp4",
        videoDuration: 8,
        videoWidth: 1280,
        videoHeight: 720,
        videoDisplayWidth: 640,
        createdAt: now,
        updatedAt: now
      },
      {
        id: animId,
        projectId: "e2e",
        name: "E2E动画",
        type: "animation",
        parentId: videoAId,
        sortOrder: 0,
        subtitle: "",
        startTime: 0,
        endTime: 5,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {},
        createdAt: now,
        updatedAt: now
      }
    ],
    subtitles: [
      {
        id: "sub_e2e_1",
        projectId: "e2e",
        parentNodeId: videoAId,
        startTime: 0,
        endTime: 2,
        text: "video A subtitle",
        color: "#ffffff",
        backgroundColor: "transparent",
        displayMode: "fadeIn",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "sub_e2e_2",
        projectId: "e2e",
        parentNodeId: animId,
        startTime: 1,
        endTime: 4,
        text: "animation subtitle",
        color: "#ffff00",
        backgroundColor: "transparent",
        displayMode: "fadeIn",
        createdAt: now,
        updatedAt: now
      }
    ],
    models: [],
    sceneSettings: {}
  };
}

export async function apiAvailable(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${API_BASE}/health`, { timeout: 8000 });
    return res.ok();
  } catch {
    return false;
  }
}

export async function createScene(request: APIRequestContext, payload: Record<string, unknown>) {
  const res = await request.post(`${API_BASE}/api/scenes`, { data: payload, timeout: 30000 });
  if (!res.ok()) throw new Error(`createScene failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

export async function getScene(request: APIRequestContext, code: string) {
  const res = await request.get(`${API_BASE}/api/scenes/${encodeURIComponent(code)}`, { timeout: 15000 });
  if (!res.ok()) throw new Error(`getScene failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

export async function updateScene(request: APIRequestContext, code: string, payload: Record<string, unknown>) {
  const res = await request.put(`${API_BASE}/api/scenes/${encodeURIComponent(code)}`, {
    data: payload,
    timeout: 30000
  });
  if (!res.ok()) throw new Error(`updateScene failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

export async function deleteScene(request: APIRequestContext, code: string) {
  await request.delete(`${API_BASE}/api/scenes/${encodeURIComponent(code)}`, { timeout: 15000 });
}

export type MovieEditorTestState = {
  videoOnlyMode: boolean;
  selectedNodeId: string | null;
  selectedChapterId: string | null;
  activeVideoId: string | null;
  hasVideo: boolean;
  nodes: Array<{ id: string; type: string; name: string; parentId?: string }>;
  chapterSubtitles: Array<{ id: string; parentNodeId: string; text: string }>;
  sceneCode: string | null;
  isPreviewMode?: boolean;
  loadSceneForEdit?: (code: string) => Promise<boolean>;
  openChapterDrawer?: () => void;
};

export async function readEditorTestState(page: Page): Promise<MovieEditorTestState | null> {
  return page.evaluate(() => (window as any).__movieEditorTest ?? null);
}

export async function waitForEditorBoot(page: Page) {
  await page.goto("/#/project/editor");
  await page.waitForSelector(".movie-editor", { timeout: 60000 });
  await page.waitForFunction(() => !!(window as any).__movieEditorTest, { timeout: 45000 });
  await page.waitForFunction(() => !(window as any).__movieEditorTest?.editorInitializing, { timeout: 120000 });
  await page.waitForSelector('[data-testid="editor-boot-loading"]', { state: "detached", timeout: 5000 }).catch(() => {});
}

export async function loadSceneInEditor(page: Page, code: string) {
  await waitForEditorBoot(page);
  const ok = await page.evaluate(async c => {
    const api = (window as any).__movieEditorTest;
    if (!api?.loadSceneForEdit) return false;
    return api.loadSceneForEdit(c);
  }, code);
  if (!ok) throw new Error(`loadSceneForEdit failed for ${code}`);
  await page.waitForFunction(() => !(window as any).__movieEditorTest?.editorInitializing, { timeout: 120000 });
  await page.waitForFunction(
    (c) => {
      const api = (window as any).__movieEditorTest;
      return api?.sceneCode === c && Array.isArray(api?.nodes) && api.nodes.length > 0;
    },
    code,
    { timeout: 30000 }
  );
  await page.waitForSelector('[data-testid="scene-node-tree"]', { timeout: 30000 });
}

export async function openViewScene(page: Page, code: string) {
  await page.goto(`/#/project/editor?mode=view&code=${encodeURIComponent(code)}`);
  await page.waitForSelector(".movie-editor", { timeout: 60000 });
  await page.waitForFunction(() => !!(window as any).__movieEditorTest, { timeout: 45000 });
  await page.waitForFunction(() => !(window as any).__movieEditorTest?.editorInitializing, { timeout: 120000 });
  await page.waitForFunction(
    () => {
      const api = (window as any).__movieEditorTest;
      return Array.isArray(api?.nodes) && api.nodes.length > 0;
    },
    { timeout: 30000 }
  );
  const tree = page.locator('[data-testid="scene-node-tree"]');
  if (!(await tree.isVisible().catch(() => false))) {
    const drawerBtn = page.locator('[data-testid="open-chapter-drawer"]');
    if (await drawerBtn.first().isVisible().catch(() => false)) {
      await drawerBtn.first().click();
    } else {
      await page.evaluate(() => (window as any).__movieEditorTest?.openChapterDrawer?.());
    }
  }
  await page.waitForSelector('[data-testid="scene-node-tree"]', { timeout: 15000 });
}

export async function expandNodeByName(page: Page, type: string, name: string) {
  const row = page.locator(`[data-testid="scene-node-${type}"]`).filter({ hasText: name });
  const toggle = row.locator(".scene-node-toggle");
  if (await toggle.count()) {
    const label = (await toggle.innerText()).trim();
    if (label.includes("▸")) await toggle.click();
  }
}

export async function expandGroup(page: Page, name: string) {
  await expandNodeByName(page, "group", name);
}

export async function expandVideo(page: Page, name: string) {
  await expandNodeByName(page, "video", name);
}
