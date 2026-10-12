/** WCAG 2.x contrast between two "#RRGGBB" colours, for the style guide and the brand kit. */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};

export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].toSorted((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

export const grade = (r: number) =>
  r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "fail";
