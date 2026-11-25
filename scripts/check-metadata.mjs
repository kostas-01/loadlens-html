#!/usr/bin/env node
// Runs before `npm publish`: refuses to publish while package.json or LICENSE
// still contain setup placeholders (run `npm run configure` first).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const license = readFileSync(join(root, "LICENSE"), "utf8");
const problems = [];

const repo = typeof pkg.repository === "object" ? pkg.repository.url : pkg.repository;
if (!repo || /OWNER\//.test(repo)) problems.push("package.json `repository` is still a placeholder");
if (/OWNER\//.test(pkg.homepage ?? "") || /OWNER\//.test(pkg.bugs?.url ?? "")) problems.push("package.json `homepage` / `bugs` are still placeholders");
if (!pkg.author) problems.push("package.json has no `author`");
if (/<YOUR NAME>/.test(license)) problems.push("LICENSE still says <YOUR NAME>");

if (problems.length) {
  console.error(`Not ready to publish:\n${problems.map((p) => `  - ${p}`).join("\n")}\n\nRun: npm run configure -- --author "Your Name <you@example.com>" --repo your-user/${pkg.name}`);
  process.exit(1);
}
