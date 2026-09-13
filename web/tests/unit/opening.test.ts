import { describe, expect, it } from "vitest";
import { OPENING_TIMING, timingFor } from "../../src/opening";

describe("timingFor", () => {
  it("通常は基準どおり、動きを減らす設定では移動と変形だけを 0 にし、基準は書き換えない", () => {
    const base = { ...OPENING_TIMING };
    expect(timingFor(false, base)).toEqual(OPENING_TIMING);

    const reduced = timingFor(true, base);
    expect(reduced).toEqual({
      ...OPENING_TIMING,
      launchMs: 0,
      fallMs: 0,
      landMs: 0,
      titleMs: 0,
      peekMs: 0,
    });
    expect(base).toEqual(OPENING_TIMING);
  });
});
