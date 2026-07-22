import { test, expect, devices } from "@playwright/test";

import {
  apiAvailable,
  clickPresentationNav,
  createScene,
  deleteScene,
  expectPresentationSynced,
  multiAnimationViewScenePayload,
  openViewScene,
  readPresentationSync
} from "./helpers/scene-test-api";

async function ensurePaused(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snap = await readPresentationSync(page);
    if (snap.videoPaused && !snap.isPlaying && snap.session.intent === "pause") return;
    await page.locator(".progress-ctrl-btn").first().click({ force: true });
    await page.waitForTimeout(500);
  }
  const finalSnap = await readPresentationSync(page);
  expect(
    finalSnap.videoPaused && !finalSnap.isPlaying && finalSnap.session.intent === "pause",
    `ensurePaused failed: ${JSON.stringify(finalSnap.session)} videoPaused=${finalSnap.videoPaused}`
  ).toBe(true);
}

async function ensurePlaying(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const snap = await readPresentationSync(page);
    if (!snap.videoPaused && snap.isPlaying && snap.session.intent === "play") return;
    await page.locator(".progress-ctrl-btn").first().click({ force: true });
    try {
      await expect
        .poll(async () => {
          const s = await readPresentationSync(page);
          return !s.videoPaused && s.session.intent === "play" && s.isPlaying;
        }, { timeout: 8000 })
        .toBe(true);
      return;
    } catch {
      /* retry gesture */
    }
  }
  const finalSnap = await readPresentationSync(page);
  expect(
    finalSnap.videoPaused,
    `ensurePlaying failed: ${JSON.stringify(finalSnap.session)}`
  ).toBe(false);
}

async function navToIndex(page: import("@playwright/test").Page, targetIdx: number) {
  for (let guard = 0; guard < 8; guard++) {
    const snap = await readPresentationSync(page);
    const start = snap.navStartTimes[targetIdx];
    const atIndex = snap.presentationNavIndex === targetIdx;
    // Session target is source of truth; do not wait on lagged video.currentTime
    // (that caused endless next/prev dances on slow seeks).
    const sessionAtStart =
      start != null && Math.abs(snap.session.targetTime - start) < 0.85;
    if (atIndex && sessionAtStart) return snap;
    if (targetIdx < snap.presentationNavIndex) {
      await clickPresentationNav(page, "prev");
    } else if (targetIdx > snap.presentationNavIndex) {
      await clickPresentationNav(page, "next");
    } else if (atIndex && !sessionAtStart) {
      // Same index, wrong target: re-issue next/prev to force a seek command.
      if (targetIdx < snap.navIds.length - 1) {
        await clickPresentationNav(page, "next");
        await clickPresentationNav(page, "prev");
      } else if (targetIdx > 0) {
        await clickPresentationNav(page, "prev");
        await clickPresentationNav(page, "next");
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return readPresentationSync(page);
}

test.describe("presentation nav sync", () => {
  let sceneCode: string | null = null;
  let testModelId = "model_nav_e2e";

  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiAvailable(request)), "movie-models-server not running");
    const payload = multiAnimationViewScenePayload(`E2E Nav Sync ${Date.now()}`);
    testModelId = (payload as { testModelId?: string }).testModelId ?? testModelId;
    const created = await createScene(request, payload);
    sceneCode = created.code as string;
  });

  test.afterEach(async ({ request }) => {
    if (sceneCode) {
      await deleteScene(request, sceneCode).catch(() => undefined);
      sceneCode = null;
    }
  });

  test("paused: left/right syncs progress, list highlight, stays paused", async ({ page }) => {
    test.setTimeout(120000);
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1500);

    let snap = await readPresentationSync(page);
    expect(snap.navIds.length).toBeGreaterThanOrEqual(3);

    await ensurePaused(page);
    snap = await navToIndex(page, 0);
    expectPresentationSynced(snap, "initial chapter 0", { requirePaused: true });
    expect(snap.currentTime).toBeCloseTo(snap.navStartTimes[0]!, 0);

    await clickPresentationNav(page, "next");
    snap = await readPresentationSync(page);
    expectPresentationSynced(snap, "paused next → chapter 1", { requirePaused: true });
    expect(snap.presentationNavIndex).toBe(1);
    expect(snap.currentTime).toBeCloseTo(snap.navStartTimes[1]!, 0);

    await clickPresentationNav(page, "next");
    snap = await readPresentationSync(page);
    expectPresentationSynced(snap, "paused next → chapter 2", { requirePaused: true });
    expect(snap.presentationNavIndex).toBe(2);

    await clickPresentationNav(page, "prev");
    snap = await readPresentationSync(page);
    expectPresentationSynced(snap, "paused prev → chapter 1", { requirePaused: true });
    expect(snap.presentationNavIndex).toBe(1);
  });

  test("paused navigation applies the matching model visibility and transform", async ({ page }) => {
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);

    await navToIndex(page, 1);
    await expect
      .poll(() =>
        page.evaluate(
          id => (window as any).__movieEditorTest.getPresentationModelState(id),
          testModelId
        )
      )
      .toMatchObject({ visible: false, position: [1, 0.5, 0] });

    await navToIndex(page, 2);
    await expect
      .poll(() =>
        page.evaluate(
          id => (window as any).__movieEditorTest.getPresentationModelState(id),
          testModelId
        )
      )
      .toMatchObject({ visible: true, position: [2, 0.5, 0] });
  });

  test("play once → pause → nav to start does not auto-play", async ({ page }) => {
    test.setTimeout(120000);
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1500);

    await navToIndex(page, 2);
    await ensurePlaying(page);
    await page.waitForTimeout(1200);

    await ensurePaused(page);
    let snap = await readPresentationSync(page);
    expectPresentationSynced(snap, "after manual pause", { requirePaused: true });

    snap = await navToIndex(page, 0);
    expectPresentationSynced(snap, "paused nav to chapter 0", { requirePaused: true });
    expect(snap.presentationNavIndex).toBe(0);
    expect(snap.currentTime).toBeCloseTo(snap.navStartTimes[0]!, 0);

    await page.waitForTimeout(1500);
    snap = await readPresentationSync(page);
    expectPresentationSynced(snap, "still paused after settle", { requirePaused: true });
  });

  test("playing navigation resumes immediately from the latest target", async ({ page }) => {
    test.setTimeout(120000);
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1500);

    await ensurePaused(page);
    await navToIndex(page, 0);
    await ensurePaused(page);
    // Same turn: start play then next, before media can drift into the next chapter.
    await page.evaluate(() => {
      const api = (window as any).__movieEditorTest;
      api.togglePlay();
      api.nextCh();
    });
    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return {
          idx: snap.presentationNavIndex,
          intent: snap.session.intent,
          playing: !snap.videoPaused
        };
      }, { timeout: 10000 })
      .toEqual({ idx: 1, intent: "play", playing: true });
    const target = await readPresentationSync(page);
    expectPresentationSynced(target, "playing next → chapter 1");
    // Nav must land in chapter 1 and keep playing forward — not roll back to 0.
    expect(target.session.targetTime).toBeGreaterThanOrEqual(target.navStartTimes[1]! - 0.05);
    expect(target.currentTime).toBeGreaterThanOrEqual(target.navStartTimes[1]! - 0.1);
    expect(target.currentTime).toBeLessThan(target.navStartTimes[2]!);
    expect(target.videoCurrentTime).toBeGreaterThan(1);

    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return snap.isPlaying && !snap.videoPaused && snap.videoCurrentTime > target.navStartTimes[1]! + 0.12;
      }, { timeout: 8000 })
      .toBe(true);
  });

  test("paused seek then play uses the retained target, never rollback zero", async ({ page }) => {
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 2);
    const paused = await readPresentationSync(page);
    expectPresentationSynced(paused, "paused at latest target", { requirePaused: true });
    expect(paused.session.targetTime).toBeCloseTo(8, 0);

    await page.locator(".progress-ctrl-btn").first().click();
    await expect.poll(async () => (await readPresentationSync(page)).videoPaused, { timeout: 10000 }).toBe(false);
    await expect.poll(async () => (await readPresentationSync(page)).videoCurrentTime, { timeout: 10000 }).toBeGreaterThan(8.1);
    const playing = await readPresentationSync(page);
    expect(playing.session.committedTime).toBeGreaterThan(8);
    expect(playing.currentTime).toBeGreaterThan(8);
  });

  test("rapid opposite navigation commits only the latest request", async ({ page }) => {
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 1);
    const before = await readPresentationSync(page);
    await page.locator(".viewport-preview-nav-btn--next").click();
    await page.waitForTimeout(320);
    await page.locator(".viewport-preview-nav-btn--prev").click();
    const after = await readPresentationSync(page);
    expect(after.session.requestId).toBeGreaterThanOrEqual(before.session.requestId + 2);
    expectPresentationSynced(after, "latest rapid request wins", { requirePaused: true });
    expect(after.presentationNavIndex).toBe(1);
    await page.waitForTimeout(900);
    const settled = await readPresentationSync(page);
    expect(settled.session.requestId).toBe(after.session.requestId);
    expect(settled.presentationNavIndex).toBe(1);
  });

  test("delayed seek keeps optimistic UI and converges media to the same target", async ({ page }) => {
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 0);
    await page.evaluate(() => {
      const video = document.querySelector("video") as HTMLVideoElement;
      const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime")!;
      Object.defineProperty(video, "currentTime", {
        configurable: true,
        get: () => descriptor.get!.call(video),
        set: value => window.setTimeout(() => descriptor.set!.call(video, value), 250)
      });
    });

    await navToIndex(page, 2);
    const immediate = await readPresentationSync(page);
    expect(immediate.currentTime).toBeCloseTo(8, 0);
    expect(immediate.session.targetTime).toBeCloseTo(8, 0);
    await expect.poll(async () => (await readPresentationSync(page)).videoCurrentTime).toBeCloseTo(8, 0);
    const settled = await readPresentationSync(page);
    expectPresentationSynced(settled, "delayed media converged", { requirePaused: true });
  });

  test("play rejection becomes blocked without losing the latest position", async ({ page }) => {
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 1);
    await page.evaluate(() => {
      const video = document.querySelector("video") as HTMLVideoElement;
      video.play = () => Promise.reject(new DOMException("test rejection", "NotAllowedError"));
    });
    await page.locator(".progress-ctrl-btn").first().click();
    await expect.poll(async () => (await readPresentationSync(page)).session.phase).toBe("blocked");
    const blocked = await readPresentationSync(page);
    expect(blocked.session.targetTime).toBeCloseTo(4, 0);
    expect(blocked.currentTime).toBeCloseTo(4, 0);
    expect(blocked.videoPaused).toBe(true);
  });

  test("paused mid-chapter seek then play continues from that point", async ({ page }) => {
    test.setTimeout(120000);
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 1);

    const before = await readPresentationSync(page);
    // Click middle of chapter-1 progress segment (~6s).
    const seg = page.locator(".prog-seg").nth(1);
    const box = await seg.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height / 2);

    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return {
          intent: snap.session.intent,
          paused: snap.videoPaused,
          near: Math.abs(snap.session.targetTime - 6) < 0.75,
          idx: snap.presentationNavIndex
        };
      }, { timeout: 10000 })
      .toEqual({ intent: "pause", paused: true, near: true, idx: 1 });

    const seeked = await readPresentationSync(page);
    expectPresentationSynced(seeked, "paused mid-chapter seek", { requirePaused: true });
    expect(seeked.currentTime).toBeGreaterThan(5.2);
    expect(seeked.currentTime).toBeLessThan(7.2);
    expect(seeked.session.requestId).toBeGreaterThan(before.session.requestId);

    await page.locator(".progress-ctrl-btn").first().click({ force: true });
    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return !snap.videoPaused && snap.session.intent === "play" && snap.videoCurrentTime > 5.5;
      }, { timeout: 8000 })
      .toBe(true);
    const playing = await readPresentationSync(page);
    // Must resume from the seeked point (not 0). Index may auto-advance if we lingered.
    expect(playing.videoCurrentTime).toBeGreaterThan(5.2);
    expect(playing.session.committedTime).toBeGreaterThan(5);
  });

  test("list click seeks to chapter start with a single playback command", async ({ page }) => {
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 0);
    const before = await readPresentationSync(page);
    const targetId = before.navIds[2];
    expect(targetId).toBeTruthy();

    await page.locator(`.scene-node-row[data-node-id="${targetId}"]`).click();
    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return {
          idx: snap.presentationNavIndex,
          target: Math.abs(snap.session.targetTime - (snap.navStartTimes[2] ?? -1)) < 0.35,
          intent: snap.session.intent,
          reqDelta: snap.session.requestId - before.session.requestId
        };
      }, { timeout: 10000 })
      .toEqual({ idx: 2, target: true, intent: "pause", reqDelta: 1 });

    const after = await readPresentationSync(page);
    expectPresentationSynced(after, "list click chapter 2", { requirePaused: true });
    expect(after.currentTime).toBeCloseTo(after.navStartTimes[2]!, 0);
  });

  test("playing: list / nav only retarget, never toggle pause", async ({ page }) => {
    test.setTimeout(120000);
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 0);
    await ensurePlaying(page);

    const before = await readPresentationSync(page);
    const targetId = before.navIds[2];
    await page.locator(`.scene-node-row[data-node-id="${targetId}"]`).click();
    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return {
          idx: snap.presentationNavIndex,
          intent: snap.session.intent,
          playing: !snap.videoPaused && snap.isPlaying
        };
      }, { timeout: 12000 })
      .toEqual({ idx: 2, intent: "play", playing: true });

    await clickPresentationNav(page, "prev");
    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return {
          idx: snap.presentationNavIndex,
          intent: snap.session.intent,
          playing: !snap.videoPaused && snap.isPlaying
        };
      }, { timeout: 12000 })
      .toEqual({ idx: 1, intent: "play", playing: true });
  });

  test("playing through media end loops to first chapter without pausing", async ({ page }) => {
    test.setTimeout(120000);
    await openViewScene(page, sceneCode!);
    await page.waitForTimeout(1200);
    await ensurePaused(page);
    await navToIndex(page, 2);
    await ensurePlaying(page);

    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return {
          intent: snap.session.intent,
          playing: !snap.videoPaused,
          nearStart:
            snap.presentationNavIndex === 0 &&
            snap.session.targetTime < 1.5 &&
            snap.videoCurrentTime < 2.5
        };
      }, { timeout: 25000 })
      .toEqual({ intent: "play", playing: true, nearStart: true });

    // Second lap: still playing, must not freeze on play-icon / blocked.
    await expect
      .poll(async () => {
        const snap = await readPresentationSync(page);
        return (
          snap.session.intent === "play" &&
          !snap.videoPaused &&
          snap.isPlaying &&
          snap.videoCurrentTime > 3.5
        );
      }, { timeout: 20000 })
      .toBe(true);
  });

  test.describe("mobile touch", () => {
    const pixel = devices["Pixel 5"];
    test.use({
      viewport: pixel.viewport,
      userAgent: pixel.userAgent,
      deviceScaleFactor: pixel.deviceScaleFactor,
      isMobile: pixel.isMobile,
      hasTouch: pixel.hasTouch
    });

    test("one touch on the progress track emits one playback command", async ({ page }) => {
      await openViewScene(page, sceneCode!);
      await page.waitForTimeout(1200);
      await ensurePaused(page);
      // Mobile layout: chapter drawer can cover the play button; track seek is what we test.
      await page.evaluate(() => {
        const panel = document.querySelector(".editor-body__chapters") as HTMLElement | null;
        if (panel) panel.style.pointerEvents = "none";
      });
      const before = await readPresentationSync(page);
      const track = page.locator(".progress-track");
      const box = await track.boundingBox();
      expect(box).not.toBeNull();
      const clientX = box!.x + box!.width * 0.45;
      const clientY = box!.y + box!.height / 2;
      // Mobile path is pointerup; click must be suppressed by the progress bar guard.
      await track.dispatchEvent("pointerup", {
        pointerType: "touch",
        pointerId: 1,
        clientX,
        clientY,
        bubbles: true
      });
      await page.waitForTimeout(100);
      const after = await readPresentationSync(page);
      expect(after.session.requestId).toBe(before.session.requestId + 1);
      expect(after.session.intent).toBe("pause");
    });
  });
});

test.describe("presentation nav sync (production scene)", () => {
  test("k0yxvtgc: paused nav does not desync list", async ({ page, request }) => {
    test.setTimeout(120000);
    test.skip(!(await apiAvailable(request)), "movie-models-server not running");
    const scene = await getSceneSafe(request, "k0yxvtgc");
    test.skip(!scene, "k0yxvtgc not in database");

    await openViewScene(page, "k0yxvtgc");
    await page.waitForTimeout(2000);

    const initial = await readPresentationSync(page);
    test.skip(initial.navIds.length < 2, "k0yxvtgc has fewer than 2 nav chapters");

    await ensurePaused(page);
    await clickPresentationNav(page, "next");
    const after = await readPresentationSync(page);
    expectPresentationSynced(after, "k0yxvtgc paused next", { requirePaused: true });
    expect(after.presentationNavIndex).toBe(initial.presentationNavIndex + 1);
  });
});

async function getSceneSafe(request: import("@playwright/test").APIRequestContext, code: string) {
  try {
    const res = await request.get(`http://127.0.0.1:4000/api/scenes/${encodeURIComponent(code)}`, {
      timeout: 15000
    });
    if (!res.ok()) return null;
    return res.json();
  } catch {
    return null;
  }
}
