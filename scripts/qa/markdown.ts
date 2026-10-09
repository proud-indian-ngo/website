/**
 * Markdown for agents (functions/_middleware.ts): serves dist/ with the Pages Function through `wrangler pages dev`,
 * then checks that `Accept: text/markdown` gets each page's index.md, and that browsers, crawlers and wildcard Accept
 * headers still get the HTML with its _headers and _redirects. Prints a pass or FAIL line per check and exits 1 if any fails.
 *   bun run build && bun run qa:markdown
 *   SITE=https://<branch>.proudindian.pages.dev/ bun run qa:markdown   # or check a deployment
 */
import { existsSync } from "node:fs";

let SITE = process.env.SITE;
let wrangler: ReturnType<typeof Bun.spawn> | null = null;

if (!SITE) {
  if (!existsSync("dist/index.md")) {
    console.error(
      "qa:markdown: no dist/index.md (run `bun run build` first) and no SITE"
    );
    process.exit(1);
  }
  const port = 8700 + Math.floor(Math.random() * 200);
  wrangler = Bun.spawn(
    ["bunx", "wrangler", "pages", "dev", "dist", "--port", String(port)],
    { stdout: "pipe", stderr: "pipe" }
  );
  SITE = `http://localhost:${port}/`;
  const ready = Date.now() + 60_000;
  while (
    !(await fetch(SITE)
      .then((r) => r.ok)
      .catch(() => false))
  ) {
    if (Date.now() > ready) {
      wrangler.kill();
      console.error("qa:markdown: wrangler pages dev did not start in 60s");
      process.exit(1);
    }
    await Bun.sleep(250);
  }
}

const BROWSER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const get = (path: string, accept: string, method = "GET") =>
  fetch(new URL(path, SITE), {
    method,
    headers: { Accept: accept },
    redirect: "manual",
  });
const type = (r: Response) => r.headers.get("Content-Type") ?? "";
const varies = (r: Response) => /\baccept\b/i.test(r.headers.get("Vary") ?? "");

const r: Record<string, boolean> = {};
for (const path of ["/", "/volunteer/", "/privacy/"]) {
  const md = await get(path, "text/markdown");
  const body = await md.text();
  r[`${path} markdown to text/markdown`] =
    md.status === 200 &&
    type(md).startsWith("text/markdown") &&
    varies(md) &&
    Number(md.headers.get("x-markdown-tokens")) > 0 &&
    body.startsWith("# ") &&
    !body.includes("<html");
  const html = await get(path, BROWSER);
  r[`${path} HTML to a browser, with _headers`] =
    html.status === 200 &&
    type(html).startsWith("text/html") &&
    varies(html) &&
    html.headers.has("Content-Security-Policy");
}
r["/volunteer (no slash) markdown"] = type(
  await get("/volunteer", "text/markdown")
).startsWith("text/markdown");
r["markdown preferred by q-value"] = type(
  await get("/", "text/markdown, text/html;q=0.9")
).startsWith("text/markdown");
r["HTML preferred by q-value"] = type(
  await get("/", "text/html, text/markdown;q=0.5")
).startsWith("text/html");
r["*/* gets HTML"] = type(await get("/", "*/*")).startsWith("text/html");
r["text/* gets HTML"] = type(await get("/", "text/*")).startsWith("text/html");
r["no Accept gets HTML"] = type(
  await fetch(new URL("/", SITE), { headers: { Accept: "" } })
).startsWith("text/html");
const head = await get("/volunteer/", "text/markdown", "HEAD");
r["HEAD markdown"] =
  head.status === 200 &&
  type(head).startsWith("text/markdown") &&
  (await head.text()) === "";
r["page without markdown stays HTML"] = type(
  await get("/thanks/", "text/markdown")
).startsWith("text/html");
r["unknown page still 404"] =
  (await get("/no-such-page/", "text/markdown")).status === 404;
const old = await get("/faq", "text/markdown");
r["_redirects still apply"] =
  old.status === 301 &&
  old.headers.get("Location")?.endsWith("/volunteer/#faq") === true;
const direct = await get("/volunteer/index.md", BROWSER);
r["index.md direct: markdown, noindex"] =
  type(direct).startsWith("text/markdown") &&
  direct.headers.get("X-Robots-Tag") === "noindex";
const llms = await get("/llms.txt", "text/markdown");
r["/llms.txt unchanged"] =
  llms.status === 200 && type(llms).startsWith("text/plain");

wrangler?.kill();
for (const [check, ok] of Object.entries(r))
  console.log(`${ok ? "pass" : "FAIL"}  ${check}`);
if (Object.values(r).includes(false)) process.exitCode = 1;
