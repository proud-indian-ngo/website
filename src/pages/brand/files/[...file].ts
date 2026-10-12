/**
 * The brand kit's files (/brand/files/…), prerendered: every SVG, PNG, font, the guidelines PDF and the zips listed by
 * src/lib/brand-kit.ts. Kept out of search by public/robots.txt and the X-Robots-Tag in public/_headers.
 */
import type { APIRoute, GetStaticPaths } from "astro";

import { kitFile, kitPaths } from "../../../lib/brand-kit";

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  pdf: "application/pdf",
  zip: "application/zip",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
};

export const getStaticPaths = (() =>
  kitPaths().map((file) => ({ params: { file } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const file = params.file!;
  const body = await kitFile(file);
  return new Response(body.slice().buffer, {
    headers: {
      "Content-Type":
        TYPES[file.slice(file.lastIndexOf(".") + 1)] ??
        "application/octet-stream",
    },
  });
};
