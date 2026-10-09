// Linting, following pi-dash's oxlint setup (correctness as errors).
import { defineConfig } from "oxlint";

export default defineConfig({
  env: { browser: true, builtin: true, node: true },
  ignorePatterns: ["dist/**", ".astro/**", "node_modules/**"],
  plugins: ["typescript", "unicorn", "oxc"],
  categories: { correctness: "error" },
});
