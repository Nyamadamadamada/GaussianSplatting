import { PNG } from "pngjs";
import { expect, test } from "@playwright/test";

// 2 枚のスクリーンショットで色が大きく変わった画素を数える
function countChangedPixels(a: Buffer, b: Buffer, region: { top: number; bottom: number }): number {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  let count = 0;
  for (let y = region.top; y < Math.min(region.bottom, pa.height); y++) {
    for (let x = 0; x < pa.width; x++) {
      const i = (pa.width * y + x) * 4;
      const diff =
        Math.abs(pa.data[i] - pb.data[i]) +
        Math.abs(pa.data[i + 1] - pb.data[i + 1]) +
        Math.abs(pa.data[i + 2] - pb.data[i + 2]);
      if (diff > 60) count++;
    }
  }
  return count;
}

test("読み込み後に 10 体が画面内に現れ、ボタンで 1 体増える", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const viewport = page.viewportSize()!;
  // ボタンとステータスの領域を避け、部屋が映る範囲だけを比較する
  const region = { top: Math.floor(viewport.height * 0.3), bottom: viewport.height };

  // 比較の基準として、Qiitan を降らせない状態の部屋を撮影する
  await page.goto("/?initial=0");
  await expect(page.getByRole("button", { name: "Qiitan を降らせる" })).toBeEnabled();
  await page.waitForTimeout(1000);
  const emptyRoom = await page.screenshot();

  await page.goto("/");
  const button = page.getByRole("button", { name: "Qiitan を降らせる" });
  await expect(button).toBeEnabled();
  await expect(page.locator("#status")).toHaveText("10 体");

  // 落下して床に着くまで待ってから撮影する
  await page.waitForTimeout(2500);
  const withQiitan = await page.screenshot();
  await testInfo.attach("with-qiitan", { body: withQiitan, contentType: "image/png" });
  expect(countChangedPixels(emptyRoom, withQiitan, region)).toBeGreaterThan(5000);

  await button.click();
  await expect(page.locator("#status")).toHaveText("11 体");
  expect(errors).toEqual([]);
});

test("連続で押すと体数が増える", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Qiitan を降らせる" });
  await expect(page.locator("#status")).toHaveText("10 体");

  await button.click();
  await button.click();
  await button.click();
  await expect(page.locator("#status")).toHaveText("13 体");
});

test("画面の操作案内は見出しで縮小と表示を切り替えられる", async ({ page }) => {
  await page.goto("/?initial=0");
  const help = page.locator("details.help");
  const title = help.locator("summary");
  await expect(help).toHaveAttribute("open", "");
  await expect(help.locator(".help-list")).toBeVisible();

  await title.click();
  await expect(help).not.toHaveAttribute("open", "");
  await expect(help.locator(".help-list")).toBeHidden();

  await title.click();
  await expect(help).toHaveAttribute("open", "");
  await expect(help.locator(".help-list")).toBeVisible();
});
