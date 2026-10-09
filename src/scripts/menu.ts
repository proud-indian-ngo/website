/** Phone and tablet poster menu. */
import { breakpoint } from "@proudindian/design/tokens";

import { $, $$ } from "./dom";
import { lockScroll, modal, prewarm } from "./modal";
import { onScroll } from "./rail";

export function initMenu() {
  const menu = $("#menu");
  const burger = $("[data-menu-open]");
  const closeBtn = menu && $("[data-menu-close]", menu);
  if (!menu || !burger || !closeBtn) return;
  const open = () => {
    menu.hidden = false;
    lockScroll(true);
    burger.setAttribute("aria-expanded", "true");
    modal(menu, true);
    closeBtn.focus();
    onScroll();
  };
  const close = (focus = true) => {
    if (menu.hidden) return;
    menu.hidden = true;
    burger.setAttribute("aria-expanded", "false");
    lockScroll(false);
    onScroll();
    // the burger can take focus back once the page is no longer inert; the sticky bar's inert is the rail's again
    modal(menu, false, () => {
      if (focus && menu.hidden) burger.focus();
      onScroll();
    });
  };
  burger.addEventListener("click", open);
  // the burger (and so the menu) only exists below the nav breakpoint
  if (innerWidth < breakpoint.nav) prewarm(menu);
  closeBtn.addEventListener("click", () => close());
  for (const a of $$("[data-menu-link]", menu))
    a.addEventListener("click", () => close(false));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  addEventListener("resize", () => {
    if (innerWidth > breakpoint.nav - 1) close(false);
  });
}
