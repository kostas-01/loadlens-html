"use strict";
// Simulates how Artillery drives a plugin: `stats` per period, `done` with the aggregate, then cleanup().

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { existsSync, mkdtempSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Plugin, LEGACY_METRICS_FORMAT } = require("../dist/index.js");

const sample = JSON.parse(readFileSync(join(__dirname, "..", "examples", "sample-report.json"), "utf8"));

function runPlugin(pluginConfig, { emitDone = true, emitStats = true } = {}) {
  const events = new EventEmitter();
  const script = { config: { target: "https://example.test", plugins: { html: pluginConfig } } };
  const plugin = new Plugin(script, events);
  if (emitStats) for (const block of sample.intermediate) events.emit("stats", structuredClone(block));
  if (emitDone) events.emit("done", structuredClone(sample.aggregate));
  return new Promise((resolve) => plugin.cleanup(() => resolve(plugin)));
}

function withArtilleryGlobal(fn) {
  const logs = [];
  globalThis.artillery = { log: (...args) => logs.push(args.join(" ")) };
  return Promise.resolve(fn(logs)).finally(() => delete globalThis.artillery);
}

test("asks Artillery for the report.json metrics format", () => {
  assert.equal(LEGACY_METRICS_FORMAT, false);
});

test("writes an HTML report and summary JSON from live events", () =>
  withArtilleryGlobal(async (logs) => {
    const dir = mkdtempSync(join(tmpdir(), "aph-"));
    await runPlugin({ output: join(dir, "out", "report.html"), summaryJson: join(dir, "summary.json"), title: "Live run" });
    const html = readFileSync(join(dir, "out", "report.html"), "utf8");
    assert.match(html, /<title>Live run — FAIL/);
    assert.match(html, /https:\/\/example\.test/);
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
    assert.equal(summary.verdict, "fail");
    assert.equal(summary.meta.partial, false);
    assert.ok(logs.some((l) => l.includes("HTML report (FAIL)")));
    assert.equal(globalThis.artillery.suggestedExitCode, undefined, "failOn defaults to never");
  }));

test("failOn sets Artillery's suggested exit code", () =>
  withArtilleryGlobal(async () => {
    const dir = mkdtempSync(join(tmpdir(), "aph-"));
    await runPlugin({ output: join(dir, "r.html"), failOn: "fail", quiet: true });
    assert.equal(globalThis.artillery.suggestedExitCode, 1);
  }));

test("loads thresholds from a file and expands output placeholders", () =>
  withArtilleryGlobal(async () => {
    const dir = mkdtempSync(join(tmpdir(), "aph-"));
    writeFileSync(join(dir, "t.json"), JSON.stringify({ failureRate: { warn: 50, fail: 50 } }));
    await runPlugin({ output: join(dir, "{date}-report.html"), thresholds: join(dir, "t.json"), quiet: true });
    const today = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const file = join(dir, `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}-report.html`);
    assert.ok(existsSync(file), `expected ${file}`);
    assert.match(readFileSync(file, "utf8"), /<title>[^<]*PASS/);
  }));

test("produces a partial report when the run stops before `done`", () =>
  withArtilleryGlobal(async () => {
    const dir = mkdtempSync(join(tmpdir(), "aph-"));
    await runPlugin({ output: join(dir, "p.html"), summaryJson: join(dir, "s.json"), quiet: true }, { emitDone: false });
    const summary = JSON.parse(readFileSync(join(dir, "s.json"), "utf8"));
    assert.equal(summary.meta.partial, true);
    assert.equal(summary.vusers.created, 30); // summed from periods
    assert.match(readFileSync(join(dir, "p.html"), "utf8"), /Incomplete run/);
  }));

test("does nothing inside Artillery worker threads", async () => {
  process.env.LOCAL_WORKER_ID = "1";
  try {
    const dir = mkdtempSync(join(tmpdir(), "aph-"));
    await runPlugin({ output: join(dir, "w.html") });
    assert.ok(!existsSync(join(dir, "w.html")));
  } finally {
    delete process.env.LOCAL_WORKER_ID;
  }
});

test("never throws into Artillery when report generation fails", () =>
  withArtilleryGlobal(async (logs) => {
    await runPlugin({ output: "/tmp/x.html", thresholds: "/definitely/missing.json" });
    assert.ok(logs.some((l) => l.includes("failed to write HTML report")));
  }));

test("finds its config under any key whose scope + key resolves to this package", () => {
  const { findOwnConfig } = require("../dist/plugin.js");
  const { PACKAGE_NAME } = require("../dist/generate.js");
  const cut = PACKAGE_NAME.lastIndexOf("-");
  const scope = PACKAGE_NAME.slice(0, cut + 1);
  const key = PACKAGE_NAME.slice(cut + 1);
  // Recommended form: html: { scope: "loadlens-" }
  assert.deepEqual(findOwnConfig({ config: { plugins: { "metrics-by-endpoint": {}, [key]: { scope, title: "A" } } } }), { title: "A" });
  // Full package name as the key with a matching config-wide pluginsScope
  assert.deepEqual(findOwnConfig({ config: { pluginsScope: scope, plugins: { [key]: { title: "B" } } } }), { title: "B" });
  // A scoped entry wins over a plain `html` entry for another package
  assert.deepEqual(findOwnConfig({ config: { plugins: { html: { title: "other" }, [PACKAGE_NAME.slice(-1)]: { scope: PACKAGE_NAME.slice(0, -1), title: "C" } } } }).title, "C");
  // Fallback: plain `html` key (e.g. loaded via ARTILLERY_PLUGIN_PATH)
  assert.deepEqual(findOwnConfig({ config: { plugins: { html: { title: "D" } } } }), { title: "D" });
  assert.deepEqual(findOwnConfig({}), {});
});
