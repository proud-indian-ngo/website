/** /kalakriti/index.md: the festival's page as Markdown, served at /kalakriti/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { kalakritiMarkdown, markdownResponse } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await kalakritiMarkdown(site));
