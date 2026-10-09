/** 06 rupee coins drop into the matka when an amount is picked. Never blocks the button. */
import { $, $$, A, EASE, on, rnd } from "./dom";

const RUPEE = "M-6.5-9H7M-6.5-3.8H7M-3-9C5.5-9 5.5 1.4-3 1.4H-5.5L5 11";
const coinSvg =
  '<circle cx="2.5" cy="3.5" r="16" fill="#0F1B24"/><circle r="16" fill="#F6F2EA" stroke="#0F1B24" stroke-width="2.5"/>' +
  `<path d="${RUPEE}" fill="none" stroke="#0F1B24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;

/** at most this many coins in flight per matka: rapid taps drop the oldest instead of piling up */
const MAX_COINS = 6;
/** the running pot squash per pot, so a new drop replaces it instead of stacking on it */
const squash = new WeakMap<Element, Animation>();

export function dropCoins(scope: ParentNode, n: number) {
  if (!on()) return;
  for (const m of $$(".matka", scope)) {
    const g = $(".coins", m);
    const pot = $(".pot", m);
    if (!g) continue;
    for (let i = 0; i < n; i++) {
      // the oldest coin goes first (its animation's cancel removes it)
      while (g.children.length >= MAX_COINS) {
        const old = g.firstElementChild!;
        old.getAnimations().forEach((a) => a.cancel());
        old.remove();
      }
      const x = 120 + rnd(-10, 10);
      const r0 = rnd(-60, 60);
      const c = document.createElementNS("http://www.w3.org/2000/svg", "g");
      c.setAttribute("class", "coin");
      c.innerHTML = coinSvg;
      g.append(c);
      const a = c.animate(
        [
          {
            transform: `translate(${x + rnd(-30, 30)}px,-70px) rotate(${r0}deg)`,
            opacity: 0,
          },
          { opacity: 1, offset: 0.12 },
          {
            transform: `translate(${x}px,84px) rotate(${r0 + rnd(160, 260)}deg)`,
            opacity: 1,
          },
        ],
        { duration: 640, delay: i * 120, easing: EASE.fall, fill: "both" }
      );
      a.onfinish = a.oncancel = () => c.remove();
    }
    // one squash per drop, as the first coin lands; a running one is cancelled first so taps never stack them
    if (!pot) continue;
    squash.get(pot)?.cancel();
    const s = A(
      pot,
      [
        { transform: "none" },
        { transform: "scale(1.035,.95)", offset: 0.35 },
        { transform: "scale(.985,1.025)", offset: 0.7 },
        { transform: "none" },
      ],
      { duration: 360, delay: 470, easing: "ease-out" }
    );
    if (s) squash.set(pot, s);
  }
}

export const clearCoins = () => $$(".coins .coin").forEach((n) => n.remove());
