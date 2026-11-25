#!/usr/bin/env node
// One-time project setup: fills in your name and GitHub repository.
//
//   node scripts/configure.mjs --author "Jane Doe <jane@example.com>" --repo jane/loadlens-html
//
// Options:
//   --author "Name <email>"   Package author (the email part is optional)
//   --repo owner/name         GitHub repository (sets repository, homepage, bugs and doc links)
//   --name <package-name>     Optional: publish under another name, e.g. @jane/loadlens-html
//   --dry-run                 Show the changes without writing them
//
// Safe to run again: it overwrites only the fields above.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

let values;
try {
  ({ values } = parseArgs({
    options: {
      author: { type: "string" },
      repo: { type: "string" },
      name: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  }));
} catch (err) {
  fail(`${err.message.split(". ")[0]}. Run with --help.`);
}

if (values.help || (!values.author && !values.repo && !values.name)) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 13).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(values.help ? 0 : 1);
}

const pkgPath = join(root, "package.json");
const licensePath = join(root, "LICENSE");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
let license = readFileSync(licensePath, "utf8");
const changes = [];
// Files whose GitHub links follow the repository (README badges, CHANGELOG compare links…).
const DOCS = ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", ".github/ISSUE_TEMPLATE/config.yml"];
const docs = new Map();

if (values.author !== undefined) {
  const author = values.author.trim();
  if (!/^[^<>]+(\s<[^<>\s@]+@[^<>\s]+>)?$/.test(author)) fail('--author must look like "Jane Doe" or "Jane Doe <jane@example.com>"');
  pkg.author = author;
  const holder = author.replace(/\s*<.*>$/, "");
  license = license.replace(/^Copyright \(c\) (\d{4}) .*$/m, `Copyright (c) $1 ${holder}`);
  changes.push(`author     → ${author}`, `LICENSE    → Copyright holder: ${holder}`);
}

if (values.repo !== undefined) {
  const m = /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(values.repo.trim());
  if (!m) fail("--repo must be owner/name (or a github.com URL)");
  const slug = `${m[1]}/${m[2]}`;
  const oldSlug = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(pkg.repository?.url ?? "")?.[1];
  if (oldSlug && oldSlug !== slug) {
    for (const f of DOCS) {
      const path = join(root, f);
      if (!existsSync(path)) continue;
      const before = docs.get(path) ?? readFileSync(path, "utf8");
      const after = before.split(`github.com/${oldSlug}`).join(`github.com/${slug}`);
      if (after !== before) docs.set(path, after);
    }
  }
  pkg.repository = { type: "git", url: `git+https://github.com/${slug}.git` };
  pkg.homepage = `https://github.com/${slug}#readme`;
  pkg.bugs = { url: `https://github.com/${slug}/issues` };
  changes.push(`repository → https://github.com/${slug}`);
  if (docs.size) changes.push(`links      → ${[...docs.keys()].map((p) => p.slice(root.length + 1)).join(", ")}`);
}

if (values.name !== undefined) {
  const name = values.name.trim();
  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name) || name.length > 214) fail(`"${name}" is not a valid npm package name`);
  if (!/-[a-z0-9]+$/.test(name)) {
    console.warn(`warning: Artillery loads plugins as <scope><key>. "${name}" has no "-<key>" suffix, so the plugin key would be unusual.`);
  }
  pkg.name = name;
  changes.push(`name       → ${name}`);
}

// Keep a stable, conventional key order in package.json.
const order = ["name", "version", "description", "author", "license", "homepage", "repository", "bugs", "keywords", "main", "types", "exports", "bin", "files", "scripts", "engines", "publishConfig", "devDependencies"];
const sorted = Object.fromEntries([...order.filter((k) => k in pkg).map((k) => [k, pkg[k]]), ...Object.entries(pkg).filter(([k]) => !order.includes(k))]);

console.log(changes.map((c) => `  ${c}`).join("\n"));
if (values["dry-run"]) {
  console.log("\n(dry run: nothing written)");
} else {
  writeFileSync(pkgPath, `${JSON.stringify(sorted, null, 2)}\n`);
  writeFileSync(licensePath, license);
  for (const [path, text] of docs) writeFileSync(path, text);
  console.log("\nUpdated package.json, LICENSE and links.");
  if (values.name !== undefined) {
    const cut = pkg.name.lastIndexOf("-");
    console.log(`\nUsers enable the plugin with\n  plugins:\n    ${pkg.name.slice(cut + 1)}:\n      scope: "${pkg.name.slice(0, cut + 1)}"\nUpdate README.md to match.`);
  }
}
