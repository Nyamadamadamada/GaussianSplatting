import { defineConfig, devices } from "@playwright/test";

// 画面テスト。本番と同じビルド成果物を preview サーバーで配信して確認する
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      // headless shell は GPU を使えず描画が数 fps まで落ちるため、
      // GPU を使える新しいヘッドレスモードの Chromium で実行する
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
});
