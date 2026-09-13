import { PNG } from "pngjs";
import { expect, test } from "@playwright/test";

// 2 枚のスクリーンショットで色が大きく変わった画素を数え、
// 変わった画素のうち重心に最も近いものも返す。Qiitan の上を確実に押す位置に使う
function diffPixels(
  a: Buffer,
  b: Buffer,
  region: { top: number; bottom: number },
): { count: number; nearestToCenter: { x: number; y: number } } {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  const changed: { x: number; y: number }[] = [];
  for (let y = region.top; y < Math.min(region.bottom, pa.height); y++) {
    for (let x = 0; x < pa.width; x++) {
      const i = (pa.width * y + x) * 4;
      const diff =
        Math.abs(pa.data[i] - pb.data[i]) +
        Math.abs(pa.data[i + 1] - pb.data[i + 1]) +
        Math.abs(pa.data[i + 2] - pb.data[i + 2]);
      if (diff > 60) changed.push({ x, y });
    }
  }
  if (changed.length === 0) return { count: 0, nearestToCenter: { x: 0, y: 0 } };
  const center = {
    x: changed.reduce((sum, p) => sum + p.x, 0) / changed.length,
    y: changed.reduce((sum, p) => sum + p.y, 0) / changed.length,
  };
  const nearestToCenter = changed.reduce((best, p) =>
    Math.hypot(p.x - center.x, p.y - center.y) < Math.hypot(best.x - center.x, best.y - center.y) ? p : best,
  );
  return { count: changed.length, nearestToCenter };
}

// 看板と状態表示の領域を避け、部屋が映る範囲だけを比較する
function roomRegion(page: import("@playwright/test").Page): { top: number; bottom: number } {
  const viewport = page.viewportSize()!;
  return { top: Math.floor(viewport.height * 0.3), bottom: viewport.height };
}

test("読み込み後に 10 体が画面内に現れ、看板をクリックすると揺れて 1 体増える", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const region = roomRegion(page);

  // 比較の基準として、Qiitan を降らせない状態の部屋を撮影する。
  // オープニングを省略した状態では、覆いも顔出しも出ず、操作案内は閉じている
  await page.goto("/?opening=0&initial=0");
  await expect(page.getByRole("button", { name: "Qiitan を降らせる" })).toBeEnabled();
  await expect(page.locator("#opening")).toBeHidden();
  await expect(page.locator("#peek")).toBeHidden();
  await expect(page.locator("details.help")).not.toHaveAttribute("open", "");
  await page.waitForTimeout(1000);
  const emptyRoom = await page.screenshot();

  await page.goto("/?opening=0");
  const sign = page.getByRole("button", { name: "Qiitan を降らせる" });
  await expect(sign).toBeEnabled();
  await expect(sign).toHaveAttribute("data-count", "10");

  // 落下して床に着くまで待ってから撮影する
  await page.waitForTimeout(2500);
  const withQiitan = await page.screenshot();
  await testInfo.attach("with-qiitan", { body: withQiitan, contentType: "image/png" });
  expect(diffPixels(emptyRoom, withQiitan, region).count).toBeGreaterThan(5000);

  await sign.click();
  await expect(sign).toHaveClass(/sign-swing/);
  await expect(sign).toHaveAttribute("data-count", "11");
  // 揺れが収まるとクラスが外れる
  await expect(sign).not.toHaveClass(/sign-swing/);
  expect(errors).toEqual([]);
});

test("Qiitan をタップすると転がって位置が変わる", async ({ page }) => {
  const region = roomRegion(page);

  await page.goto("/?opening=0&initial=0");
  const sign = page.getByRole("button", { name: "Qiitan を降らせる" });
  await expect(sign).toBeEnabled();
  await page.waitForTimeout(1000);
  const emptyRoom = await page.screenshot();

  // 少数だけ降らせ、Qiitan が映っている画素をタップ位置にする
  await page.goto("/?opening=0&initial=3");
  await expect(sign).toHaveAttribute("data-count", "3");
  await page.waitForTimeout(3000);
  const landed = await page.screenshot();
  const { count, nearestToCenter } = diffPixels(emptyRoom, landed, region);
  expect(count).toBeGreaterThan(500);

  await page.mouse.click(nearestToCenter.x, nearestToCenter.y);
  await page.waitForTimeout(1500);
  const afterTap = await page.screenshot();
  expect(diffPixels(landed, afterTap, region).count).toBeGreaterThan(500);
});
