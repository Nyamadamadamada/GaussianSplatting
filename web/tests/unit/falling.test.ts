import { describe, expect, it } from "vitest";
import {
  capsuleFor,
  fitScale,
  nudgeImpulse,
  spawnAngularVelocity,
  spawnPosition,
  spawnRotation,
  spawnVelocity,
} from "../../src/falling";

// 固定の乱数列を順に返す。尽きたら最後の値を繰り返す
function sequence(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

// 乱数 1 に最も近い値。上限側の境界を確認するときに使う
const ALMOST_ONE = 0.999999;

describe("fitScale", () => {
  it("最長辺が目標サイズになるスケールを返し、サイズが 0 なら例外を投げる", () => {
    expect(fitScale({ x: 2, y: 4, z: 1 }, 1.2)).toBeCloseTo(0.3);
    expect(() => fitScale({ x: 0, y: 0, z: 0 }, 1)).toThrow();
  });
});

describe("spawnPosition", () => {
  const area = { minZ: -4, maxZ: 2, halfWidth: 4, topY: 3, margin: 0.6 };

  it("奥行きと横位置は範囲の両端に収まり、高さは基準に余白を足した位置になる", () => {
    // 最初の乱数が奥行き、次の乱数が横位置
    const low = spawnPosition(sequence([0, 0]), area);
    expect(low).toEqual({ x: -4, y: 3.6, z: -4 });

    const high = spawnPosition(sequence([ALMOST_ONE, ALMOST_ONE]), area);
    expect(high.z).toBeLessThanOrEqual(2);
    expect(high.x).toBeLessThanOrEqual(4);
    expect(high.y).toBeCloseTo(3.6);
  });

  it("半幅が負のときは横位置を 0 に固定して範囲外へ出さない", () => {
    expect(spawnPosition(sequence([0.5, 0.1]), { ...area, halfWidth: -1 }).x).toBe(0);
  });
});

describe("初速と姿勢の乱数", () => {
  it("横速度は横方向だけに持ち、乱数の両端が上限の両端になる", () => {
    expect(spawnVelocity(() => 0, 1.5)).toEqual({ x: -1.5, y: 0, z: 0 });
    expect(spawnVelocity(() => ALMOST_ONE, 1.5).x).toBeCloseTo(1.5, 4);
  });

  it("姿勢、角速度、転がす力は各軸に別々の乱数を使う", () => {
    const rotation = spawnRotation(sequence([0, 0.5, 0.25]));
    expect(rotation.x).toBeCloseTo(0);
    expect(rotation.y).toBeCloseTo(Math.PI);
    expect(rotation.z).toBeCloseTo(Math.PI / 2);

    const spin = spawnAngularVelocity(sequence([0, 1, 0.5]), 4);
    expect(spin.x).toBeCloseTo(-4);
    expect(spin.y).toBeCloseTo(4);
    expect(spin.z).toBeCloseTo(0);

    // 上向きは固定値、横向きだけ乱数
    const impulse = nudgeImpulse(sequence([0, 1]), 3, 1.5);
    expect(impulse.y).toBe(3);
    expect(impulse.x).toBeCloseTo(-1.5);
    expect(impulse.z).toBeCloseTo(1.5);
  });
});

describe("capsuleFor", () => {
  it("縦長なら横幅を半径にして残りを円筒に、横長なら高さの半分を半径にして円筒は 0 にする", () => {
    const tall = capsuleFor({ x: 0.6, y: 1.2, z: 0.4 });
    expect(tall.radius).toBeCloseTo(0.3);
    expect(tall.length).toBeCloseTo(0.6);

    const wide = capsuleFor({ x: 1.2, y: 0.5, z: 1.0 });
    expect(wide.radius).toBeCloseTo(0.25);
    expect(wide.length).toBe(0);
  });
});
