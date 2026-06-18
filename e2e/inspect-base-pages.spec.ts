import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = "http://localhost:5175/static/base-pages-tenant";

const SCREENSHOT_DIR = path.resolve(__dirname, "screenshots", "base-pages");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

test("inspect base-pages login page", async ({ page }) => {
  await page.goto(BASE + "/#/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Full page screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-login-full.png"), fullPage: true });

  // Extract HTML structure
  const html = await page.content();
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "01-login-html.txt"), html);

  // Log visible text
  const text = await page.locator("body").innerText();
  console.log("=== LOGIN PAGE TEXT ===");
  console.log(text);

  // Extract styles of key elements
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).background);
  console.log("Body background:", bodyBg);

  // Check if there's a login form
  const loginForm = await page.locator(".login-form, form, .el-form").count();
  console.log("Login forms found:", loginForm);
});

test("inspect base-pages home page", async ({ page }) => {
  await page.goto(BASE + "/#/home", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-home-full.png"), fullPage: true });

  const html = await page.content();
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "02-home-html.txt"), html);

  const text = await page.locator("body").innerText();
  console.log("=== HOME PAGE TEXT ===");
  console.log(text);

  // Layout structure
  const sidebar = await page.locator(".el-menu, aside, .sidebar, nav").count();
  console.log("Sidebar/menu elements:", sidebar);
});

test("inspect base-pages movie list page", async ({ page }) => {
  await page.goto(BASE + "/#/movie/list", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-movie-list-full.png"), fullPage: true });

  const text = await page.locator("body").innerText();
  console.log("=== MOVIE LIST TEXT ===");
  console.log(text);
});
