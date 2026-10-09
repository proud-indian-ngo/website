/** Reports drawer and its tabs (decision 9). */
import { $, $$ } from "./dom";
import { lockScroll, modal, prewarm } from "./modal";

export function initReportsDrawer() {
  const selectors = new WeakMap<Element, (k: string) => void>();
  for (const tl of $$(".tr-tabs")) {
    const bs = $$<HTMLButtonElement>("[role=tab]", tl);
    const sel = (b: HTMLButtonElement) =>
      bs.forEach((x) => {
        const o = x === b;
        x.setAttribute("aria-selected", String(o));
        x.tabIndex = o ? 0 : -1;
        document.getElementById(x.getAttribute("aria-controls")!)!.hidden = !o;
      });
    bs.forEach((b, i) => {
      b.addEventListener("click", () => sel(b));
      b.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) {
          const n = bs[(i + d + bs.length) % bs.length]!;
          sel(n);
          n.focus();
        }
      });
    });
    selectors.set(tl, (k) => {
      const b = bs.find((x) => x.dataset.tab === k);
      if (b) sel(b);
    });
  }

  const dr = $(".cDrawer");
  const scrim = $(".cScrim");
  if (!dr || !scrim) return;
  const wrap = dr.parentElement!;
  let last: HTMLElement | null = null;
  const open = (k: string) => {
    last = document.activeElement as HTMLElement | null;
    selectors.get($(".tr-tabs", dr)!)?.(k);
    dr.hidden = scrim.hidden = false;
    lockScroll(true);
    modal(wrap, true);
    $(".cClose", dr)?.focus({ preventScroll: true });
  };
  const close = () => {
    if (dr.hidden) return;
    dr.hidden = scrim.hidden = true;
    lockScroll(false);
    // the opener can take focus back once the page is no longer inert
    const to = last;
    modal(wrap, false, () => {
      if (dr.hidden) to?.focus({ preventScroll: true });
    });
  };
  for (const b of $$("[data-open]"))
    b.addEventListener("click", () => open(b.dataset.open!));
  prewarm(dr);
  for (const b of $$("[data-close]")) b.addEventListener("click", close);
  // "See all" lists the rest of the disclosures in place, then hands focus to the first one it revealed
  for (const b of $$("[data-see-all]", dr))
    b.addEventListener("click", () => {
      const items = $$<HTMLLIElement>("[data-more-item]", b.closest("ul")!);
      // .fresh fades them in (transparency.css, @starting-style); dropped once that's over, so a later tab switch
      // back to this list doesn't fade them again
      for (const li of items) {
        li.classList.add("fresh");
        li.hidden = false;
      }
      setTimeout(
        () => items.forEach((li) => li.classList.remove("fresh")),
        260
      );
      b.closest("li")!.remove();
      if (items[0]) $("a", items[0])?.focus();
    });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  // keep Tab inside the drawer (the rest of the page is inert; this wraps at the ends)
  dr.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = $$('a[href],button:not([disabled]),[tabindex="0"]', dr).filter(
      (x) => !x.closest("[hidden]")
    );
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f.at(-1)!.focus();
    } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
      e.preventDefault();
      f[0]!.focus();
    }
  });
}
