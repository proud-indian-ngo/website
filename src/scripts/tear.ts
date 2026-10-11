/**
 * "Tear one off": pull a ticket away from its stub and it tears along the perforation, then follows its link. The
 * tear opens from the top (the ticket pivots on the bottom of the perforation) as you pull; let go early and it springs
 * back whole. A plain click, the keyboard, and motion off (Pause, reduced motion) are an ordinary link.
 * Markup: <Ticket tear /> (data-tear). Styles: sections/kalakriti.css (the cursor, touch handling and the stub's copy).
 */
import { $$, EASE, on } from "./dom";

/** px of pull (leftwards, away from the stub) that tears it */
const PULL = 110;
/** px a press moves before it counts as a drag (below it, it's a click) */
const SLOP = 6;
/** the torn edge: a tooth every STEP px, AMP px either side of the perforation */
const STEP = 6;
const AMP = 2.5;

interface Tear {
  /** the stub's half: a copy of the ticket body, clipped to the stub, that stays put */
  stub: HTMLElement;
  /** the perforation's x in the body, and the body's size */
  x: number;
  w: number;
  h: number;
}

/** the perforation as a torn edge, top to bottom */
function edge(x: number, h: number) {
  const pts: string[] = [];
  for (let y = 0, i = 0; y < h; y += STEP, i++)
    pts.push(`${x + (i % 2 ? AMP : -AMP)}px ${y}px`);
  pts.push(`${x}px ${h}px`);
  return pts.join(",");
}

function setup(a: HTMLAnchorElement) {
  const body = a.querySelector<HTMLElement>(".pi-ticket__body");
  const stubEl = a.querySelector<HTMLElement>(".pi-ticket__stub");
  if (!body || !stubEl) return;

  let id: number | null = null;
  let x0 = 0;
  let y0 = 0;
  let tear: Tear | null = null;
  let torn = false;
  /** the press became a drag, so the click that follows it is not a click */
  let dragged = false;

  const begin = () => {
    const x = stubEl.offsetLeft;
    const w = body.offsetWidth;
    const h = body.offsetHeight;
    const cut = edge(x, h);
    const stub = body.cloneNode(true) as HTMLElement;
    stub.classList.add("pi-ticket__torn");
    stub.setAttribute("aria-hidden", "true");
    stub.style.clipPath = `polygon(${cut},${w}px ${h}px,${w}px 0)`;
    body.style.clipPath = `polygon(0 0,${cut},0 ${h}px)`;
    // both halves pivot on the bottom of the perforation, so the tear opens from the top
    body.style.transformOrigin = stub.style.transformOrigin = `${x}px ${h}px`;
    a.append(stub);
    a.classList.add("is-tearing");
    tear = { stub, x, w, h };
  };

  /** p: 0 (whole) to 1 (torn) */
  const pose = (dx: number, dy: number) => {
    if (!tear) return 0;
    const p = Math.min(Math.max(-dx / PULL, 0), 1);
    // the paper holds at the bottom: the pull mostly swings the ticket open from the top, sliding it only a little
    // (and hardly at all back into the stub)
    body.style.translate = `${Math.min(dx * 0.3, 3)}px ${dy * 0.2}px`;
    body.style.rotate = `${-11 * p}deg`;
    tear.stub.style.rotate = `${2.5 * p}deg`;
    return p;
  };

  const end = () => {
    tear?.stub.remove();
    tear = null;
    for (const s of [
      "clipPath",
      "transformOrigin",
      "translate",
      "rotate",
      "opacity",
    ] as const)
      body.style[s] = "";
    a.classList.remove("is-tearing");
  };

  const back = () => {
    const t = tear;
    if (!t) return;
    const from = { translate: body.style.translate, rotate: body.style.rotate };
    const stubFrom = t.stub.style.rotate;
    body.style.translate = body.style.rotate = t.stub.style.rotate = "";
    const o = { duration: 320, easing: EASE.spring };
    body
      .animate([from, { translate: "0 0", rotate: "0deg" }], o)
      .finished.then(end, end);
    t.stub.animate([{ rotate: stubFrom }, { rotate: "0deg" }], o);
  };

  const off = () => {
    const t = tear;
    if (!t) return;
    torn = true;
    if (id !== null && a.hasPointerCapture(id)) a.releasePointerCapture(id);
    id = null;
    const from = {
      translate: body.style.translate,
      rotate: body.style.rotate,
      opacity: "1",
    };
    const [fx = "0px", fy = "0px"] = from.translate.split(" ");
    body.style.opacity = "0";
    body
      .animate(
        [
          from,
          {
            translate: `calc(${fx} - ${Math.round(t.w * 0.45)}px) calc(${fy} + 36px)`,
            rotate: "-16deg",
            opacity: 0,
          },
        ],
        { duration: 280, easing: EASE.settle }
      )
      .finished.then(go, go);
    t.stub.animate([{ rotate: t.stub.style.rotate }, { rotate: "0deg" }], {
      duration: 360,
      easing: EASE.spring,
      fill: "forwards",
    });
  };

  /** whole again: a fresh ticket fades in where the torn one was */
  const mend = () => {
    torn = false;
    for (const x of body.getAnimations()) x.cancel();
    end();
    body.animate({ opacity: [0, 1] }, { duration: 300, easing: EASE.settle });
  };

  // the ticket you tore takes you where it says (the same tab, like the click would). A link within the page (the
  // home band's "#volunteer") only scrolls, so the ticket mends once you're there.
  const go = () => {
    location.assign(a.href);
    setTimeout(mend, 900);
  };

  a.addEventListener("dragstart", (e) => e.preventDefault());
  a.addEventListener("pointerdown", (e) => {
    if (!on() || torn || e.button !== 0 || id !== null) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    dragged = false;
  });
  a.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (!tear) {
      if (Math.hypot(dx, dy) < SLOP) return;
      // on touch, a mostly vertical move is the page scrolling: let it
      if (e.pointerType !== "mouse" && Math.abs(dy) > Math.abs(dx)) {
        id = null;
        return;
      }
      dragged = true;
      a.setPointerCapture(e.pointerId);
      begin();
    }
    if (pose(dx, dy) >= 1) off();
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return;
    id = null;
    back();
  };
  a.addEventListener("pointerup", up);
  a.addEventListener("pointercancel", up);
  a.addEventListener(
    "click",
    (e) => {
      if (!dragged && !torn) return;
      e.preventDefault();
      dragged = false;
    },
    true
  );
  // back from the page it opened (back/forward cache): the ticket is whole again
  addEventListener("pageshow", (e: PageTransitionEvent) => {
    if (e.persisted && torn) mend();
  });
}

export function initTear() {
  for (const a of $$<HTMLAnchorElement>("a.pi-ticket[data-tear]")) setup(a);
}
