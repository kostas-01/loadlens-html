#!/usr/bin/env node
// Runs from the npm `version` lifecycle (after package.json is bumped, before the
// version commit). Turns the "## [Unreleased]" section of CHANGELOG.md into
// "## [x.y.z] - YYYY-MM-DD", opens a fresh empty Unreleased section and updates
// the comparison links at the bottom.
//
//   npm version patch|minor|major     (or npm run release:patch …)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const file = join(root, "CHANGELOG.md");
let text = readFileSync(file, "utf8");
const version = pkg.version;
const date = new Date().toISOString().slice(0, 10);

const heading = /^## \[Unreleased\][^\n]*\n/m;
const match = heading.exec(text);
if (!match) {
  console.error('CHANGELOG.md has no "## [Unreleased]" section. Add one with your changes, then run npm version again.');
  process.exit(1);
}
if (new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m").test(text)) {
  console.error(`CHANGELOG.md already has a section for ${version}.`);
  process.exit(1);
}

const after = text.slice(match.index + match[0].length);
const next = after.search(/^## \[/m);
const body = (next === -1 ? after : after.slice(0, next)).replace(/^\[[^\]]+\]:.*$/gm, "").trim();
if (!body) {
  console.error("The Unreleased section of CHANGELOG.md is empty. Describe the changes in this release first.");
  process.exit(1);
}

text = text.replace(heading, `## [Unreleased]\n\n## [${version}] - ${date}\n`);

// Comparison links, when the repository is known.
const url = typeof pkg.repository === "object" ? pkg.repository.url : pkg.repository;
const gh = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url ?? "");
if (gh && !gh[1].startsWith("OWNER/")) {
  const base = `https://github.com/${gh[1]}`;
  const prev = /^\[Unreleased\]: .*\/compare\/(v[^.]+\.[^.]+\.[^.]+)\.\.\.HEAD$/m.exec(text)?.[1];
  const linkRe = /^\[[^\]]+\]: \S+$/gm;
  const older = (text.match(linkRe) ?? []).filter((l) => !l.startsWith("[Unreleased]:"));
  const links = [
    `[Unreleased]: ${base}/compare/v${version}...HEAD`,
    prev ? `[${version}]: ${base}/compare/${prev}...v${version}` : `[${version}]: ${base}/releases/tag/v${version}`,
    ...older,
  ];
  text = `${text.replace(linkRe, "").trimEnd()}\n\n${links.join("\n")}\n`;
}

writeFileSync(file, text);
console.log(`CHANGELOG.md: released ${version} (${date})`);
