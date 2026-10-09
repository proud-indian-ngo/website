import type { ImageMetadata } from "astro";

/** Every image under src/assets/, keyed by its path relative to that folder ("photos/teach-postmaster.jpg"). */
const files = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/**/*.{jpg,png}",
  { eager: true }
);

/** Resolve a content image path. Fails the build with a clear message if the file is missing. */
export function asset(path: string): ImageMetadata {
  const hit = files[`/src/assets/${path}`];
  if (!hit)
    throw new Error(
      `Image not found: src/assets/${path} (referenced from src/content/)`
    );
  return hit.default;
}
