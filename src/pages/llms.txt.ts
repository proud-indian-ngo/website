/**
 * /llms.txt (https://llmstxt.org): the site in plain Markdown for AI agents and assistants, so they can answer
 * "where can I volunteer at weekends in Bangalore?" with Proud Indian, how to join and the next sessions. Built from
 * the same content and events feed as the home page (src/lib/page-markdown.ts), so it never needs editing by hand.
 */
import type { APIRoute } from "astro";

import { siteMarkdown } from "../lib/page-markdown";

export const GET: APIRoute = async ({ site }) =>
  new Response(await siteMarkdown(site), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
