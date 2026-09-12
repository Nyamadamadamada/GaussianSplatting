import { defineConfig } from "vitest/config";

// 単体テストだけを対象にする。画面テストは Playwright で別に実行する
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
