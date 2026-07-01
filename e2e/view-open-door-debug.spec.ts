import { test, expect } from "@playwright/test";

test("view mode: 开门 chapter keeps door animation after load", async ({ page }) => {
  test.setTimeout(90000);

  const playbackLogs: string[] = [];
  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("startChapterPlayback:prepared-preview-playback") && text.includes("开门")) {
      playbackLogs.push(text);
    }
  });

  await page.goto("/#/project/editor?mode=view&code=k0yxvtgc");
  await page.waitForSelector(".movie-editor:not(.editor-route-gate)", { timeout: 60000 });
  await page.waitForTimeout(3000);

  const openBtn = page.locator(".ch-item--root").filter({ hasText: "开门" });
  await openBtn.click();
  await page.waitForTimeout(2000);

  const hasAnimInLog = playbackLogs.some(
    line => line.includes("chapterHasAnimation: true") && line.includes("chapterAnimTargets: 2")
  );
  expect(hasAnimInLog, `expected 开门 playback logs, got: ${playbackLogs.join("\n")}`).toBe(true);
});
