import { expect, test } from "@playwright/test";

test("the app shell loads and a client route survives reload", async ({ page }) => {
  await page.goto("/courses/blueprint");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("EnglishWind Learn");
});

test("the API answers through the Worker", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ ok: true, db: true });
});
