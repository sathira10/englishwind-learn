import { expect, test } from "@playwright/test";

test("a signed-out student is sent to sign-in, with the way back kept", async ({ page }) => {
  await page.goto("/courses/blueprint/lessons/03");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcourses%2Fblueprint%2Flessons%2F03$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("the sign-in screen offers the email code and has no sideways scroll at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("the API answers through the Worker", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ ok: true, db: true });
});
