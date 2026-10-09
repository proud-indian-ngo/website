/**
 * /index.md: the home page as Markdown, for agents that ask for it (functions/_middleware.ts serves it at / to
 * `Accept: text/markdown`). The same text as /llms.txt, since the home page is the whole site in one page.
 */
import type { APIRoute } from "astro";

import { markdownResponse, siteMarkdown } from "../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  markdownResponse(await siteMarkdown(site));
