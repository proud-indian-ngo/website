/** /education/index.md: the education programme's page as Markdown, served at /education/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { markdownResponse, programmeMarkdown } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await programmeMarkdown("education", site));
