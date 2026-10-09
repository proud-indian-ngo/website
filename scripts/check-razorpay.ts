/**
 * The Razorpay donate page still pre-fills the amount. The page reads the amount from a query parameter named after
 * its item (lower case, spaces to underscores: "Your donation" → your_donation), so renaming the item in Razorpay
 * silently breaks every donate button. This reads the live page and compares its item name and minimum with
 * site.yaml → links.razorpay. Exit 1 on a mismatch, 2 if the page can't be read.
 *
 *   bun run check:razorpay
 */
const site = Bun.YAML.parse(
  await Bun.file(new URL("../src/content/site.yaml", import.meta.url)).text()
) as { links: { razorpay: { base: string; param: string; min: number } } };
const { base, param, min } = site.links.razorpay;

let html: string;
try {
  const res = await fetch(base, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`answered ${res.status}`);
  html = await res.text();
} catch (err) {
  console.error(`razorpay: could not read ${base} (${(err as Error).message})`);
  process.exit(2);
}

// the page embeds its config as JSON; the amount item is the first payment page item
const item = html.match(
  /"payment_page_items":\[\{.*?"item":\{.*?"name":"((?:[^"\\]|\\.)*)"/
);
const minAmount = html.match(/"payment_page_items":\[\{.*?"min_amount":(\d+)/);
if (!item) {
  console.error(`razorpay: no payment page item found on ${base}`);
  process.exit(2);
}
const name = JSON.parse(`"${item[1]}"`) as string;
const expected = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
const pageMin = minAmount ? Number(minAmount[1]) / 100 : null;

const problems: string[] = [];
if (expected !== param)
  problems.push(
    `the item is called "${name}", so the amount parameter is now "${expected}"; site.yaml says "${param}"`
  );
if (pageMin !== null && pageMin !== min)
  problems.push(`the page's minimum is ₹${pageMin}; site.yaml says ₹${min}`);

if (problems.length) {
  for (const p of problems) console.error(`razorpay: ${p}`);
  console.error("razorpay: update site.yaml → links.razorpay");
  process.exit(1);
}
console.log(
  `razorpay: "${name}" → ?${param}=<rupees> pre-fills the amount; minimum ₹${min}`
);
