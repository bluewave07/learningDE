// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");

const APP = "file://" + path.resolve(__dirname, "..", "index.html");
const open = (page, route = "home") => page.goto(`${APP}#/${route}`);

/** marks today's shadowing goal as completed so the rest of the app unlocks */
async function unlock(page) {
  await page.evaluate(() => { window.App.day().sh = 9999; window.App.save(); });
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => { throw err; });
  await open(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe("daily shadowing gate", () => {
  test("locks practice areas until shadowing is done", async ({ page }) => {
    await open(page, "themes");
    await expect(page.getByRole("heading", { name: "Erst Shadowing, dann der Rest" })).toBeVisible();
    await expect(page.locator("#gatebar")).toContainText("Shadowing: noch 5:00");
  });

  test("home and shadowing stay open", async ({ page }) => {
    await open(page, "home");
    await expect(page.getByText("Dein Tagesplan")).toBeVisible();
    await open(page, "shadow");
    await expect(page.locator(".shadow-sent")).toBeVisible();
  });

  test("rating requires repeating first and is stored", async ({ page }) => {
    await open(page, "shadow");
    const good = page.getByRole("button", { name: "🙂 Gut" });
    await expect(good).toBeDisabled();
    await page.getByRole("button", { name: "✓ Nachgesprochen" }).click();
    await good.click();
    const graded = await page.evaluate(() => Object.keys(window.App.S.shadow).length);
    expect(graded).toBe(1);
  });

  test("unlocks everything once the goal is reached", async ({ page }) => {
    await unlock(page);
    await open(page, "themes");
    await expect(page.getByRole("heading", { name: "Themen" })).toBeVisible();
    await expect(page.locator("#gatebar")).toContainText("erledigt");
  });
});

test.describe("content", () => {
  test.beforeEach(async ({ page }) => unlock(page));

  test("ships at least 3,000 words and 300 shadowing sentences", async ({ page }) => {
    const counts = await page.evaluate(() => ({ words: window.App.W.length, shadow: window.App.SH.length }));
    expect(counts.words).toBeGreaterThanOrEqual(3000);
    expect(counts.shadow).toBe(300);
  });

  test("every route renders", async ({ page }) => {
    const routes = ["home", "learn", "themes", "theme/qa", "theme/qa/read", "theme/qa/dialog", "theme/qa/test", "lesson/qa/0", "lesson/qa/0/flash",
      "lesson/qa/0/listen", "lesson/qa/0/speak", "lesson/qa/0/test", "stories", "stories/0", "convs", "convs/0", "convs/0/role", "notebook", "search",
      "test", "speak", "settings", "shadow/groups", "shadow/groups/0"];
    for (const r of routes) {
      await open(page, r);
      await expect(page.locator("#main h1").first(), r).toBeVisible();
    }
  });

  test("flashcards grade words into spaced repetition", async ({ page }) => {
    await open(page, "lesson/agile/0/flash");
    await page.locator("#fc .ff").click();
    await page.getByRole("button", { name: /Gut/ }).click();
    const level = await page.evaluate(() => Object.values(window.App.S.words)[0].b);
    expect(level).toBe(1);
  });

  test("a lesson quiz can be completed", async ({ page }) => {
    await open(page, "lesson/arbeit/0/test");
    for (let i = 0; i < 10; i++) {
      await page.locator("#q .opt").first().click();
      await page.locator("[data-n]").click();
    }
    await expect(page.getByText(/richtig · correct/)).toBeVisible();
  });

  test("tapping a word in a story shows its translation", async ({ page }) => {
    await open(page, "stories/2");
    await page.locator(".tok").first().click();
    await expect(page.locator(".pop")).toBeVisible();
  });

  test("sentences can be saved to the notebook", async ({ page }) => {
    await open(page, "stories/0");
    await page.locator("[data-save]").first().click();
    await open(page, "notebook");
    await expect(page.locator(".lrow")).toHaveCount(1);
  });

  test("search finds German, English and Turkish", async ({ page }) => {
    await open(page, "search");
    for (const q of ["Kündigung", "deployment", "kira"]) {
      await page.locator("#q").fill(q);
      await expect(page.locator("#res .lrow").first(), q).toBeVisible();
    }
  });

  test("progress survives a reload", async ({ page }) => {
    await open(page, "lesson/qa/0/flash");
    await page.locator("#fc .ff").click();
    await page.getByRole("button", { name: /Leicht/ }).click();
    await page.reload();
    const n = await page.evaluate(() => Object.keys(window.App.S.words).length);
    expect(n).toBe(1);
  });
});
