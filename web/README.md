# Qiitan 落下サイト

3D Gaussian Splatting で作った Qiitan をブラウザに表示し、ボタンを押すと画面上から降ってくる静的サイトです。
表示は three.js と Spark、落下は three.js の RapierPhysics アドオンで実現しています。

## 構成

| 役割 | 使うもの |
|---|---|
| ビルド | Vite |
| 3DGS 表示 | @sparkjsdev/spark の SplatMesh |
| 物理演算 | three/addons/physics/RapierPhysics.js |
| 単体テスト | Vitest |
| 画面テスト | Playwright |

- `src/falling.ts` は落下の開始位置や初速の計算だけをまとめた純粋な関数群です。
- `src/qiitan.ts` は SplatMesh と、物理演算用の見えないカプセルを 1 組にまとめたクラスです。
- `src/main.ts` はシーンの組み立てとボタンの配線です。
- `public/textures/` の壁紙と床材は ambientCG の CC0 素材です。Wallpaper001A と WoodFloor051 を使っています。
- `public/models/butterfly.spz` はサンプルの 3DGS データです。Qiitan の SPZ ができたら差し替え、`src/main.ts` の `SPLAT_URL` を更新してください。

## 部屋の構成

- 床、3 方の壁、白いソファーは `src/main.ts` の `buildRoom` と `buildSofa` で組み立てています。ソファーは箱の組み合わせで、各パーツがそのまま当たり判定になります。
- 部屋の大きさは `ROOM`、壁紙と床材の敷き詰め間隔は `WALLPAPER_TILE` と `FLOOR_TILE` で調整できます。
- URL に `?initial=0` のように付けると、読み込み時に自動で降らせる数を変えられます。
- 画面は three.js の OrbitControls で操作します。左ドラッグで回転、ホイールで距離、タッチは 1 本指で回転、2 本指で拡大縮小と移動です。操作方法は画面左下に表示し、見出しで縮小と表示を切り替えられます。
- カメラが壁の外側に回ると、その壁は半透明になって室内が見えます。不透明度は `WALL_OUTSIDE_OPACITY` で調整できます。

## 使い方

```sh
npm install
npx playwright install chromium   # 画面テストを実行する場合のみ
npm run dev        # 開発サーバー
npm run build      # 型チェックと本番ビルド。dist/ に出力
npm run preview    # ビルド成果物の確認
npm test           # 単体テスト
npm run test:e2e   # 画面テスト。ビルドしてから preview サーバーで実行
```

RapierPhysics アドオンは Rapier 本体を CDN から読み込むため、実行時にインターネット接続が必要です。

## 描画負荷の調整

- WebGLRenderer の antialias は必ず無効にします。Spark はアンチエイリアスを使うと大きく遅くなります。
- 全体のスプラット数は `src/main.ts` の `LOD_SPLAT_BUDGET` で上限を決め、Spark の LOD が超過分を間引きます。
- サンプルの butterfly.spz は約 18 万スプラットです。Qiitan の SPZ は SuperSplat でスプラット数を減らしてから配置すると、体数を増やしても軽くなります。
