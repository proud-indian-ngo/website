/**
 * Swipe rows (the "More weekends" tickets, the Kalakriti line): no scrollbar. A round button at each end scrolls by
 * about a card, and only shows while there is more to see that way. Touch swiping, the trackpad and the keyboard
 * (the rows are focusable) work as before. The ticket row is re-rendered by the events refresh, so the buttons
 * follow its content as well as its size.
 */
import { $$ } from "./dom";

const ARROW =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function setup(row: HTMLElement) {
  const host = row.parentElement;
  if (!host) return;
  host.classList.add("swipe-host");
  const button = (dir: -1 | 1) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `swipe-btn ${dir < 0 ? "swipe-prev" : "swipe-next"}`;
    b.setAttribute(
      "aria-label",
      (dir < 0 ? row.dataset.swipePrev : row.dataset.swipeNext) ?? ""
    );
    b.innerHTML = ARROW;
    b.hidden = true;
    b.addEventListener("click", () => {
      const smooth = document.documentElement.dataset.motion === "on";
      row.scrollBy({
        left: dir * Math.max(row.clientWidth * 0.8, 240),
        behavior: smooth ? "smooth" : "auto",
      });
    });
    host.append(b);
    return b;
  };
  const prev = button(-1);
  const next = button(1);

  let queued = false;
  const update = () => {
    queued = false;
    const max = row.scrollWidth - row.clientWidth;
    const top = row.offsetTop + row.offsetHeight / 2;
    for (const [b, show] of [
      [prev, max > 1 && row.scrollLeft > 4],
      [next, max > 1 && row.scrollLeft < max - 4],
    ] as const) {
      b.style.top = `${top}px`;
      b.hidden = !show;
    }
    // a focused button that just reached its end hands focus to the other one, or to the row
    const lost = [prev, next].find(
      (b) => b.hidden && b === document.activeElement
    );
    if (lost) {
      const other = lost === prev ? next : prev;
      (other.hidden ? row : other).focus();
    }
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  row.addEventListener("scroll", queue, { passive: true });
  new ResizeObserver(queue).observe(row);
  new MutationObserver(queue).observe(row, { childList: true });
  queue();
}

export function initSwipe() {
  for (const row of $$<HTMLElement>("[data-swipe]")) setup(row);
}
