/**
 * Builds a normalised {@link ReportModel} from a raw Artillery report:
 * derived KPIs, per-period series, status/error breakdowns, threshold
 * checks and automated findings.
 */

import { createHash } from "node:crypto";
import { evaluateChecks, worstStatus } from "./thresholds.js";
import { classifyMetric, isUrl, isWebUrl, sortMetrics, STATUS_CODE_RE } from "./metrics.js";
import { fmtMs, fmtPct, fmtInt, plural } from "./format.js";
import type {
  ArtilleryMetricsBlock,
  ArtilleryReport,
  ArtillerySummary,
  Finding,
  MetricInfo,
  PageModel,
  PeriodModel,
  ReportModel,
  StatusCodeRow,
  ThresholdConfig,
} from "./types.js";

export interface AnalyzeOptions {
  title?: string;
  sourceFile: string;
  sourceText: string;
  timeZone?: string;
  thresholds?: ThresholdConfig;
  generator?: string;
  /** The run stopped early; the aggregate was reconstructed from periods. */
  partial?: boolean;
  /** Title used when no title is given and the scenario has no usable name (e.g. the test script's file name). */
  defaultTitle?: string;
  /** Extra target URLs to show (e.g. `config.target`). */
  targets?: string[];
}

export class ReportFormatError extends Error {
  override name = "ReportFormatError";
}

/** Validate that the parsed JSON looks like an Artillery v2 report. */
export function assertArtilleryReport(data: unknown): asserts data is ArtilleryReport {
  if (!data || typeof data !== "object") throw new ReportFormatError("Report is not a JSON object.");
  const agg = (data as { aggregate?: unknown }).aggregate;
  if (!agg || typeof agg !== "object") {
    throw new ReportFormatError('Missing "aggregate" block — is this an Artillery report.json?');
  }
  const a = agg as Record<string, unknown>;
  if ("latency" in a && !("counters" in a)) {
    throw new ReportFormatError(
      "This looks like an Artillery v1 report. Only the Artillery v2 format (counters/summaries) is supported.",
    );
  }
  if (!a.counters || typeof a.counters !== "object") {
    throw new ReportFormatError('Aggregate block has no "counters" object.');
  }
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const summariesOf = (b: ArtilleryMetricsBlock): Record<string, ArtillerySummary> => ({
  ...(b.histograms ?? {}),
  ...(b.summaries ?? {}),
});
const sumMatching = (counters: Record<string, number>, re: RegExp): number =>
  Object.entries(counters).reduce((acc, [k, v]) => (re.test(k) ? acc + num(v) : acc), 0);

const ERROR_RE = /^errors\./;
const REQUESTS_KEYS = ["http.requests", "browser.http_requests", "websocket.messages_sent", "socketio.emit"];

function requestCount(counters: Record<string, number>): number {
  for (const k of REQUESTS_KEYS) if (k in counters) return num(counters[k]);
  return 0;
}

function detectEngine(keys: string[]): ReportModel["engine"] {
  const http = keys.some((k) => k.startsWith("http."));
  const browser = keys.some((k) => k.startsWith("browser."));
  if (http && browser) return "mixed";
  if (browser) return "playwright";
  if (http) return "http";
  return "unknown";
}

export function analyze(report: ArtilleryReport, opts: AnalyzeOptions): ReportModel {
  const agg = report.aggregate;
  const counters = agg.counters ?? {};
  const intermediate = [...(report.intermediate ?? [])].sort((a, b) => Number(a.period) - Number(b.period));
  const timeZone = opts.timeZone ?? "UTC";

  const startedAt = num(agg.firstMetricAt ?? agg.firstCounterAt ?? intermediate[0]?.firstMetricAt) || Number(agg.period) || 0;
  const endedAt = num(agg.lastMetricAt ?? agg.lastCounterAt ?? intermediate.at(-1)?.lastMetricAt) || startedAt;
  const durationMs = Math.max(0, endedAt - startedAt);

  /* ---------------- Virtual users ---------------- */
  const created = num(counters["vusers.created"]);
  const completed = num(counters["vusers.completed"]);
  const failed = num(counters["vusers.failed"]);
  const skipped = num(counters["vusers.skipped"]);
  const aggSummaries = summariesOf(agg);

  const scenarios = Object.entries(counters)
    .filter(([k]) => k.startsWith("vusers.created_by_name."))
    .map(([k, v]) => {
      const raw = k.slice("vusers.created_by_name.".length);
      // Artillery names scenarios without a `name` by their index ("0", "1", …).
      const name = /^\d+$/.test(raw) ? `Unnamed scenario #${Number(raw) + 1}` : raw;
      return { name, created: num(v), share: created ? (num(v) / created) * 100 : 0, unnamed: /^\d+$/.test(raw) };
    })
    .sort((a, b) => b.created - a.created);

  /* ---------------- Periods ---------------- */
  const BUCKET_MS = 10_000;
  const periods: PeriodModel[] = intermediate.map((b, index) => {
    const c = b.counters ?? {};
    const ts = Number(b.period);
    const first = num(b.firstMetricAt ?? b.firstCounterAt) || ts;
    const last = num(b.lastMetricAt ?? b.lastCounterAt) || ts + BUCKET_MS;
    const windowMs = Math.min(BUCKET_MS, Math.max(1000, last - first));
    const requests = requestCount(c);
    return {
      index,
      ts,
      windowMs,
      offsetMs: Math.max(0, ts - (Number(intermediate[0]?.period) || ts)),
      counters: c,
      summaries: summariesOf(b),
      vusersCreated: num(c["vusers.created"]),
      vusersCompleted: num(c["vusers.completed"]),
      vusersFailed: num(c["vusers.failed"]),
      requests,
      rps: requests / (windowMs / 1000),
      errors: sumMatching(c, ERROR_RE),
    };
  });

  /* ---------------- Requests & codes ---------------- */
  const totalRequests = requestCount(counters);
  const codeRows: StatusCodeRow[] = [];
  const codeTotals = new Map<string, number>();
  for (const [k, v] of Object.entries(counters)) {
    const m = STATUS_CODE_RE.exec(k);
    if (m?.[1]) codeTotals.set(m[1], (codeTotals.get(m[1]) ?? 0) + num(v));
  }
  const responses = [...codeTotals.values()].reduce((a, b) => a + b, 0);
  for (const [code, count] of [...codeTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const first = code[0];
    const cls = (first && "12345".includes(first) ? `${first}xx` : "other") as StatusCodeRow["cls"];
    codeRows.push({ code, cls, count, share: responses ? (count / responses) * 100 : 0 });
  }
  const meanRps = durationMs > 0 ? totalRequests / (durationMs / 1000) : 0;
  const peakRps = periods.length ? periods.reduce((m, p) => Math.max(m, p.rps), 0) : meanRps;

  /* ---------------- Errors ---------------- */
  const errorEntries = Object.entries(counters).filter(([k]) => ERROR_RE.test(k));
  const errorTotal = errorEntries.reduce((a, [, v]) => a + num(v), 0);
  const errors = errorEntries
    .map(([k, v]) => ({ name: k.slice("errors.".length), count: num(v), share: errorTotal ? (num(v) / errorTotal) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  /* ---------------- Metrics ---------------- */
  const metrics: MetricInfo[] = sortMetrics(Object.entries(aggSummaries).map(([k, s]) => classifyMetric(k, s)));
  const { pages, primaryHost } = buildPages(metrics, counters, opts.targets ?? []);
  const pageMetricsBy: ReportModel["pageMetricsBy"] = pages.length === 0 ? "none" : pages.some((p) => p.kind === "url") ? "url" : "name";
  // Header target: the configured target, else the origin of the first first-party page.
  const firstUrl = pages.find((p) => p.firstParty && p.url)?.url;
  const targets = opts.targets?.length ? [...opts.targets] : firstUrl ? [new URL(firstUrl).origin] : [];

  /* ---------------- Counters & rates ---------------- */
  const counterRows = Object.entries(counters)
    .map(([key, total]) => ({ key, total: num(total), perPeriod: periods.map((p) => num(p.counters[key])) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const rates = Object.entries(agg.rates ?? {}).map(([key, value]) => ({ key, value: num(value) }));

  const vusers: ReportModel["vusers"] = {
    created,
    completed,
    failed,
    skipped,
    failureRate: created ? (failed / created) * 100 : 0,
    completionRate: created ? (completed / created) * 100 : 0,
  };
  if (aggSummaries["vusers.session_length"]) vusers.sessionLength = aggSummaries["vusers.session_length"];

  const model: ReportModel = {
    meta: {
      title: opts.title ?? (scenarios.length === 1 && scenarios[0] && !scenarios[0].unnamed ? scenarios[0].name : (opts.defaultTitle ?? "Load test report")),
      sourceFile: opts.sourceFile,
      sourceSha256: createHash("sha256").update(opts.sourceText).digest("hex"),
      sourceBytes: Buffer.byteLength(opts.sourceText),
      generatedAt: Date.now(),
      startedAt,
      endedAt,
      durationMs,
      timeZone,
      generator: opts.generator ?? "loadlens-html",
      partial: opts.partial ?? false,
    },
    engine: detectEngine(Object.keys(counters).concat(Object.keys(aggSummaries))),
    targets,
    vusers,
    scenarios: scenarios.map(({ unnamed: _u, ...s }) => s),
    requests: { total: totalRequests, meanRps, peakRps, responses, codes: codeRows },
    errors,
    metrics,
    pages,
    pageMetricsBy,
    primaryHost,
    periods,
    counters: counterRows,
    rates,
    checks: [],
    verdict: "pass",
    findings: [],
  };

  model.checks = evaluateChecks(model, opts.thresholds ?? {});
  model.verdict = worstStatus(model.checks.map((c) => c.status));
  model.findings = deriveFindings(model);
  return model;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

function buildPages(metrics: MetricInfo[], counters: Record<string, number>, targets: string[]): { pages: PageModel[]; primaryHost?: string } {
  const byId = new Map<string, PageModel>();
  for (const m of metrics) {
    if (!m.pageKind || m.pageKind === "all" || !m.qualifier) continue;
    if (m.family !== "web-vital" && m.family !== "page-load") continue;
    let page = byId.get(m.qualifier);
    if (!page) {
      const kind = isUrl(m.qualifier) ? "url" : "name";
      page = { id: m.qualifier, kind, label: m.qualifier, url: kind === "url" ? m.qualifier : undefined, host: kind === "url" ? hostOf(m.qualifier) : undefined, firstParty: true, views: 0, vitals: {}, clientSideRoute: false };
      byId.set(m.qualifier, page);
    }
    if (m.vital) page.vitals[m.vital] = m.stats;
    else page.domInteractive = m.stats;
  }
  const pages = [...byId.values()];

  // Primary host: the configured target's host if any page is on it, else the host with most samples.
  const targetHosts = targets.map(hostOf).filter((h): h is string => !!h);
  const samples = new Map<string, number>();
  for (const p of pages) if (p.host && p.url && isWebUrl(p.url)) samples.set(p.host, (samples.get(p.host) ?? 0) + Math.max(0, ...Object.values(p.vitals).map((s) => s?.count ?? 0)));
  const primaryHost = targetHosts.find((h) => samples.has(h)) ?? [...samples.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  for (const p of pages) {
    // Browser-internal pages (about:blank, chrome-error://…) are never part of the site under test.
    p.firstParty = p.kind === "name" || (!!p.url && isWebUrl(p.url) && (!primaryHost || p.host === primaryHost));
    if (p.url && !isWebUrl(p.url)) p.host = "browser internal";
    if (p.url && p.firstParty) {
      const u = new URL(p.url);
      p.label = `${u.pathname}${u.search}` || "/";
    }
    const dcl = counters[`browser.page.domcontentloaded.${p.id}`];
    p.views = typeof dcl === "number" ? dcl : Math.max(0, ...[p.vitals.TTFB, p.vitals.FCP, p.vitals.LCP, p.domInteractive].map((s) => s?.count ?? 0));
    p.clientSideRoute = p.kind === "url" && !!p.vitals.LCP && !p.vitals.TTFB && !p.vitals.FCP;
  }
  return { pages, primaryHost };
}

/* ------------------------------------------------------------------ */
/* Automated findings                                                  */
/* ------------------------------------------------------------------ */

function deriveFindings(m: ReportModel): Finding[] {
  const out: Finding[] = [];
  if (m.meta.partial) {
    out.push({
      severity: "critical",
      title: "The run ended before Artillery reported final metrics",
      detail: "The test was probably interrupted (for example with Ctrl-C). Totals are summed from the recorded periods, and aggregate percentiles are unavailable. Use the timeline and period breakdown instead.",
    });
  }
  const { vusers, errors, requests, metrics, periods } = m;

  if (vusers.failed > 0) {
    const top = errors.slice(0, 3).map((e) => `“${e.name}” (${fmtInt(e.count)})`).join(", ");
    out.push({
      severity: vusers.failureRate > 1 ? "critical" : "warning",
      title: `${plural(vusers.failed, "virtual user")} failed (${fmtPct(vusers.failureRate)} of ${fmtInt(vusers.created)})`,
      detail: top ? `Recorded errors: ${top}. Investigate the failing scenario step before relying on these latency figures.` : "No error counters were recorded alongside the failures.",
    });
  } else if (vusers.created > 0) {
    out.push({ severity: "info", title: "All virtual users completed", detail: `${fmtInt(vusers.completed)} of ${fmtInt(vusers.created)} sessions completed without error.` });
  }

  const inFlight = vusers.created - vusers.completed - vusers.failed - vusers.skipped;
  if (inFlight > 0) {
    out.push({ severity: "warning", title: `${plural(inFlight, "virtual user")} unaccounted for`, detail: "Created VUs exceed completed + failed. The test may have been interrupted, or sessions were still in flight when it ended." });
  }

  const c5 = requests.codes.filter((c) => c.cls === "5xx").reduce((a, c) => a + c.count, 0);
  const c4 = requests.codes.filter((c) => c.cls === "4xx").reduce((a, c) => a + c.count, 0);
  if (c5 > 0) out.push({ severity: "critical", title: `${plural(c5, "server error")} (5xx)`, detail: `${fmtPct((c5 / requests.responses) * 100, 2)} of responses were 5xx. The system under test is returning server-side failures.` });
  if (c4 > 0) out.push({ severity: "warning", title: `${plural(c4, "client error")} (4xx)`, detail: `${fmtPct((c4 / requests.responses) * 100, 2)} of responses were 4xx. Check test data, authentication and URLs.` });

  if (m.engine === "playwright" && requests.responses !== requests.total && requests.total > 0) {
    out.push({
      severity: "info",
      title: "Browser request and response counts differ",
      detail: `${fmtInt(requests.total)} requests vs ${fmtInt(requests.responses)} page responses with status codes. In Playwright tests these counters include sub-resources and are sampled independently, so small differences are expected.`,
    });
  }

  // Third-party pages (showAllPageMetrics) are reported separately and not used for findings.
  const thirdParty = new Set(m.pages.filter((p) => !p.firstParty).map((p) => p.id));
  // Scenario-aggregated page metrics (aggregateByName) mix different pages, so spread there is expected.
  const relevant = metrics.filter((x) => x.unit === "ms" && x.family !== "session" && x.family !== "browser" && x.pageKind !== "name" && !(x.qualifier && thirdParty.has(x.qualifier)));
  const nameOf = (x: MetricInfo): string => `${x.label}${x.qualifier ? ` (${m.pages.find((p) => p.id === x.qualifier)?.label ?? x.qualifier})` : ""}`;

  const tails = relevant
    .filter((x) => x.stats.p50 > 0 && x.stats.max / x.stats.p50 >= 3 && x.stats.max - x.stats.p50 > 100)
    .sort((a, b) => b.stats.max / b.stats.p50 - a.stats.max / a.stats.p50);
  if (tails.length === 1 || tails.length === 2) {
    for (const x of tails) {
      out.push({ severity: "warning", title: `Long latency tail on ${nameOf(x)}`, detail: `Max ${fmtMs(x.stats.max)} is ${(x.stats.max / x.stats.p50).toFixed(1)}× the median (${fmtMs(x.stats.p50)}). Look for cold starts, GC pauses or queueing.` });
    }
  } else if (tails.length > 2) {
    out.push({
      severity: "warning",
      title: `Long latency tails on ${tails.length} metrics`,
      detail: `Worst: ${tails.slice(0, 3).map((x) => `${nameOf(x)}, max ${fmtMs(x.stats.max)} vs median ${fmtMs(x.stats.p50)}`).join("; ")}. Look for cold starts, GC pauses or queueing.`,
    });
  }

  // Trend: compare mean of first and last periods with meaningful samples.
  const full = periods.filter((p) => p.windowMs >= 5000);
  if (full.length >= 2) {
    const trends: { x: MetricInfo; from: number; to: number; change: number }[] = [];
    for (const x of relevant) {
      const firstS = full[0]?.summaries[x.key];
      const lastS = full.at(-1)?.summaries[x.key];
      if (!firstS || !lastS || firstS.mean <= 0) continue;
      const change = ((lastS.mean - firstS.mean) / firstS.mean) * 100;
      if (Math.abs(change) >= 25 && Math.abs(lastS.mean - firstS.mean) > 20) trends.push({ x, from: firstS.mean, to: lastS.mean, change });
    }
    const worse = trends.filter((t) => t.change > 0).sort((a, b) => b.change - a.change);
    const better = trends.filter((t) => t.change < 0).sort((a, b) => a.change - b.change);
    const describe = (t: (typeof trends)[number]): string => `${nameOf(t.x)}: ${fmtMs(t.from)} → ${fmtMs(t.to)} (${t.change > 0 ? "+" : ""}${t.change.toFixed(0)}%)`;
    if (worse.length) out.push({ severity: "warning", title: worse.length === 1 ? `${nameOf(worse[0]!.x)} degraded over the run` : `${worse.length} metrics degraded over the run`, detail: `Mean, first vs last full period. ${worse.slice(0, 3).map(describe).join("; ")}.` });
    if (better.length) out.push({ severity: "info", title: better.length === 1 ? `${nameOf(better[0]!.x)} improved over the run` : `${better.length} metrics improved over the run`, detail: `Mean, first vs last full period. ${better.slice(0, 3).map(describe).join("; ")}. Often caches warming up.` });
  }

  out.push(...playwrightFindings(m));

  const smallest = metrics.reduce((min, x) => Math.min(min, x.stats.count), Infinity);
  if (Number.isFinite(smallest) && smallest < 100) {
    out.push({
      severity: "info",
      title: "Small sample sizes",
      detail: `Some metrics have as few as ${fmtInt(smallest)} samples. High percentiles (p95, p99, p99.9) are unstable at this size; run longer or with more VUs before using them as SLO evidence.`,
    });
  }

  const partial = periods.filter((p) => p.windowMs < 9000).length;
  if (partial > 0 && periods.length > 1) {
    out.push({ severity: "info", title: `${plural(partial, "partial reporting period")}`, detail: "The first and/or last 10-second buckets cover less than a full window. Throughput for those periods is normalised to the measured window." });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ------------------------------------------------------------------ */
/* Playwright-specific findings                                        */
/* ------------------------------------------------------------------ */

function playwrightFindings(m: ReportModel): Finding[] {
  if (m.engine !== "playwright" && m.engine !== "mixed") return [];
  const out: Finding[] = [];
  const first = m.pages.filter((p) => p.firstParty);
  const others = m.pages.filter((p) => !p.firstParty);
  const steps = m.metrics.filter((x) => x.family === "browser-step");

  if (m.pages.length === 0) {
    out.push({
      severity: "warning",
      title: "No page-level timings were recorded",
      detail:
        `There is no per-page breakdown${steps.length ? "" : ", and only VU session length was captured"}. Artillery reports Web Vitals only for page URLs that start with config.target, character for character, ` +
        "so https://example.com does not match https://www.example.com/…, and pages reached through a redirect to another host are dropped. " +
        "Fix: make config.target match the URLs you visit, or set config.engines.playwright.showAllPageMetrics: true. " +
        (steps.length ? "Your test.step timings are still shown below." : "To time each page or action whatever its URL, wrap it in test.step('name', async () => { … }); steps appear as browser.step.* metrics."),
    });
  }

  if (m.pageMetricsBy === "name") {
    out.push({
      severity: "info",
      title: "Page metrics are grouped by scenario (aggregateByName)",
      detail: "Each Web Vital combines every page the scenario visited, so individual pages can't be compared. Turn aggregateByName off for a per-page breakdown, or use test.step() to time specific pages.",
    });
  }

  const ranked = first
    .filter((p) => !p.clientSideRoute && (p.vitals.LCP || p.vitals.FCP))
    .map((p) => ({ p, v: (p.vitals.LCP ?? p.vitals.FCP)!.p75, metric: p.vitals.LCP ? "LCP" : "FCP" }))
    .sort((a, b) => b.v - a.v);
  if (m.pageMetricsBy === "url" && ranked.length >= 2) {
    const [slow, fast] = [ranked[0]!, ranked.at(-1)!];
    out.push({
      severity: "info",
      title: `Slowest page: ${slow.p.label}`,
      detail: `${slow.metric} p75 ${fmtMs(slow.v)}, versus ${fmtMs(fast.v)} on ${fast.p.label} (fastest of ${ranked.length} pages)${slow.p.vitals.TTFB ? `. Server TTFB p75 on this page: ${fmtMs(slow.p.vitals.TTFB.p75)}` : ""}.`,
    });
  }

  const spa = m.pages.filter((p) => p.clientSideRoute);
  if (spa.length) {
    out.push({
      severity: "info",
      title: `${plural(spa.length, "page")} only reported LCP, which suggests client-side navigation`,
      detail:
        `${spa.map((p) => p.label).slice(0, 3).join(", ")}. Clicking a tab in a single-page app changes the URL without a page load, so no new TTFB/FCP is measured, and the previous page's LCP is reported under the new URL. ` +
        "Time these interactions with test.step() instead.",
    });
  }

  if (others.length) {
    out.push({
      severity: "info",
      title: `${plural(others.length, "page")} on other hosts recorded`,
      detail: `Hosts: ${[...new Set(others.map((p) => p.host))].slice(0, 4).join(", ")}. These are usually iframes, third-party widgets or redirects, included because showAllPageMetrics is on. They're listed separately and excluded from the built-in Web Vitals checks.`,
    });
  }

  const assertions = Object.entries(m.counters.reduce<Record<string, number>>((acc, c) => (c.key.startsWith("errors.pw_failed_assertion.") ? { ...acc, [c.key.slice(27)]: c.total } : acc), {}));
  if (assertions.length) {
    out.push({
      severity: "critical",
      title: `${plural(assertions.reduce((a, [, n]) => a + n, 0), "Playwright assertion")} failed`,
      detail: `${assertions.map(([k, n]) => `${k} ×${n}`).join(", ")}. The page didn't show what the test expected. Check the page content or the selectors.`,
    });
  }
  return out;
}
