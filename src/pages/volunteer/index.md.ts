/** /volunteer/index.md: the volunteer guide as Markdown, served at /volunteer/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { markdownResponse, volunteerMarkdown } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await volunteerMarkdown(site));
