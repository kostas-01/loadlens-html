"use strict";
// Fixtures are real report.json files captured from Artillery 2.0.34 running examples/playwright-demo
// with different config.engines.playwright settings.

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const lib = require("../dist/index.js");
const { splitMetricKey } = require("../dist/render.js");

const TARGET = "http://127.0.0.1:8101";
const load = (name) => readFileSync(join(__dirname, "fixtures", `playwright-${name}.json`), "utf8");
const run = (name, opts = {}) => lib.generateReport(load(name), { sourceFile: `${name}.json`, targets: [TARGET], ...opts });
const titles = (model) => model.findings.map((f) => f.title);

test("default: one row per page, in visit order, with normalised query strings", () => {
  const { model, html } = run("default");
  assert.equal(model.pageMetricsBy, "url");
  assert.deepEqual(
    model.pages.map((p) => p.label),
    ["/", "/news", "/sport", "/search?page=NUMBER&q=STRING", "/app", "/app/reports"],
  );
  assert.ok(model.pages.every((p) => p.firstParty));
  assert.match(html, /id="pages-table"/);
  assert.match(html, /Pages <b>6<\/b>/);
});

test("default: SPA tab clicks are flagged as client-side routes and not ranked", () => {
  const { model } = run("default");
  const spa = model.pages.filter((p) => p.clientSideRoute).map((p) => p.label);
  assert.deepEqual(spa, ["/app/reports"]);
  assert.ok(titles(model).some((t) => t.includes("client-side navigation")));
  const slowest = model.findings.find((f) => f.title.startsWith("Slowest page"));
  assert.ok(slowest && !slowest.detail.includes("/app/reports"));
});

test("default: one Web Vitals check per page and vital, folded when all pass", () => {
  const { model, html } = run("default");
  const vitalChecks = model.checks.filter((c) => c.category === "Web Vitals");
  assert.equal(vitalChecks.length, 15);
  assert.match(html, /15 passing<\/span> <span[^>]*>Web Vitals checks/);
});

test("showAllPageMetrics: other hosts are listed separately and excluded from checks", () => {
  const { model, html } = run("showall");
  const other = model.pages.filter((p) => !p.firstParty);
  assert.deepEqual(other.map((p) => p.host), ["127.0.0.1:8102"]);
  assert.ok(!model.checks.some((c) => c.metric.includes("127.0.0.1:8102")));
  assert.ok(titles(model).some((t) => t.includes("on other hosts")));
  assert.match(html, /id="other-pages-table"/);
});

test("without a target, the dominant host is treated as first-party", () => {
  const { model } = lib.generateReport(load("showall"), { sourceFile: "x" });
  assert.equal(model.primaryHost, "127.0.0.1:8101");
  assert.equal(model.pages.filter((p) => !p.firstParty).length, 1);
});

test("extendedMetrics: DOM interactive, page views and JS heap (MB)", () => {
  const { model, html } = run("showall");
  const home = model.pages.find((p) => p.label === "/");
  assert.ok(home.domInteractive);
  assert.equal(home.views, 6); // from browser.page.domcontentloaded.<url>
  const heap = model.metrics.find((m) => m.key === "browser.memory_used_mb");
  assert.equal(heap.unit, "mb");
  assert.match(html, /DOM interactive p75/);
  assert.match(html, /\d MB/);
});

test("test.step: steps are timing metrics, and many pages don't explode the overview", () => {
  const { model, html } = run("showall");
  const steps = model.metrics.filter((m) => m.family === "browser-step").map((m) => m.qualifier);
  assert.deepEqual(steps.sort(), ["app", "app_reports_tab", "app_settings_tab", "home", "news", "search", "sport"]);
  // Per-page vitals are not charted individually in the timeline when there are > 2 pages.
  const timeline = html.slice(html.indexOf('id="timeline"'), html.indexOf('id="pages"'));
  assert.ok(!timeline.includes("FCP · First Contentful Paint"));
  assert.match(timeline, /Browser step/);
});

test("aggregateByName: rows are scenarios, with no misleading per-page findings", () => {
  const { model, html } = run("byname");
  assert.equal(model.pageMetricsBy, "name");
  assert.deepEqual(model.pages.map((p) => p.label), ["Click nav tabs"]);
  assert.ok(titles(model).some((t) => t.includes("aggregateByName")));
  assert.ok(!titles(model).some((t) => t.startsWith("Long latency tail")));
  assert.match(html, /Scenarios &amp; Web Vitals/);
  assert.deepEqual(model.targets, [TARGET]);
});

test("failed Playwright assertions are reported clearly", () => {
  const { model, html } = run("assert");
  const f = model.findings.find((x) => x.title.includes("Playwright assertion"));
  assert.equal(f.severity, "critical");
  assert.match(f.detail, /toHaveText ×6/);
  assert.match(html, /Failed assertion: <code>toHaveText<\/code>/);
  assert.equal(model.verdict, "fail");
});

test("Playwright run without any page metrics explains why and how to fix it", () => {
  const data = JSON.parse(load("default"));
  for (const block of [data.aggregate, ...data.intermediate]) {
    for (const k of Object.keys(block.summaries ?? {})) if (k.startsWith("browser.page.")) delete block.summaries[k];
    block.histograms = block.summaries;
  }
  const { model } = lib.generateReportFromObject(data, { sourceFile: "x" });
  const f = model.findings.find((x) => x.title === "No page-level timings were recorded");
  assert.ok(f);
  assert.match(f.detail, /showAllPageMetrics/);
  assert.match(f.detail, /www\.example\.com/);
});

test("metric keys split correctly for Playwright names", () => {
  assert.deepEqual(splitMetricKey("browser.page.FCP.Checkout v2.1"), { group: ["browser", "page", "FCP"], leaf: "Checkout v2.1" });
  assert.deepEqual(splitMetricKey("browser.page.LCP.checkout.flow"), { group: ["browser", "page", "LCP"], leaf: "checkout.flow" });
  assert.deepEqual(splitMetricKey("browser.page.domcontentloaded.http://a.b/c"), { group: ["browser", "page", "domcontentloaded"], leaf: "http://a.b/c" });
  assert.deepEqual(splitMetricKey("browser.step.open.menu"), { group: ["browser", "step"], leaf: "open.menu" });
  assert.deepEqual(splitMetricKey("browser.page.dominteractive"), { group: ["browser", "page"], leaf: "dominteractive" });
});

test("browser-internal pages (about:blank, chrome-error://) are never first-party", () => {
  const data = JSON.parse(load("showall"));
  const fcp = data.aggregate.summaries["browser.page.FCP.http://127.0.0.1:8101/news"];
  data.aggregate.summaries["browser.page.FCP.about:blank"] = fcp;
  data.aggregate.summaries["browser.page.TTFB.chrome-error://chromewebdata/"] = fcp;
  data.aggregate.histograms = data.aggregate.summaries;
  const { model } = lib.generateReportFromObject(data, { sourceFile: "x", targets: [TARGET] });
  for (const id of ["about:blank", "chrome-error://chromewebdata/"]) {
    const page = model.pages.find((p) => p.id === id);
    assert.ok(page, `missing ${id}`);
    assert.equal(page.kind, "url");
    assert.equal(page.firstParty, false);
    assert.equal(page.host, "browser internal");
  }
  assert.equal(model.pageMetricsBy, "url");
  assert.ok(!model.checks.some((c) => c.metric.endsWith("about:blank")));
});
