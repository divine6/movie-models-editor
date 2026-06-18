import { expect, test } from "@playwright/test";

/**
 * Movie Model Editor - Application Debug Tests
 */
test.describe("Movie Model Editor App", () => {
  test("should load app, login, and navigate home", async ({ page }) => {
    // Collect console messages
    const consoleLogs: string[] = [];
    page.on("console", msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    // Collect page errors
    const pageErrors: string[] = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    // Navigate to login page first
    await page.goto("/#/login");
    await page.waitForTimeout(3000);

    // Log what we see
    console.log("=== Login Page ===");
    console.log("URL:", page.url());
    console.log("Title:", await page.title());

    // Check if Vue mounted (loading div should be replaced)
    const appContent = await page.textContent("#app");
    console.log("App content length:", appContent?.length);
    console.log("App content preview:", appContent?.substring(0, 300));

    await page.screenshot({ path: "e2e/screenshots/01-login.png", fullPage: true });

    // Navigate to home
    await page.goto("/#/home");
    await page.waitForTimeout(3000);

    console.log("\n=== Home Page ===");
    console.log("URL:", page.url());
    console.log("Title:", await page.title());

    const homeContent = await page.textContent("#app");
    console.log("Home content preview:", homeContent?.substring(0, 300));

    await page.screenshot({ path: "e2e/screenshots/02-home.png", fullPage: true });

    // Navigate to movie list
    await page.goto("/#/movie/list");
    await page.waitForTimeout(3000);

    console.log("\n=== Movie List Page ===");
    console.log("URL:", page.url());
    const listContent = await page.textContent("#app");
    console.log("Movie list content preview:", listContent?.substring(0, 300));

    await page.screenshot({ path: "e2e/screenshots/03-movie-list.png", fullPage: true });

    // Report console logs
    console.log("\n=== Console Logs ===");
    consoleLogs.forEach(log => console.log(log));

    // Check for errors
    if (pageErrors.length > 0) {
      console.log("\n=== Page Errors ===");
      pageErrors.forEach(err => console.log("ERROR:", err));
    }

    // Basic assertions
    expect(await page.title()).toContain("MovieModelEditor");
    expect(pageErrors.length).toBe(0);
  });
});
