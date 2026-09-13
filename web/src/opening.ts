// オープニングの時間配分。
// DOM や three.js に依存させず、単体テストで検証できるようにする。

export type OpeningTiming = {
  // 場面 1。下から飛び出して頂点に達するまで
  launchMs: number;
  // 場面 1。頂点から床に落ちるまで
  fallMs: number;
  // 場面 1。着地でつぶれて元に戻るまで
  landMs: number;
  // 場面 1。題名が現れるまで
  titleMs: number;
  // 場面 1。題名を見せたまま止める時間
  holdMs: number;
  // 場面 1 から部屋へ切り替わるフェード
  fadeMs: number;
  // 場面 2。右下から顔を出すまで
  peekMs: number;
};

export const OPENING_TIMING: OpeningTiming = {
  launchMs: 650,
  fallMs: 550,
  landMs: 220,
  titleMs: 400,
  holdMs: 1100,
  fadeMs: 700,
  peekMs: 600,
};

// 動きを減らす設定の端末では、移動と変形の時間を 0 にして表示の切り替えだけを残す
export function timingFor(reducedMotion: boolean, base: OpeningTiming = OPENING_TIMING): OpeningTiming {
  if (!reducedMotion) return { ...base };
  return { ...base, launchMs: 0, fallMs: 0, landMs: 0, titleMs: 0, peekMs: 0 };
}
