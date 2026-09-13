# Qiitan 落下サイト

3D Gaussian Splatting で作った Qiitan をブラウザに表示し、看板をクリックすると画面上から降ってくる静的サイトです。
表示は three.js と Spark、落下は three.js の RapierPhysics アドオンで実現しています。調整方法や設計の背景は `../doc/記事メモ.md` にあります。

## 構成

| パス | 役割 |
|---|---|
| `src/main.ts` | シーンと部屋の組み立て、看板の配線 |
| `src/qiitan.ts` | SplatMesh と物理演算用カプセルの組 |
| `src/falling.ts` | 落下位置や初速などの純粋な計算 |
| `src/opening.ts`、`src/openingScene.ts` | オープニングの時間配分と画面制御 |
| `public/models/export_05000.spz` | 表示する Qiitan。差し替えたら `src/main.ts` の `SPLAT_URL` を変える |
| `public/models/niko_7000.spz` | 違うタイプの Qiitan。3 回に 1 回降る。差し替えたら `src/main.ts` の `NIKO_SPLAT_URL` を変える |
| `public/img/` | オープニングと看板の画像 |
| `public/textures/` | 壁紙と床材。ambientCG の CC0 素材 |
| `tests/unit/`、`tests/e2e/` | Vitest の単体テストと Playwright の画面テスト |

## 使い方

```sh
npm install
npx playwright install chromium   # 画面テストを実行する場合のみ
npm run dev        # 開発サーバー
npm run build      # 型チェックと本番ビルド。GitHub Pages 用にリポジトリ直下の docs/ に出力
npm run preview    # ビルド成果物の確認
npm test           # 単体テスト
npm run test:e2e   # 画面テスト。ビルドしてから preview サーバーで実行
```

RapierPhysics アドオンは Rapier 本体を CDN から読み込むため、実行時にインターネット接続が必要です。

URL に `?initial=0` を付けると読み込み時に自動で降らせる数を変えられ、`?opening=0` を付けるとオープニングを省略できます。
