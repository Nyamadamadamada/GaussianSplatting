import { expect, test } from "@playwright/test";

test("場面 1 で Qiitan が飛び出して着地し、題名が出てから部屋が現れ、そのあとで最初の落下が始まる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const opening = page.locator("#opening");
  const sign = page.getByRole("button", { name: "Qiitan を降らせる" });
  await expect(opening).toBeVisible();
  await expect(opening).toHaveCSS("background-image", /green_paint06\.jpg/);

  // 着地すると題名の画像が見える。飛び出す前は透明で見えない
  const title = opening.getByAltText("3D Gaussian Splatting きーたん");
  await expect(title).toHaveAttribute("src", /title\.png/);
  await expect(title).toHaveCSS("opacity", "1");

  // 読み込みは終わっていても、覆いが消えるまでは降らせない
  await expect(sign).toBeEnabled();
  await expect(opening).toBeVisible();
  await expect(sign).not.toHaveAttribute("data-count", "10");

  // 題名を見せたあと、覆いが消えてから 10 体が降る
  await expect(opening).toBeHidden();
  await expect(sign).toHaveAttribute("data-count", "10");
  expect(errors).toEqual([]);
});

test("場面 2 で右下から Qiitan が顔を出して止まり、画面を操作すると消える", async ({ page }) => {
  await page.goto("/?initial=0");
  await expect(page.locator("#opening")).toBeHidden();

  const peek = page.locator("#peek");
  await expect(peek).toBeVisible();
  await expect(peek).toHaveClass(/peek-rest/);

  // 画面の回転と同じ操作をすると、顔出しが消える
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 + 40, viewport.height / 2);
  await page.mouse.up();
  await expect(peek).toBeHidden();
});
