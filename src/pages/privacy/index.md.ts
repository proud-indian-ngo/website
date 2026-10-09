/** /privacy/index.md: the privacy policy as Markdown, served at /privacy/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { markdownResponse, privacyMarkdown } from "../../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await privacyMarkdown(site));
