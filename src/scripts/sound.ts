/**
 * Interface sounds: short taps and swishes for the controls (src/assets/sounds/, rendered from React Bits Sound Lab,
 * https://reactbits.dev/tools/sound-lab, MIT + Commons Clause: fine inside the site, not to be redistributed as a pack),
 * and the tear-off ticket's paper, made in code (paper.ts).
 * On by default; the footer "Mute sounds" switch turns them off, saved for the whole site. Separate from Pause motion.
 * Nothing loads before the pointer first moves (or a key or finger goes down), which sets up the audio context and
 * fetches and decodes the files; browsers only let audio start from a press, so the first press resumes the context.
 * Getting ready ahead of that press keeps the first sound from landing late.
 */
import { $$ } from "./dom";
import { rip, snapBack, tearLoop } from "./paper";

export type Sound =
  | "advance"
  | "clasp"
  | "coin"
  | "drawer"
  | "flick"
  | "fold"
  | "notch"
  | "plush"
  | "popover"
  | "retreat"
  | "rip"
  | "settle"
  | "shake"
  | "snap-back"
  | "unclasp"
  | "unfold";

/** the sounds made in code rather than loaded */
const made: Partial<Record<Sound, (sr: number) => Float32Array>> = {
  rip,
  "snap-back": snapBack,
};

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
type Clip = { buffer: AudioBuffer; start: number };
const clips = new Map<string, Promise<Clip | null>>();

/**
 * the decoded sound, and where it actually starts: past the MP3 encoder's padding (Safari keeps it) and any quiet
 * lead-in.
 */
const load = (c: AudioContext, u: string) => {
  let b = clips.get(u);
  if (!b) {
    b = fetch(u)
      .then((r) => r.arrayBuffer())
      .then((a) => c.decodeAudioData(a))
      .then((buffer) => {
        const ch = buffer.getChannelData(0);
        let i = 0;
        while (i < ch.length && Math.abs(ch[i]!) < 0.003) i++;
        return { buffer, start: i / buffer.sampleRate };
      })
      .catch(() => null);
    clips.set(u, b);
  }
  return b;
};

/**
 * the audio context, and every sound loading. Made as the pointer first moves too, since making a context can take a
 * few hundred milliseconds; one made before a press stays suspended until wake() resumes it inside one.
 */
function ready() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
    for (const u of Object.values(urls)) void load(ctx, u);
  }
  return ctx;
}

/** the audio context, resumed inside a press */
function wake() {
  const c = ready();
  if (c.state === "suspended") void c.resume();
  return c;
}

const buffer = (c: AudioContext, d: Float32Array) => {
  const b = c.createBuffer(1, d.length, c.sampleRate);
  b.copyToChannel(d as Float32Array<ArrayBuffer>, 0);
  return b;
};

/** play a sound, after `delay` seconds (to land with an animation) */
export function play(s: Sound, delay = 0) {
  if (muted) return;
  const c = wake();
  const make = made[s];
  if (make && !clips.has(s))
    clips.set(
      s,
      Promise.resolve({ buffer: buffer(c, make(c.sampleRate)), start: 0 })
    );
  void (make ? clips.get(s)! : load(c, url(s))).then((b) => {
    if (!b || muted) return;
    const src = c.createBufferSource();
    src.buffer = b.buffer;
    src.connect(out!);
    src.start(c.currentTime + delay, b.start);
  });
}

let tearBuffer: AudioBuffer | null = null;

/**
 * the paper tearing while a ticket is pulled: `to(p)` with the tear's progress (0 to 1) on each move sounds it as loud
 * as it is tearing fast, and lets it fade within a few hundredths of a second once the pull holds still or goes back.
 * `stop()` when the pull ends. Null when muted.
 */
export function tearing() {
  if (muted) return null;
  const c = wake();
  tearBuffer ??= buffer(c, tearLoop(c.sampleRate));
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(out!);
  const src = c.createBufferSource();
  src.buffer = tearBuffer;
  src.loop = true;
  src.connect(g);
  // from somewhere in the loop, so two tears in a row don't start alike
  src.start(c.currentTime, Math.random() * tearBuffer.duration);
  let last = 0;
  let at = performance.now();
  const hold = (t: number) => {
    const v = g.gain.value;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(v, t);
  };
  return {
    to(p: number) {
      const now = performance.now();
      // tearing the whole way in a third of a second is full volume
      const level = Math.min(
        Math.max(p - last, 0) / Math.max((now - at) / 1000, 0.008) / 3,
        1
      );
      last = p;
      at = now;
      const t = c.currentTime;
      hold(t);
      g.gain.setTargetAtTime(level, t, 0.008);
      g.gain.setTargetAtTime(0, t + 0.05, 0.025);
      src.playbackRate.setTargetAtTime(0.85 + 0.35 * level, t, 0.02);
    },
    stop() {
      const t = c.currentTime;
      hold(t);
      g.gain.setTargetAtTime(0, t, 0.006);
      src.stop(t + 0.06);
    },
  };
}

/**
 * sound a control as the press goes down with a mouse or pen, so it lands with the click rather than the release; a
 * tap (which might turn into a scroll) and the keyboard sound on the click. `pick` returns null to stay quiet.
 */
export function onPress(el: Element, pick: () => Sound | null) {
  let down = false;
  const sound = () => {
    const s = pick();
    if (s) play(s);
  };
  el.addEventListener("pointerdown", (e) => {
    const p = e as PointerEvent;
    down = p.pointerType !== "touch" && p.button === 0;
    if (down) sound();
  });
  el.addEventListener("click", (e) => {
    // detail is 0 for a click from the keyboard
    if (!down || !(e as MouseEvent).detail) sound();
    down = false;
  });
}

export function initSound() {
  if (!muted) {
    for (const t of ["pointermove", "pointerdown", "keydown"])
      addEventListener(t, ready, {
        capture: true,
        once: true,
        passive: true,
      });
    for (const t of ["pointerdown", "keydown"])
      addEventListener(t, wake, { capture: true, once: true, passive: true });
  }
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
