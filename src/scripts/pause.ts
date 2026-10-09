/** Pause motion: site-wide and persisted (WCAG 2.2.2). Reduced motion keeps everything off regardless. */
import { clearCoins } from "./coins";
import { $$, D, RM, isCss } from "./dom";
import { stopNudge } from "./nudge";
import { flushReveals } from "./reveal";

const KEY = "pi-motion-paused";

export function initPause() {
  const buttons = $$<HTMLButtonElement>("[data-pause]");
  const status = document.getElementById("pm-s");
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    saved = null;
  }
  const set = (paused: boolean) => {
    const off = paused || RM.matches;
    D.dataset.motion = off ? "off" : "on";
    for (const b of buttons) b.setAttribute("aria-pressed", String(off));
    const b = buttons[0];
    if (status && b)
      status.textContent = RM.matches
        ? b.dataset.reduced!
        : paused
          ? b.dataset.paused!
          : b.dataset.idle!;
    if (off) {
      for (const a of document.getAnimations()) if (!isCss(a)) a.cancel();
      clearCoins();
      flushReveals();
      stopNudge();
    }
  };
  set(saved === "1");
  for (const b of buttons)
    b.addEventListener("click", () => {
      const p = saved !== "1";
      saved = p ? "1" : "0";
      try {
        localStorage.setItem(KEY, saved);
      } catch {
        /* private mode: the choice lasts for this page only */
      }
      set(p);
    });
  RM.addEventListener("change", () => set(saved === "1"));
}
