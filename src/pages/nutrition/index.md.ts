/** /nutrition/index.md: the nutrition programme's page as Markdown, served at /nutrition/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { markdownResponse, programmeMarkdown } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await programmeMarkdown("nutrition", site));
