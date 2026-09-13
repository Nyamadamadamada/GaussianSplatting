// オープニングの画面制御。
// 場面 1 で Qiitan が下から飛び出して着地し、題名を見せてから部屋へ切り替える。
// 場面 2 で右下から Qiitan が顔を出し、画面を操作したら消える

import { type OpeningTiming, timingFor } from "./opening";

// 頂点の高さと、画面外の待機位置。床からの距離を画面の高さで指定する
const APEX = "-40vh";
const BELOW_SCREEN = "60vh";
// 昇っている間の形。横を縮めて縦に伸ばし、勢いよく飛び出して見せる。支点は画像の下端
const LAUNCH_SQUEEZE = "scale(0.86, 1.08)";

// 飛び出しは勢いよく出て頂点で止まり、落下は加速して床に当たる。
// 顔出しは少し行き過ぎてから戻る
const EASE_OUT = "cubic-bezier(0.1, 0.8, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.6, 0, 0.9, 0.4)";
const EASE_BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// 顔出しの止まる位置。写真の 3 割ほどが画面の外に隠れる量にする。
// style.css の peek-rest と同じ値にそろえる
const PEEK_REST = "translate(30%, 25%) rotate(-15deg)";

export type OpeningElements = {
  root: HTMLElement;
  qiitan: HTMLImageElement;
  shadow: HTMLElement;
  titles: HTMLImageElement[];
  peek: HTMLImageElement;
  // 画面の操作を受け取る要素。ここを操作したら顔出しを消す
  stage: HTMLElement;
};

function animate(element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<unknown> {
  return element.animate(keyframes, { fill: "forwards", ...options }).finished;
}

export class Opening {
  private readonly elements: OpeningElements;
  private readonly timing: OpeningTiming;
  private landed: Promise<void> | null = null;
  private revealed: Promise<void> | null = null;

  constructor(elements: OpeningElements) {
    this.elements = elements;
    this.timing = timingFor(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // 場面 1 を始める。飛び出しから題名の表示までを進め、止めた状態で終わる
  play(): Promise<void> {
    this.landed ??= this.playScene1().catch((error: unknown) => {
      console.error(error);
    });
    return this.landed;
  }

  // 場面 1 を終えるまで待ってから、覆いを消して部屋を見せる。何度呼んでも 1 回だけ行う
  reveal(): Promise<void> {
    this.revealed ??= this.play().then(async () => {
      const { root } = this.elements;
      await animate(root, [{ opacity: 1 }, { opacity: 0 }], { duration: this.timing.fadeMs, easing: "ease-in" });
      root.hidden = true;
    });
    return this.revealed;
  }

  // 場面 2。右下から顔を出し、画面を操作したら消える
  peek(): void {
    const { peek, stage } = this.elements;
    peek.hidden = false;
    const entry = peek.animate(
      [{ transform: "translate(70%, 70%) rotate(0deg)" }, { transform: PEEK_REST }],
      { duration: this.timing.peekMs, easing: EASE_BOUNCE, fill: "forwards" },
    );
    // 登場の終点で止まる位置は CSS の peek-rest に持たせ、スクリプトのアニメーションは止まった時点で取り消す
    void entry.finished.then(() => {
      peek.classList.add("peek-rest");
      entry.cancel();
    });

    const hide = (): void => {
      stage.removeEventListener("pointerdown", hide);
      stage.removeEventListener("wheel", hide);
      void animate(peek, [{ opacity: 1 }, { opacity: 0 }], { duration: this.timing.fadeMs }).then(() => {
        peek.hidden = true;
      });
    };
    stage.addEventListener("pointerdown", hide);
    stage.addEventListener("wheel", hide, { passive: true });
  }

  private async playScene1(): Promise<void> {
    const { root, qiitan, shadow, titles } = this.elements;
    const { launchMs, fallMs, landMs, titleMs, holdMs } = this.timing;

    // 背景は CSS で当ててある。飛び出す途中で背景や題名が現れないよう、読み込み終えてから始める。
    // 読み込めない場合は塗りの色のまま進める
    const background = new Image();
    background.src = getComputedStyle(root).backgroundImage.match(/url\("?(.+?)"?\)/)?.[1] ?? "";
    await Promise.all([background, qiitan, ...titles].map((image) => image.decode())).catch(() => undefined);

    // 1. 下から飛び出す。昇っている間は横幅を少し縮めて縦に伸ばし、頂点で元の形に戻す。
    // 途中の位置は直線上の点にして、形を変えても軌道が変わらないようにする
    const launchY = (t: number): string => `calc(${BELOW_SCREEN} + (${APEX} - ${BELOW_SCREEN}) * ${t})`;
    await Promise.all([
      animate(
        qiitan,
        [
          { transform: `translate(-50%, ${BELOW_SCREEN}) scale(1, 1)` },
          { transform: `translate(-50%, ${launchY(0.2)}) ${LAUNCH_SQUEEZE}`, offset: 0.2 },
          { transform: `translate(-50%, ${launchY(0.8)}) ${LAUNCH_SQUEEZE}`, offset: 0.8 },
          { transform: `translate(-50%, ${APEX}) scale(1, 1)` },
        ],
        { duration: launchMs, easing: EASE_OUT },
      ),
      animate(shadow, [{ transform: "translate(-50%, 0) scale(0.9)", opacity: 0 }, { transform: "translate(-50%, 0) scale(0.4)", opacity: 0.12 }], {
        duration: launchMs,
        easing: EASE_OUT,
      }),
    ]);

    // 2. 着地する
    await Promise.all([
      animate(
        qiitan,
        [{ transform: `translate(-50%, ${APEX})` }, { transform: "translate(-50%, 0)" }],
        { duration: fallMs, easing: EASE_IN },
      ),
      animate(shadow, [{ transform: "translate(-50%, 0) scale(0.4)", opacity: 0.12 }, { transform: "translate(-50%, 0) scale(1)", opacity: 0.35 }], {
        duration: fallMs,
        easing: EASE_IN,
      }),
    ]);

    // 着地の衝撃。つぶれて戻り、画面が少し揺れ、題名が現れる
    const squash = animate(
      qiitan,
      [
        { transform: "translate(-50%, 0) scale(1, 1)" },
        { transform: "translate(-50%, 0) scale(1.22, 0.78)", offset: 0.4 },
        { transform: "translate(-50%, 0) scale(1, 1)" },
      ],
      { duration: landMs, easing: "ease-out" },
    );
    const shake = animate(
      root,
      [{ transform: "none" }, { transform: "translateY(7px)", offset: 0.3 }, { transform: "translateY(-3px)", offset: 0.65 }, { transform: "none" }],
      { duration: landMs, fill: "none" },
    );
    // 題名は着地の衝撃に合わせて左右同時に出す
    const reveals = titles.map((title) =>
      animate(title, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], {
        duration: titleMs,
        easing: "ease-out",
      }),
    );
    await Promise.all([squash, shake, ...reveals]);

    await new Promise((resolve) => setTimeout(resolve, holdMs));
  }
}
