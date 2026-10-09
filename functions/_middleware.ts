/**
 * Markdown for agents (Cloudflare Pages Function, in front of every page; public/_routes.json keeps assets out).
 * A GET or HEAD for a page whose Accept header prefers text/markdown to text/html gets the page's index.md, built
 * beside its index.html by the index.md.ts endpoints in src/pages. Everything else, browsers included, gets the static
 * site as before, with `Vary: Accept` so caches keep the two apart. A page without an index.md (404, thanks) stays
 * HTML.
 * The free plan's alternative to Cloudflare's zone-level "Markdown for Agents", which needs Pro.
 */
interface Context {
  request: Request;
  env: { ASSETS: { fetch: (input: URL | Request) => Promise<Response> } };
  next: () => Promise<Response>;
}

// the q-value the Accept header gives `type` ("text/markdown"): its own entry, else type/*, else */*, else 0
function quality(accept: string, type: string): number {
  let best = 0;
  let rank = 0;
  for (const part of accept.split(",")) {
    const [range = "", ...params] = part.split(";").map((s) => s.trim());
    const r = range.toLowerCase();
    const specificity =
      r === type
        ? 3
        : r === `${type.split("/")[0]}/*`
          ? 2
          : r === "*/*"
            ? 1
            : 0;
    if (specificity <= rank) continue;
    const q = params.find((p) => p.toLowerCase().startsWith("q="));
    rank = specificity;
    best = q ? Number(q.slice(2)) || 0 : 1;
  }
  return best;
}

// Markdown only when asked for by name and liked at least as much as HTML: a bare */* or text/* keeps HTML
function prefersMarkdown(accept: string): boolean {
  const md = quality(accept, "text/markdown");
  return (
    /\btext\/markdown\b/i.test(accept) &&
    md > 0 &&
    md >= quality(accept, "text/html")
  );
}

/** "/" -> "/index.md", "/volunteer/" and "/volunteer" -> "/volunteer/index.md"; a file ("/llms.txt") -> null */
function markdownPath(pathname: string): string | null {
  if (pathname.endsWith("/")) return `${pathname}index.md`;
  return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".")
    ? null
    : `${pathname}/index.md`;
}

const withVary = (res: Response) => {
  const out = new Response(res.body, res);
  out.headers.append("Vary", "Accept");
  return out;
};

export async function onRequest({ request, env, next }: Context) {
  const { method } = request;
  const path = markdownPath(new URL(request.url).pathname);
  if ((method !== "GET" && method !== "HEAD") || !path) return next();
  if (!prefersMarkdown(request.headers.get("Accept") ?? ""))
    return withVary(await next());

  const md = await env.ASSETS.fetch(new URL(path, request.url));
  // a page without an index.md: production answers 404, `wrangler pages dev` the home page's HTML with a 200
  if (!md.ok || !md.headers.get("Content-Type")?.includes("markdown"))
    return withVary(await next());
  const text = await md.text();
  return new Response(method === "HEAD" ? null : text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Location": path,
      Vary: "Accept",
      // the same estimate Cloudflare's own conversion sends: about 4 characters a token
      "x-markdown-tokens": String(Math.ceil(text.length / 4)),
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
