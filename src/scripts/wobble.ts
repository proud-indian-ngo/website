/** 04 stickers wobble on hover (desktop) or tap. Not while the sticker is still arriving (its reveal or slap runs). */
import { $$, A, HOVER, isCss, rest } from "./dom";

const wob = new WeakMap<Element, Animation | null>();

/** still arriving: a reveal (Web Animation) or the hero's CSS load slap (ld-*) is running on it */
const busy = (el: Element) =>
  el
    .getAnimations()
    .some(
      (a) =>
        a !== wob.get(el) &&
        a.playState === "running" &&
        (!isCss(a) ||
          (a instanceof CSSAnimation && a.animationName.startsWith("ld-")))
    );

function wobble(el: Element) {
  if (wob.get(el)?.playState === "running" || busy(el)) return;
  const r = rest(el);
  const t = r === "none" ? "" : r;
  wob.set(
    el,
    A(
      el,
      [
        { transform: r },
        { transform: `${t} translateY(-6px) rotate(-4deg)`, offset: 0.28 },
        { transform: `${t} translateY(-3px) rotate(3deg)`, offset: 0.6 },
        { transform: r },
      ],
      { duration: 480, easing: "ease-in-out" }
    )
  );
}

export function initWobble() {
  for (const w of $$(".wob")) {
    if (HOVER) w.addEventListener("pointerenter", () => wobble(w));
    w.addEventListener("pointerdown", () => wobble(w));
  }
}
