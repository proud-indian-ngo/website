/**
 * FAQ accordion (FaqAccordion.astro, .vg-q): the <details> open and close smoothly, the height easing to fit the
 * answer, and a click mid-way turns it around from where it is. Motion off (Pause, reduced motion) or no JavaScript:
 * plain <details>. While one closes it carries .is-shut, so its + turns back as the close starts, not after it.
 */
import { $$, EASE, on } from "./dom";

function setup(d: HTMLDetailsElement) {
  const sum = d.querySelector("summary");
  const ans = d.querySelector("summary + *");
  if (!sum) return;
  let anim: Animation | null = null;

  sum.addEventListener("click", (e) => {
    if (!on()) return;
    e.preventDefault();
    // open and not already closing: close it (a click while it opens closes it too, and one while it closes reopens it)
    const closing = d.open && !d.classList.contains("is-shut");
    const from = d.offsetHeight;
    anim?.cancel();
    d.open = !closing;
    const to = d.offsetHeight;
    d.open = true;
    d.classList.toggle("is-shut", closing);
    d.style.overflow = "hidden";
    const a = d.animate(
      { height: [`${from}px`, `${to}px`] },
      { duration: closing ? 260 : 340, easing: EASE.settle }
    );
    if (!closing && ans)
      ans.animate(
        { opacity: [0, 1] },
        { duration: 300, delay: 60, easing: EASE.settle, fill: "backwards" }
      );
    anim = a;
    a.onfinish = () => {
      anim = null;
      d.style.overflow = "";
      d.classList.remove("is-shut");
      if (closing) d.open = false;
    };
  });
}

export function initAccordion() {
  for (const d of $$<HTMLDetailsElement>("details.vg-q")) setup(d);
}
