import { dropCoins } from "./coins";
/**
 * Donate amount picker: the preset chips and the "Or enter another amount" field update the total, the
 * button label and the Razorpay deep link. Focusing or typing in the field deselects the presets. Below the minimum
 * the total dims and the button reads "Enter ₹100 or more" (aria-disabled, clicks do nothing). Razorpay settings
 * come from data attributes rendered from src/content/site.yaml.
 */
import { $, $$ } from "./dom";

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

export function initDonate() {
  const form = $<HTMLFormElement>("[data-donate-form]");
  const scope = $("#donate");
  if (!form || !scope) return;
  const {
    rzpBase = "",
    rzpParam = "",
    rzpMin = "100",
    labelDonate = "Donate",
    labelLow = "Enter ₹100 or more",
  } = form.dataset;
  const min = +rzpMin;
  const payUrl = (n: number) =>
    n >= min ? `${rzpBase}?${rzpParam}=${Math.round(n)}` : rzpBase;
  const chips = $$<HTMLButtonElement>(".amt", scope);
  const inputs = $$<HTMLInputElement>(".amt-in", scope);

  const setAmt = (n: number, from?: HTMLInputElement) => {
    const v = n > 0 ? inr(n) : "";
    const ok = n >= min;
    for (const i of inputs)
      if (i !== from) i.value = i.classList.contains("oth") ? "" : v;
    for (const e of $$("[data-amt-num]", scope))
      e.textContent = n > 0 ? v : "0";
    for (const a of $$<HTMLAnchorElement>("[data-donate]", scope)) {
      a.href = payUrl(n);
      $("[data-btn-label]", a)!.textContent = ok
        ? `${labelDonate} ₹${v}`
        : labelLow;
      if (ok) a.removeAttribute("aria-disabled");
      else a.setAttribute("aria-disabled", "true");
    }
    for (const e of $$(".btotal", scope)) e.classList.toggle("is-low", !ok);
    for (const e of $$("[data-low]", scope)) e.hidden = !(n > 0 && !ok);
  };
  const deselect = () => {
    for (const x of chips) x.setAttribute("aria-pressed", "false");
  };
  const typed = (i: HTMLInputElement) =>
    +i.value.replace(/\D/g, "").slice(0, 7);

  for (const b of chips)
    b.addEventListener("click", () => {
      for (const x of chips) x.setAttribute("aria-pressed", String(x === b));
      setAmt(+b.dataset.amt!);
      dropCoins(scope, +(b.dataset.coins || 3));
    });
  for (const i of inputs) {
    // the field is its own choice: focusing it deselects the presets and the total follows what is typed (or 0)
    i.addEventListener("focus", () => {
      if (chips.every((x) => x.getAttribute("aria-pressed") !== "true")) return;
      deselect();
      setAmt(typed(i), i);
    });
    i.addEventListener("input", () => {
      const n = typed(i);
      i.value = n ? inr(n) : "";
      deselect();
      setAmt(n, i);
    });
    i.addEventListener("change", () => {
      if (+i.value.replace(/\D/g, "")) dropCoins(scope, 3);
    });
  }
  // below the minimum the button is aria-disabled: it stays focusable (and says why) but goes nowhere
  for (const a of $$<HTMLAnchorElement>("[data-donate]", scope))
    a.addEventListener("click", (e) => {
      if (a.getAttribute("aria-disabled") === "true") e.preventDefault();
    });
  // the card is a <form> for grouping only; Enter in the amount field must not reload the page
  form.addEventListener("submit", (e) => e.preventDefault());
}
