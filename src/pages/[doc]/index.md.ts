/** /<doc>/index.md: a Markdown page (src/content/<doc>.md) as Markdown, served at /<doc>/ to `Accept: text/markdown`. */
import type { APIRoute } from "astro";

import { type Doc, docPaths } from "../../lib/content";
import { docMarkdown, markdownResponse } from "../../lib/page-markdown";

export const getStaticPaths = docPaths;

export const GET: APIRoute<{ doc: Doc }> = async ({ props, site }) =>
  markdownResponse(await docMarkdown(props.doc, site));
