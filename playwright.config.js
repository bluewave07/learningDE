// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const path = require("path");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "file://" + path.resolve(__dirname, "index.html"),
    trace: "retain-on-failure",
    // set CHROME_PATH to use an installed Chrome instead of the bundled Chromium
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
