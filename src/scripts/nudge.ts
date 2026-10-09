/** 11 a pointing hand nudges the hero's main call to action, once, after 6s idle with it in view. */
import { $, A, EASE, on, rest } from "./dom";

const stage = $("[data-nudge-stage]");
const el = stage && $(".nudge", stage);
const state = { timer: 0, done: false, visible: false };
const showStatic = () => el?.classList.remove("is-waiting");

function arm() {
  clearTimeout(state.timer);
  if (!el || state.done || !state.visible) return;
  if (!on()) return showStatic();
  state.timer = window.setTimeout(() => {
    state.done = true;
    el.classList.remove("is-waiting");
    const r = rest(el);
    A(
      el,
      [
        { transform: `${r} translateX(-26px) scale(.9)`, opacity: 0 },
        { transform: r, opacity: 1 },
      ],
      {
        duration: 520,
        easing: EASE.spring,
      }
    );
    A(
      $(".nudge__hand", el),
      [
        { transform: "none" },
        { transform: "translateX(9px)", offset: 0.2 },
        { transform: "none", offset: 0.4 },
        { transform: "translateX(9px)", offset: 0.6 },
        { transform: "none", offset: 0.8 },
        { transform: "none" },
      ],
      { duration: 1100, delay: 560, easing: "ease-in-out" }
    );
  }, 6000);
}

/** Pause or reduced motion: stop waiting and show the hand at rest if the hero is in view. */
export function stopNudge() {
  clearTimeout(state.timer);
  if (state.visible) showStatic();
}

export function initNudge() {
  if (!stage || !el) return;
  new IntersectionObserver(
    ([e]) => {
      state.visible = (e?.intersectionRatio ?? 0) >= 0.5;
      arm();
    },
    { threshold: [0, 0.5, 1] }
  ).observe(stage);
  for (const ev of ["scroll", "pointerdown", "keydown"])
    addEventListener(
      ev,
      () => {
        if (!state.done) arm();
      },
      { passive: true }
    );
}
