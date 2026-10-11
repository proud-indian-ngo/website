/** /csr/index.md: the page for companies as Markdown, served at /csr/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { csrMarkdown, markdownResponse } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await csrMarkdown(site));
