/**
 * Interface sounds: short taps and swishes for the controls (src/assets/sounds/, rendered from React Bits Sound Lab,
 * https://reactbits.dev/tools/sound-lab, MIT + Commons Clause: fine inside the site, not to be redistributed as a pack).
 * On by default; the footer "Mute sounds" switch turns them off, saved for the whole site. Separate from Pause motion.
 * Nothing loads before the first press: browsers only let audio start from one, so that press creates the audio
 * context and fetches the files.
 */
import { $$ } from "./dom";

export type Sound =
  | "advance"
  | "boop"
  | "clasp"
  | "coin"
  | "drawer"
  | "fold"
  | "leaf"
  | "pickup"
  | "popover"
  | "rebound"
  | "retreat"
  | "settle"
  | "shake"
  | "sweep"
  | "tab"
  | "unclasp"
  | "unfold";

const urls = import.meta.glob<string>("../assets/sounds/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});
const url = (s: Sound) => urls[`../assets/sounds/${s}.mp3`]!;

const KEY = "pi-sound-off";
const VOLUME = 0.7;

let muted = false;
try {
  muted = localStorage.getItem(KEY) === "1";
} catch {
  muted = false;
}
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

const load = (c: AudioContext, u: string) => {
  let b = buffers.get(u);
  if (!b) {
    b = fetch(u)
      .then((r) => r.arrayBuffer())
      .then((a) => c.decodeAudioData(a))
      .catch(() => null);
    buffers.set(u, b);
  }
  return b;
};

/** the audio context, created (or resumed) inside a press; the first one also fetches every sound */
function wake() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
    for (const u of Object.values(urls)) void load(ctx, u);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** play a sound, after `delay` seconds (to land with an animation) */
export function play(s: Sound, delay = 0) {
  if (muted) return;
  const c = wake();
  void load(c, url(s)).then((b) => {
    if (!b || muted) return;
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(out!);
    src.start(c.currentTime + delay);
  });
}

export function initSound() {
  if (!muted)
    for (const t of ["pointerdown", "keydown"])
      addEventListener(t, wake, { capture: true, once: true, passive: true });
  const buttons = $$<HTMLButtonElement>("[data-sound]");
  const status = document.getElementById("snd-s");
  const set = () => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(muted));
    const b = buttons[0];
    if (status && b)
      status.textContent = muted ? b.dataset.muted! : b.dataset.idle!;
  };
  set();
  for (const b of buttons)
    b.addEventListener("click", () => {
      // the switch sounds its own change: a last "off" before muting, an "on" once unmuted
      if (!muted) play("unclasp");
      muted = !muted;
      if (!muted) play("clasp");
      try {
        localStorage.setItem(KEY, muted ? "1" : "0");
      } catch {
        /* private mode: the choice lasts for this page only */
      }
      set();
    });
}
