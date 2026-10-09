/**
 * A static server that behaves like Cloudflare Pages for performance measurement: public/_headers rules (including
 * "! Header" detaches), brotli (or gzip) for text, directory indexes, 404.html.
 *
 *   const server = await serve("/tmp/site", 4400); ... server.close();
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".pdf": "application/pdf",
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

interface Rule {
  re: RegExp;
  set: [string, string][];
  del: string[];
}

function parseHeaders(root: string): Rule[] {
  const rules: Rule[] = [];
  const file = join(root, "_headers");
  if (!existsSync(file)) return rules;
  let cur: Rule | null = null;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      cur = {
        re: new RegExp(
          `^${line.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
        ),
        set: [],
        del: [],
      };
      rules.push(cur);
    } else if (line.startsWith("!"))
      cur!.del.push(line.slice(1).trim().toLowerCase());
    else {
      const i = line.indexOf(":");
      cur!.set.push([
        line.slice(0, i).trim().toLowerCase(),
        line.slice(i + 1).trim(),
      ]);
    }
  }
  return rules;
}

export function serve(root: string, port: number): Promise<Server> {
  const rules = parseHeaders(root);
  const cache = new Map<string, Buffer>();
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    let file = join(root, path);
    if (existsSync(file) && statSync(file).isDirectory())
      file = join(file, "index.html");
    else if (!existsSync(file) && existsSync(`${file}.html`))
      file = `${file}.html`;
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      res.end(
        existsSync(join(root, "404.html"))
          ? readFileSync(join(root, "404.html"))
          : "404"
      );
      return;
    }
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    const headers: Record<string, string | number> = { "content-type": type };
    for (const r of rules)
      if (r.re.test(path)) {
        for (const d of r.del) delete headers[d];
        for (const [k, v] of r.set) headers[k] = v;
      }
    let body: Buffer = readFileSync(file);
    const accept = req.headers["accept-encoding"] ?? "";
    if (COMPRESSIBLE.test(type) && body.length > 512) {
      const enc = /\bbr\b/.test(accept)
        ? "br"
        : /gzip/.test(accept)
          ? "gzip"
          : null;
      if (enc) {
        const key = `${enc}:${file}:${statSync(file).mtimeMs}`;
        if (!cache.has(key))
          cache.set(
            key,
            enc === "br"
              ? brotliCompressSync(body, {
                  params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
                })
              : gzipSync(body, { level: 9 })
          );
        body = cache.get(key)!;
        headers["content-encoding"] = enc;
        headers.vary = "accept-encoding";
      }
    }
    headers["content-length"] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve(server))
  );
}
