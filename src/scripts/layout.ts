/** Layout helpers that need measured text. */
import { PHONE_MAX } from "@proudindian/design/tokens";

import { $, $$ } from "./dom";

/** Programme verbs fill their band's width, capped on desktop by the band's --verb-cap and half the viewport height. */
export function fitVerbs() {
  for (const v of $$(".verb")) {
    v.style.fontSize = "100px";
    const cs = getComputedStyle(v);
    const desk = innerWidth > PHONE_MAX;
    const frac = desk ? 0.94 : 1;
    const w = v.scrollWidth;
    const t = v.parentElement!.clientWidth * frac;
    const cap = desk
      ? Math.min(
          innerHeight * 0.5,
          parseFloat(cs.getPropertyValue("--verb-cap")) || 520
        )
      : 999;
    v.style.fontSize = `${Math.min((100 * t) / w, cap)}px`;
  }
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
