import { defineConfig, devices } from "@playwright/test";

const EDITOR_URL = process.env.E2E_EDITOR_URL || "http://127.0.0.1:5173";
const API_URL = process.env.E2E_EDITOR_API_URL || "http://127.0.0.1:4000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 120000,

  use: {
    baseURL: EDITOR_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      command: "npm --prefix ../movie-models-server start",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    },
    {
      command: "npx vite --mode development.tenant --host 127.0.0.1 --port 5173",
      url: EDITOR_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    }
  ]
});
