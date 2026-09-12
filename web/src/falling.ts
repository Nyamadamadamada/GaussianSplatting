// 落下の開始位置や初速など、純粋な計算だけをまとめる。
// three.js や物理エンジンに依存させず、単体テストで検証できるようにする。

export type Vec3 = { x: number; y: number; z: number };

// 0 以上 1 未満の乱数を返す関数。テストでは固定値を差し込む
export type Rng = () => number;

// 最長辺を targetSize に合わせるための一様スケール
export function fitScale(size: Vec3, targetSize: number): number {
  const longest = Math.max(size.x, size.y, size.z);
  if (longest <= 0) {
    throw new Error("サイズが 0 以下のため、スケールを求められません");
  }
  return targetSize / longest;
}

// min 以上 max 以下の範囲で乱数を引く
export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

export type SpawnArea = {
  // 落下位置として使う奥行きの範囲
  minZ: number;
  maxZ: number;
  // 収めたい x の半幅。Qiitan の半幅を引いた値を渡す
  halfWidth: number;
  // 開始位置の高さの基準。壁の上端など、見えている範囲の上を渡す
  topY: number;
  // 基準からどれだけ上に出して開始するか
  margin: number;
};

// 奥行きと横位置をランダムに選び、基準の高さより上を開始位置にする
export function spawnPosition(rng: Rng, area: SpawnArea): Vec3 {
  const z = randomBetween(rng, area.minZ, area.maxZ);
  const halfWidth = Math.max(area.halfWidth, 0);
  return {
    x: randomBetween(rng, -halfWidth, halfWidth),
    y: area.topY + area.margin,
    z,
  };
}

// 横方向だけランダムな初速。落下は重力に任せる
export function spawnVelocity(rng: Rng, maxSideways: number): Vec3 {
  return { x: randomBetween(rng, -maxSideways, maxSideways), y: 0, z: 0 };
}

// 全軸ランダムな初期姿勢。オイラー角のラジアンで返す
export function spawnRotation(rng: Rng): Vec3 {
  const full = Math.PI * 2;
  return {
    x: randomBetween(rng, 0, full),
    y: randomBetween(rng, 0, full),
    z: randomBetween(rng, 0, full),
  };
}

// 回転しながら落ちるように、全軸ランダムな角速度
export function spawnAngularVelocity(rng: Rng, maxSpin: number): Vec3 {
  return {
    x: randomBetween(rng, -maxSpin, maxSpin),
    y: randomBetween(rng, -maxSpin, maxSpin),
    z: randomBetween(rng, -maxSpin, maxSpin),
  };
}

export type CapsuleSize = {
  // 半球部分の半径
  radius: number;
  // 円筒部分の長さ。three.js の CapsuleGeometry の height と同じ意味
  length: number;
};

// Qiitan の外接ボックスから、縦軸に沿ったカプセルの寸法を求める
export function capsuleFor(size: Vec3): CapsuleSize {
  const radius = Math.min(Math.max(size.x, size.z) / 2, size.y / 2);
  const length = Math.max(size.y - radius * 2, 0);
  return { radius, length };
}
