/**
 * Shared helpers for the site scripts.
 * Contract: the resting DOM is the finished state. Every one-shot animates FROM a start frame TO it
 * (fill: "backwards"), so motion off, reduced motion, a cancelled animation or a JS failure all show finished content.
 */
import { PHONE_MAX, motion } from "@proudindian/design/tokens";

export const D = document.documentElement;
export const $ = <T extends Element = HTMLElement>(
  s: string,
  r: ParentNode = document
) => r.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(
  s: string,
  r: ParentNode = document
) => [...r.querySelectorAll<T>(s)];

export const RM = matchMedia("(prefers-reduced-motion: reduce)");
export const PHONE = matchMedia(`(max-width: ${PHONE_MAX}px)`);
export const HOVER = matchMedia("(hover: hover) and (pointer: fine)").matches;

export const EASE = motion.ease;

/** motion is on unless Pause or reduced motion turned it off */
export const on = () => D.dataset.motion === "on";

/** A one-shot Web Animation that resolves to the element's resting state; null when motion is off. */
export function A(
  el: Element | null | undefined,
  kf: Keyframe[] | PropertyIndexedKeyframes,
  o: KeyframeAnimationOptions = {}
): Animation | null {
  return on() && el
    ? el.animate(kf, { fill: "backwards", easing: EASE.settle, ...o })
    : null;
}

/** the element's own resting transform, so one-shots can composite on top of it */
export const rest = (el: Element) => {
  const t = getComputedStyle(el).transform;
  return t === "none" ? "none" : t;
};

export const isCss = (a: Animation) =>
  ("CSSAnimation" in window && a instanceof CSSAnimation) ||
  ("CSSTransition" in window && a instanceof CSSTransition);

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const inView = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.top < innerHeight && r.bottom > 0;
};

/** requestAnimationFrame-throttled scroll listener */
export function onScrollFrame(fn: () => void) {
  let raf = 0;
  addEventListener(
    "scroll",
    () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          fn();
        });
    },
    { passive: true }
  );
}
