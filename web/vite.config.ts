import { defineConfig } from "vite";

// GitHub Pages の「ブランチから配信」はルートか docs/ しか選べないため、リポジトリ直下の docs/ に出力する
// サイトは https://<user>.github.io/GaussianSplatting/ のようにサブパス配下で公開されるので、アセットのパスは相対にする
export default defineConfig({
  base: "./",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
