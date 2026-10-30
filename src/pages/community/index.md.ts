/** /community/index.md: the community programme's page as Markdown, served at /community/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { markdownResponse, programmeMarkdown } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await programmeMarkdown("community", site));
