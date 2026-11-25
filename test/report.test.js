"use strict";
// Run with `npm test` (builds first). Uses only node:test — no test dependencies.

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const lib = require("../dist/index.js");
const { splitMetricKey } = require("../dist/render.js");

const SAMPLE = readFileSync(join(__dirname, "..", "examples", "sample-report.json"), "utf8");

test("generates a complete report from a Playwright report.json", () => {
  const { html, model } = lib.generateReport(SAMPLE, { sourceFile: "sample-report.json" });
  assert.equal(model.engine, "playwright");
  assert.equal(model.vusers.created, 30);
  assert.equal(model.vusers.failed, 1);
  assert.equal(model.requests.total, 6663);
  assert.equal(model.periods.length, 4);
  assert.equal(model.verdict, "fail"); // 3.3% VU failure rate > 1% default
  for (const id of ["overview", "checks", "findings", "timeline", "pages", "latency", "responses", "periods", "metrics", "about"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing section #${id}`);
  }
  assert.match(html, /Not affiliated with or endorsed by Artillery Software Inc\./);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
});

test("rates Web Vitals at p75 against Google thresholds", () => {
  const { model } = lib.generateReport(SAMPLE, { sourceFile: "x" });
  const fcp = model.checks.find((c) => c.metric === "browser.page.FCP.https://www.bbc.com/");
  assert.ok(fcp);
  assert.equal(fcp.value, 301.9);
  assert.equal(fcp.status, "pass");
});

test("custom rules support wildcards, counters and report missing metrics", () => {
  const { model } = lib.generateReport(SAMPLE, {
    sourceFile: "x",
    thresholds: {
      failureRate: false,
      checks: [
        { metric: "browser.page.TTFB.*", stat: "p95", fail: 50 },
        { metric: "errors.*", type: "counter", fail: 0 },
        { metric: "does.not.exist", stat: "p95", fail: 1 },
      ],
    },
  });
  const custom = model.checks.filter((c) => c.source === "config");
  assert.equal(custom.length, 3);
  assert.equal(custom[0].status, "fail");
  assert.equal(custom[1].status, "fail");
  assert.equal(custom[2].status, "warn");
  assert.match(custom[2].note, /not found/);
  assert.ok(!model.checks.some((c) => c.id === "vu-failure-rate"));
});

test("escapes metric names taken from the report", () => {
  const data = JSON.parse(SAMPLE);
  data.aggregate.counters['errors.<img src=x onerror=alert(1)>'] = 1;
  const { html } = lib.generateReportFromObject(data, { sourceFile: "x" });
  assert.ok(!html.includes("<img src=x"), "raw markup leaked into the report");
  assert.match(html, /&lt;img src=x/);
});

test("embedded JSON cannot break out of its script tag", () => {
  const data = JSON.parse(SAMPLE);
  data.aggregate.counters["errors.</script><script>alert(1)</script>"] = 1;
  const { html } = lib.generateReportFromObject(data, { sourceFile: "x" });
  const raw = html.slice(html.indexOf('id="raw-report"'));
  assert.ok(!raw.slice(0, raw.indexOf("</script>")).includes("<script>"));
});

test("rejects files that are not Artillery v2 reports", () => {
  assert.throws(() => lib.generateReport("{}", { sourceFile: "x" }), lib.ReportFormatError);
  assert.throws(() => lib.generateReport('{"aggregate":{"latency":{}}}', { sourceFile: "x" }), /v1 report/);
});

test("handles reports without intermediate periods", () => {
  const data = JSON.parse(SAMPLE);
  delete data.intermediate;
  const { html, model } = lib.generateReportFromObject(data, { sourceFile: "x" });
  assert.equal(model.periods.length, 0);
  assert.match(html, /no intermediate periods/);
});

test("splits metric keys into namespaces, keeping URLs and free text intact", () => {
  assert.deepEqual(splitMetricKey("browser.page.FCP.https://www.bbc.com/"), { group: ["browser", "page", "FCP"], leaf: "https://www.bbc.com/" });
  assert.deepEqual(splitMetricKey("browser.page.codes.200"), { group: ["browser", "page", "codes"], leaf: "200" });
  assert.deepEqual(splitMetricKey("errors.Failed at 1.2.3.4"), { group: ["errors"], leaf: "Failed at 1.2.3.4" });
  assert.deepEqual(splitMetricKey("vusers.created_by_name.My v1.2 flow"), { group: ["vusers", "created_by_name"], leaf: "My v1.2 flow" });
  assert.deepEqual(splitMetricKey("plugins.metrics-by-endpoint.response_time./api/cart"), { group: ["plugins", "metrics-by-endpoint", "response_time"], leaf: "/api/cart" });
  assert.deepEqual(splitMetricKey("vusers.session_length"), { group: ["vusers"], leaf: "session_length" });
});

test("VERSION matches package.json", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
  assert.equal(lib.VERSION, pkg.version);
});

test("explains missing page timings in Playwright runs", () => {
  const data = JSON.parse(SAMPLE);
  for (const block of [data.aggregate, ...data.intermediate]) {
    for (const k of Object.keys(block.summaries)) if (k.startsWith("browser.page.")) delete block.summaries[k];
    block.histograms = block.summaries;
  }
  const { model, html } = lib.generateReportFromObject(data, { sourceFile: "x" });
  assert.ok(model.findings.some((f) => f.title === "No page-level timings were recorded"));
  assert.match(html, /not recorded, see Findings/);
});

test("unnamed scenarios get a readable label and the title falls back to the file name", () => {
  const data = JSON.parse(SAMPLE);
  const c = data.aggregate.counters;
  c["vusers.created_by_name.0"] = c["vusers.created_by_name.Visit BBC homepage"];
  delete c["vusers.created_by_name.Visit BBC homepage"];
  const { model } = lib.generateReportFromObject(data, { sourceFile: "x", defaultTitle: "api" });
  assert.equal(model.meta.title, "api");
  assert.equal(model.scenarios[0].name, "Unnamed scenario #1");
});
