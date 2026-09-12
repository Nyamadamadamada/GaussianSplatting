import { describe, expect, it } from "vitest";
import {
  capsuleFor,
  fitScale,
  randomBetween,
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

describe("fitScale", () => {
  it("最長辺が目標サイズになるスケールを返す", () => {
    expect(fitScale({ x: 2, y: 4, z: 1 }, 1.2)).toBeCloseTo(0.3);
  });

  it("サイズが 0 のときは例外を投げる", () => {
    expect(() => fitScale({ x: 0, y: 0, z: 0 }, 1)).toThrow();
  });
});

describe("randomBetween", () => {
  it("乱数 0 で下限、乱数 1 直前で上限に近づく", () => {
    expect(randomBetween(() => 0, -3, 3)).toBe(-3);
    expect(randomBetween(() => 0.999999, -3, 3)).toBeCloseTo(3, 4);
  });
});

describe("spawnPosition", () => {
  const area = { minZ: -4, maxZ: 2, halfWidth: 4, topY: 3, margin: 0.6 };

  it("最初の乱数で奥行きを選び、y は基準の高さに余白を足した位置になる", () => {
    const p = spawnPosition(sequence([0, 0.5]), area);
    expect(p.z).toBe(-4);
    expect(p.y).toBeCloseTo(3.6);
    expect(p.x).toBe(0);
  });

  it("x は半幅の範囲に収まる", () => {
    expect(spawnPosition(sequence([0.5, 0]), area).x).toBe(-4);
    expect(spawnPosition(sequence([0.5, 0.999999]), area).x).toBeLessThanOrEqual(4);
  });

  it("奥行きは範囲に収まる", () => {
    expect(spawnPosition(sequence([0.5, 0.5]), area).z).toBe(-1);
    expect(spawnPosition(sequence([0.999999, 0.5]), area).z).toBeLessThanOrEqual(2);
  });

  it("半幅が負でも x は 0 に固定され、範囲外へ出ない", () => {
    expect(spawnPosition(sequence([0.5, 0.1]), { ...area, halfWidth: -1 }).x).toBe(0);
  });
});

describe("spawnVelocity", () => {
  it("横方向だけに速度を持ち、縦と奥行きは 0", () => {
    const v = spawnVelocity(() => 1, 1.5);
    expect(v.x).toBeCloseTo(1.5);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  it("上限を超えない", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(Math.abs(spawnVelocity(() => r, 1.5).x)).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("spawnRotation", () => {
  it("各軸に別々の乱数を使い、0 以上 2π 未満に収まる", () => {
    const r = spawnRotation(sequence([0, 0.5, 0.25]));
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(Math.PI);
    expect(r.z).toBeCloseTo(Math.PI / 2);
  });
});

describe("spawnAngularVelocity", () => {
  it("各軸が上限の範囲に収まる", () => {
    const w = spawnAngularVelocity(sequence([0, 1, 0.5]), 4);
    expect(w.x).toBeCloseTo(-4);
    expect(w.y).toBeCloseTo(4);
    expect(w.z).toBeCloseTo(0);
  });
});

describe("capsuleFor", () => {
  it("縦長なら横幅を半径、残りを円筒の長さにする", () => {
    const c = capsuleFor({ x: 0.6, y: 1.2, z: 0.4 });
    expect(c.radius).toBeCloseTo(0.3);
    expect(c.length).toBeCloseTo(0.6);
  });

  it("横長なら高さの半分を半径にし、円筒の長さは 0 になる", () => {
    const c = capsuleFor({ x: 1.2, y: 0.5, z: 1.0 });
    expect(c.radius).toBeCloseTo(0.25);
    expect(c.length).toBe(0);
  });
});
