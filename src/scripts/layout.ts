/** Layout helpers that need measured text. */
import { PHONE_MAX } from "@proudindian/design/tokens";

import { $, $$ } from "./dom";

/** Programme verbs fill their band's width, capped on desktop by the band's --verb-cap and half the viewport height.
 *  Text width scales with the font size, so each verb is measured at the size it has: every read first, then every
 *  write, one layout for all of them (no 100px measuring pass per verb). */
export function fitVerbs() {
  const desk = innerWidth > PHONE_MAX;
  const frac = desk ? 0.94 : 1;
  const sizes = $$(".verb").map((v) => {
    const cs = getComputedStyle(v);
    const f = parseFloat(cs.fontSize);
    const t = v.parentElement!.clientWidth * frac;
    const cap = desk
      ? Math.min(
          innerHeight * 0.5,
          parseFloat(cs.getPropertyValue("--verb-cap")) || 520
        )
      : 999;
    return [v, f, Math.min((f * t) / v.scrollWidth, cap)] as const;
  });
  // a sub-pixel change is rounding in the measurement: leave the verb (and the layout) alone
  for (const [v, f, size] of sizes)
    if (Math.abs(size - f) >= 0.5) v.style.fontSize = `${size}px`;
}

/** The featured session's programme name fills the poster width. */
export function fitProg() {
  const e = $(".pprog");
  if (!e) return;
  e.style.fontSize = "";
  const cs = getComputedStyle(e.parentElement!);
  const w =
    e.parentElement!.clientWidth -
    parseFloat(cs.paddingLeft) -
    parseFloat(cs.paddingRight);
  e.style.display = "inline-block";
  const f = parseFloat(getComputedStyle(e).fontSize);
  e.style.fontSize = `${Math.min(f, ((f * w) / e.scrollWidth) * 0.97)}px`;
  e.style.display = "";
}
