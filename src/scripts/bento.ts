/** 09 bento: the 95% ring draws on once the Reports bento has revealed (hover feedback is CSS). */
import { $, A, EASE } from "./dom";
import { lite } from "./lite";
import { onGroupThen } from "./reveal";

export const initBento = () =>
  onGroupThen("ring", (g) => {
    const arc = $(".c95 .arc", g);
    const pct = parseFloat(arc?.getAttribute("stroke-dasharray") ?? "95");
    // slow devices (lite.ts): the arc fades in on the compositor instead of drawing round
    if (lite())
      A(arc, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 1000,
        delay: 220,
        easing: EASE.draw,
      });
    else
      A(arc, [{ strokeDashoffset: pct }, { strokeDashoffset: 0 }], {
        duration: 1000,
        delay: 220,
        easing: EASE.draw,
      });
  });
