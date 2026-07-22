import type { APIRequestContext, Page } from "@playwright/test";

export const DEFAULT_CAMERA = {
  position: [0, 2, 5] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  fov: 50,
  transitionSec: 0.5
};

const API_BASE = process.env.E2E_EDITOR_API_URL || "http://127.0.0.1:4000";
/** Short MP4 served by Vite with finite duration for deterministic seek/play. */
export const PRESENTATION_VIDEO_FIXTURE = "/e2e/presentation-fixture.mp4";
export const PRESENTATION_VIDEO_DURATION = 13.3;

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

/** 展示页左右键：单视频下 3 段动画，用于导航同步回归 */
export function multiAnimationViewScenePayload(title: string) {
  const now = new Date().toISOString();
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const videoId = `vid_nav_${suffix}`;
  const modelId = `model_nav_${suffix}`;
  const anims = [
    { id: `anim_nav_1_${suffix}`, name: "导航动画1", startTime: 0, endTime: 4, sortOrder: 0 },
    { id: `anim_nav_2_${suffix}`, name: "导航动画2", startTime: 4, endTime: 8, sortOrder: 1 },
    { id: `anim_nav_3_${suffix}`, name: "导航动画3", startTime: 8, endTime: 12, sortOrder: 2 }
  ];

  return {
    title,
    schemaVersion: 2,
    videoSrc: PRESENTATION_VIDEO_FIXTURE,
    videoDuration: PRESENTATION_VIDEO_DURATION,
    videoWidth: 640,
    videoHeight: 360,
    testModelId: modelId,
    nodes: [
      {
        id: videoId,
        projectId: "e2e",
        name: "导航测试视频",
        type: "video",
        sortOrder: 0,
        videoSrc: PRESENTATION_VIDEO_FIXTURE,
        videoDuration: PRESENTATION_VIDEO_DURATION,
        videoWidth: 640,
        videoHeight: 360,
        videoDisplayWidth: 640,
        createdAt: now,
        updatedAt: now
      },
      ...anims.map(a => ({
        id: a.id,
        projectId: "e2e",
        name: a.name,
        type: "animation",
        parentId: videoId,
        sortOrder: a.sortOrder,
        subtitle: "",
        startTime: a.startTime,
        endTime: a.endTime,
        color: "#409eff",
        camera: { ...DEFAULT_CAMERA },
        modelConfigs: {
          [modelId]: {
            visible: a.sortOrder !== 1,
            posOffset: [a.sortOrder, 0, 0] as [number, number, number],
            scale: 1,
            highlight: false,
            outline: false,
            animation: false
          }
        },
        createdAt: now,
        updatedAt: now
      }))
    ],
    subtitles: [],
    models: [
      {
        id: modelId,
        projectId: "e2e",
        name: "导航同步立方体",
        type: "cube",
        color: "#409eff",
        groundY: 0,
        basePosition: [0, 0, 0] as [number, number, number],
        createdAt: now,
        updatedAt: now
      }
    ],
    sceneSettings: {}
  };
}

export type PresentationSyncSnapshot = {
  activeId: string | null;
  activeRowId: string | null;
  currentTime: number;
  presentationNavIndex: number;
  presentationUiChapterId: string | null;
  isPlaying: boolean;
  videoPaused: boolean;
  videoCurrentTime: number;
  navIds: string[];
  navStartTimes: number[];
  session: {
    phase: "paused" | "playing" | "seeking" | "ended" | "blocked";
    intent: "play" | "pause";
    committedTime: number;
    targetTime: number;
    navChapterId: string | null;
    playableChapterId: string | null;
    requestId: number;
  };
};

export async function readPresentationSync(page: Page): Promise<PresentationSyncSnapshot> {
  return page.evaluate(() => {
    const api = (window as any).__movieEditorTest;
    const activeRow = document.querySelector('.scene-node-row.active[data-node-type="animation"]');
    const nav =
      (typeof api.getPresentationNavChapters === "function"
        ? api.getPresentationNavChapters()
        : api.presentationNavChapters) ?? [];
    const session = api.getPlaybackSession?.() ?? {};
    const displayTime =
      session.phase === "seeking"
        ? (session.targetTime ?? api.currentTime ?? 0)
        : (session.committedTime ?? api.currentTime ?? 0);
    return {
      activeId: api.getActiveChapterIdForUi?.() ?? null,
      activeRowId: activeRow?.getAttribute("data-node-id") ?? null,
      currentTime: displayTime,
      presentationNavIndex: api.presentationNavIndex ?? -1,
      presentationUiChapterId: api.presentationUiChapterId ?? null,
      isPlaying: !!api.isPlaying,
      videoPaused: api.getVideoState?.().paused ?? true,
      videoCurrentTime: api.getVideoState?.().currentTime ?? 0,
      navIds: nav.map((c: { id: string }) => c.id),
      navStartTimes: nav.map((c: { startTime: number }) => c.startTime),
      session: {
        phase: session.phase ?? "paused",
        intent: session.intent ?? "pause",
        committedTime: session.committedTime ?? 0,
        targetTime: session.targetTime ?? 0,
        navChapterId: session.navChapterId ?? null,
        playableChapterId: session.playableChapterId ?? null,
        requestId: session.requestId ?? 0
      }
    };
  });
}

export function expectPresentationSynced(
  snap: PresentationSyncSnapshot,
  label: string,
  options?: { requireTreeRow?: boolean; requirePaused?: boolean; requirePlaying?: boolean }
) {
  const navId = snap.navIds[snap.presentationNavIndex] ?? null;
  if (!navId) throw new Error(`${label}: nav index ${snap.presentationNavIndex} out of range`);
  if (snap.activeId !== navId) {
    throw new Error(`${label}: activeId ${snap.activeId} !== nav ${navId}`);
  }
  if (snap.presentationUiChapterId !== navId) {
    throw new Error(`${label}: uiChapterId ${snap.presentationUiChapterId} !== nav ${navId}`);
  }
  if (snap.session.navChapterId !== navId) {
    throw new Error(`${label}: session nav ${snap.session.navChapterId} !== nav ${navId}`);
  }
  if (options?.requireTreeRow !== false && snap.activeId && snap.activeRowId !== snap.activeId) {
    throw new Error(`${label}: tree highlight ${snap.activeRowId} !== active ${snap.activeId}`);
  }
  if (options?.requirePaused) {
    if (snap.isPlaying) throw new Error(`${label}: expected paused UI but isPlaying=true`);
    if (!snap.videoPaused) throw new Error(`${label}: expected video paused`);
  }
  if (options?.requirePlaying) {
    if (!snap.isPlaying) throw new Error(`${label}: expected playing UI but isPlaying=false`);
    if (snap.videoPaused) throw new Error(`${label}: expected video playing`);
  }
}

export async function clickPresentationNav(page: Page, direction: "prev" | "next") {
  const sel =
    direction === "prev"
      ? ".viewport-preview-nav-btn--prev"
      : ".viewport-preview-nav-btn--next";
  await page.locator(sel).click({ force: true });
  await page.waitForTimeout(400);
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
  await page.waitForFunction(
    () => {
      const api = (window as any).__movieEditorTest;
      const nav =
        (typeof api?.getPresentationNavChapters === "function"
          ? api.getPresentationNavChapters()
          : api?.presentationNavChapters) ?? [];
      return Array.isArray(nav) && nav.length > 0 && !!api?.activeVideoId;
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
  await page.waitForSelector(".viewport-preview-nav-btn--next", { timeout: 15000 });
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
