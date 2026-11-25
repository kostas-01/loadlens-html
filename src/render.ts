/** Renders a {@link ReportModel} to a single self-contained HTML document. */

import { STYLES, SCRIPT } from "./assets.js";
import { barChart, legend, lineChart, sparkline, type Series, type Threshold } from "./charts.js";
import {
  esc,
  fmtBytes,
  fmtClock,
  fmtDateTime,
  fmtDuration,
  fmtInt,
  fmtMs,
  fmtNum,
  fmtOffset,
  fmtPct,
  fmtValue,
  html,
  plural,
  raw,
  slug,
} from "./format.js";
import { rateVital, VITAL_ORDER, WEB_VITALS } from "./metrics.js";
import type { ArtilleryReport, ArtillerySummary, CheckResult, Finding, MetricInfo, PageModel, ReportModel, Status, WebVitalName } from "./types.js";

export interface RenderOptions {
  /** Embed the raw report JSON so viewers can download it. Default true. */
  embedRaw?: boolean;
  /** Optional free-text description shown under the title. */
  description?: string;
  /** Environment / build labels shown in the header, e.g. { env: "staging", build: "1.4.2" }. */
  labels?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  pass: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.86a.75.75 0 0 0-1.22-.88l-3.48 4.83-1.9-1.9a.75.75 0 1 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.14-.09l4.02-5.52Z" clip-rule="evenodd"/></svg>',
  warn: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8.48 2.9a1.75 1.75 0 0 1 3.04 0l6.28 11.2A1.75 1.75 0 0 1 16.28 16.7H3.72a1.75 1.75 0 0 1-1.52-2.6L8.48 2.9ZM10 6.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6.5Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/></svg>',
  fail: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd"/></svg>',
  info: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.25v3.25c0 .41.34.75.75.75h.75a.75.75 0 0 0 0-1.5h-.25V9.75A.75.75 0 0 0 10.5 9H9Z" clip-rule="evenodd"/></svg>',
  print: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 8V3h10v5M5 14H3.5A1.5 1.5 0 0 1 2 12.5v-3A1.5 1.5 0 0 1 3.5 8h13A1.5 1.5 0 0 1 18 9.5v3a1.5 1.5 0 0 1-1.5 1.5H15M5 11h10v6H5z"/></svg>',
  theme: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 0 0 14Z" fill="currentColor"/></svg>',
  download: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 3v10m0 0-4-4m4 4 4-4M3 15v2h14v-2"/></svg>',
};

const STATUS_TEXT: Record<Status, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };
const RATING_TEXT = { good: "Good", "needs-improvement": "Needs improvement", poor: "Poor" } as const;

const statusBadge = (s: Status): string => `<span class="badge ${s}">${ICONS[s]}${STATUS_TEXT[s]}</span>`;
const severityIcon = (s: Finding["severity"]): string =>
  `<span class="ico-${s === "critical" ? "fail" : s === "warning" ? "warn" : "info"}">${ICONS[s === "critical" ? "fail" : s === "warning" ? "warn" : "info"]}</span>`;

const metricName = (m: MetricInfo): string => (m.qualifier ? `${m.label} — ${m.qualifier}` : m.label);

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function masthead(m: ReportModel, o: RenderOptions): string {
  const counts = { pass: 0, warn: 0, fail: 0 };
  m.checks.forEach((c) => counts[c.status]++);
  const engine = { http: "Artillery · HTTP engine", playwright: "Artillery · Playwright engine", mixed: "Artillery · HTTP + Playwright", unknown: "Artillery" }[m.engine];
  const labels = Object.entries(o.labels ?? {});
  return html`<header class="masthead"><div class="wrap">
    <div>
      <div class="eyebrow"><span>Load test report</span><span class="dot"></span><span>${engine}</span>${m.meta.partial ? raw(`<span class="dot"></span><span class="badge fail" style="text-transform:none;letter-spacing:0">${ICONS.fail}Incomplete run</span>`) : ""}${labels.map(([k, v]) => raw(html`<span class="dot"></span><span>${k}: ${v}</span>`))}</div>
      <h1>${m.meta.title}</h1>
      ${o.description ? raw(html`<p class="narrative muted" style="margin:0 0 10px">${o.description}</p>`) : ""}
      <div class="meta-row">
        <span>Started <b>${fmtDateTime(m.meta.startedAt, m.meta.timeZone)}</b></span>
        <span>Duration <b>${fmtDuration(m.meta.durationMs)}</b></span>
        ${m.targets.length ? raw(html`<span>Target <b>${m.targets.join(", ")}</b></span>`) : ""}
        ${m.pageMetricsBy === "url" ? raw(html`<span>Pages <b>${m.pages.filter((p) => p.firstParty).length}</b>${m.pages.some((p) => !p.firstParty) ? ` (+${m.pages.filter((p) => !p.firstParty).length} other hosts)` : ""}</span>`) : ""}
        <span>Scenarios <b>${m.scenarios.length ? m.scenarios.map((s) => s.name).join(", ") : "—"}</b></span>
      </div>
    </div>
    <div class="verdict">
      <span class="verdict-pill ${m.verdict}" role="status">${raw(ICONS[m.verdict])}${STATUS_TEXT[m.verdict]}</span>
      <small>${fmtInt(counts.pass)} passed · ${counts.warn === 1 ? "1 warning" : `${fmtInt(counts.warn)} warnings`} · ${fmtInt(counts.fail)} failed</small>
      <div class="toolbar">
        <button class="btn" id="theme-toggle" type="button">${raw(ICONS.theme)}<span>Dark</span></button>
        ${o.embedRaw !== false ? raw(`<button class="btn" id="json-btn" type="button">${ICONS.download}JSON</button>`) : ""}
        <button class="btn" id="print-btn" type="button">${raw(ICONS.print)}Print / PDF</button>
      </div>
    </div>
  </div></header>`;
}

function nav(m: ReportModel): string {
  const items: [string, string][] = [
    ["overview", "Overview"],
    ["checks", "SLO checks"],
    ["findings", "Findings"],
    ["timeline", "Timeline"],
  ];
  if (m.pages.length) items.push(["pages", m.pageMetricsBy === "name" ? "Scenarios" : "Pages"]);
  items.push(["latency", "Latency"], ["responses", "Responses & errors"], ["periods", "Periods"], ["metrics", "Metrics"], ["about", "About"]);
  return `<nav class="nav" aria-label="Report sections"><div class="wrap">${items.map(([id, l]) => `<a href="#${id}">${esc(l)}</a>`).join("")}</div></nav>`;
}

function headlineLatency(m: ReportModel): { label: string; metric: MetricInfo; stat: "p95" | "p75"; foot?: string } | undefined {
  const http = m.metrics.find((x) => x.key === "http.response_time");
  if (http) return { label: "Response time p95", metric: http, stat: "p95" };
  const firstParty = new Set(m.pages.filter((p) => p.firstParty && !p.clientSideRoute).map((p) => p.id));
  for (const v of ["LCP", "FCP", "TTFB"] as const) {
    const candidates = m.metrics.filter((x) => x.vital === v && firstParty.has(x.qualifier ?? ""));
    if (!candidates.length) continue;
    const metric = candidates.reduce((a, b) => (b.stats.p75 > a.stats.p75 ? b : a));
    const page = m.pages.find((p) => p.id === metric.qualifier);
    if (candidates.length === 1) return { label: `${v} p75`, metric, stat: "p75" };
    return { label: `${v} p75 · slowest ${m.pageMetricsBy === "name" ? "scenario" : "page"}`, metric, stat: "p75", foot: `${page?.label ?? ""} (slowest of ${candidates.length})` };
  }
  const steps = m.metrics.filter((x) => x.family === "browser-step");
  if (steps.length) {
    const slowest = steps.reduce((a, b) => (b.stats.p95 > a.stats.p95 ? b : a));
    return { label: `Slowest step p95 (${slowest.qualifier ?? ""})`, metric: slowest, stat: "p95" };
  }
  const any = m.metrics.find((x) => x.unit === "ms" && x.family !== "session");
  return any ? { label: `${any.label} p95`, metric: any, stat: "p95" } : undefined;
}

function overview(m: ReportModel): string {
  const v = m.vusers;
  const head = headlineLatency(m);
  const errorTotal = m.errors.reduce((a, e) => a + e.count, 0);
  const ttfb = m.pages.filter((p) => p.firstParty).length === 1 ? m.metrics.find((x) => x.vital === "TTFB") : undefined;

  const sentences: string[] = [];
  sentences.push(
    html`<p><b>${plural(v.created, "virtual user")}</b> ran ${m.scenarios.length === 1 ? raw(html`the <b>${m.scenarios[0]?.name}</b> scenario`) : `${m.scenarios.length} scenarios`} over <b>${fmtDuration(m.meta.durationMs)}</b>, issuing <b>${fmtInt(m.requests.total)}</b> requests at an average of ${fmtNum(m.requests.meanRps, 1)} req/s${m.periods.length ? ` (peak ${fmtNum(m.requests.peakRps, 1)} req/s)` : ""}.</p>`,
  );
  sentences.push(
    v.failed > 0
      ? html`<p><b>${fmtInt(v.completed)}</b> sessions completed (${fmtPct(v.completionRate)}) and <b>${fmtInt(v.failed)}</b> failed${m.errors[0] ? raw(html` — most often with “${m.errors[0].name}”`) : ""}.</p>`
      : html`<p>All <b>${fmtInt(v.completed)}</b> sessions completed successfully.</p>`,
  );
  if (head) {
    const lat = [`${head.label} was <b>${esc(fmtMs(head.metric.stats[head.stat]))}</b>`];
    if (ttfb && head.metric !== ttfb) lat.push(`server TTFB p75 was <b>${esc(fmtMs(ttfb.stats.p75))}</b>`);
    if (v.sessionLength) lat.push(`a median VU session took ${esc(fmtMs(v.sessionLength.p50))}`);
    const nPages = m.pages.filter((p) => p.firstParty).length;
    if (m.pageMetricsBy === "url" && nPages > 1) lat.push(`${nPages} pages were measured`);
    sentences.push(`<p>${lat.join("; ")}.</p>`);
  }
  const failing = m.checks.filter((c) => c.status === "fail");
  const warning = m.checks.filter((c) => c.status === "warn");
  sentences.push(
    `<p class="muted">${
      failing.length
        ? `Verdict <b>FAIL</b>: ${failing.map((c) => esc(c.label)).join(", ")} exceeded the failure threshold.`
        : warning.length
          ? `Verdict <b>WARN</b>: ${warning.map((c) => esc(c.label)).join(", ")} exceeded a warning threshold.`
          : `Verdict <b>PASS</b>: all ${m.checks.length} checks are within thresholds.`
    }</p>`,
  );

  const failShare = v.created ? (v.failed / v.created) * 100 : 0;
  const kpi = (label: string, value: string, foot: string, extra = ""): string =>
    `<div class="kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div>${extra}<div class="k-foot">${foot}</div></div>`;

  const tiles = [
    kpi("Virtual users", esc(fmtInt(v.created)), esc(m.scenarios.length === 1 ? "1 scenario" : `${m.scenarios.length} scenarios`)),
    kpi(
      "Completed",
      esc(fmtInt(v.completed)),
      esc(`${fmtPct(v.completionRate)} completion`),
      `<div class="meter" aria-hidden="true"><span style="width:${v.completionRate}%;background:var(--good)"></span>${v.failed ? `<span style="width:${failShare}%;background:var(--crit)"></span>` : ""}</div>`,
    ),
    kpi(
      `${v.failed > 0 ? `<span class="ico-fail" style="display:inline-flex;width:14px">${ICONS.fail}</span>` : ""}Failed`,
      esc(fmtInt(v.failed)),
      esc(`${fmtPct(v.failureRate)} failure rate`),
    ),
    kpi("Errors", esc(fmtInt(errorTotal)), esc(m.errors.length ? plural(m.errors.length, "distinct type") : "none recorded")),
    kpi("Requests", esc(fmtInt(m.requests.total)), esc(`${fmtInt(m.requests.responses)} responses`)),
    kpi("Throughput", `${esc(fmtNum(m.requests.meanRps, 1))}<small>req/s</small>`, esc(m.periods.length ? `peak ${fmtNum(m.requests.peakRps, 1)} req/s` : "mean over the run")),
    head
      ? kpi(esc(head.label), esc(fmtMs(head.metric.stats[head.stat])), esc(head.foot ?? `median ${fmtMs(head.metric.stats.p50)} · max ${fmtMs(head.metric.stats.max)}`))
      : kpi("Page timings", "—", m.engine === "playwright" ? "not recorded, see Findings" : "no timing metrics"),
    v.sessionLength
      ? kpi("Session length p50", esc(fmtMs(v.sessionLength.p50)), esc(`p95 ${fmtMs(v.sessionLength.p95)} · max ${fmtMs(v.sessionLength.max)}`))
      : kpi("Duration", esc(fmtDuration(m.meta.durationMs)), esc(`${m.periods.length} reporting periods`)),
  ];

  return `<section class="block" id="overview">
    <div class="block-head"><div><h2>Executive summary</h2><p>Headline outcome of the run and key indicators.</p></div></div>
    <div class="summary-grid">
      <div class="card card-pad narrative">${sentences.join("")}</div>
      <div class="card kpis">${tiles.join("")}</div>
    </div>
  </section>`;
}

function checksSection(m: ReportModel): string {
  const counts = { pass: 0, warn: 0, fail: 0 };
  m.checks.forEach((c) => counts[c.status]++);
  const order: Record<Status, number> = { fail: 0, warn: 1, pass: 2 };
  const sorted = [...m.checks].sort((a, b) => order[a.status] - order[b.status]);
  // Many pages produce many passing Web Vitals checks; fold them away so problems stay visible.
  const passingVitals = sorted.filter((c) => c.category === "Web Vitals" && c.status === "pass");
  const fold = passingVitals.length > 6;
  const rows = fold ? sorted.filter((c) => !passingVitals.includes(c)) : sorted;
  const fmtLimit = (c: CheckResult, v?: number): string => (v === undefined ? "—" : fmtValue(v, c.unit));
  const rowHtml = (c: CheckResult): string => html`<tr>
            <td data-v="${order[c.status]}">${raw(statusBadge(c.status))}</td>
            <td class="wrap-cell"><b>${c.label}</b>${c.note ? raw(html`<div class="sub">${c.note}</div>`) : ""}</td>
            <td>${c.category}</td>
            <td class="num" data-v="${Number.isFinite(c.value) ? c.value : ""}"><b>${Number.isFinite(c.value) ? fmtValue(c.value, c.unit) : "n/a"}</b></td>
            <td class="num">${fmtLimit(c, c.warn)}</td>
            <td class="num">${fmtLimit(c, c.fail)}</td>
            <td class="metric-cell"><code>${c.metric}</code></td>
            <td><span class="badge neutral">${c.source}</span></td>
          </tr>`;
  const head = `<thead><tr><th data-sort="num">Status</th><th data-sort="text">Check</th><th data-sort="text">Category</th><th class="num" data-sort="num">Measured</th><th class="num">Warn &gt;</th><th class="num">Fail &gt;</th><th data-sort="text">Metric</th><th>Source</th></tr></thead>`;
  const body = rows.length ? rows.map(rowHtml).join("") : fold ? "" : `<tr><td colspan="8" class="empty">No checks configured.</td></tr>`;
  const folded = fold
    ? `<details class="card" style="margin-top:12px"><summary><span>${statusBadge("pass").replace("PASS", `${passingVitals.length} passing`)} <span style="margin-left:6px">Web Vitals checks across ${new Set(passingVitals.map((c) => c.note)).size} pages</span></span></summary><div class="table-wrap"><table class="data" id="checks-vitals-table">${head}<tbody>${passingVitals.map(rowHtml).join("")}</tbody></table></div></details>`
    : "";

  return `<section class="block" id="checks">
    <div class="block-head"><div><h2>SLO checks</h2><p>Each check compares a measured value with its thresholds: above <i>warn</i> raises a warning, above <i>fail</i> fails the run. Web Vitals use Google's published p75 thresholds.</p></div>
      <div class="check-summary">${statusBadge("pass").replace("PASS", `${counts.pass} passed`)}${statusBadge("warn").replace("WARN", counts.warn === 1 ? "1 warning" : `${counts.warn} warnings`)}${statusBadge("fail").replace("FAIL", `${counts.fail} failed`)}</div></div>
    ${body ? `<div class="card table-wrap"><table class="data" id="checks-table">${head}<tbody>${body}</tbody></table></div>` : ""}
    ${folded}
  </section>`;
}

function findingsSection(m: ReportModel): string {
  const items = m.findings.length
    ? m.findings.map((f) => html`<li>${raw(severityIcon(f.severity))}<div><div class="f-title">${f.title}</div><div class="f-detail">${f.detail}</div></div></li>`).join("")
    : `<li><span></span><div class="f-detail">No notable findings.</div></li>`;
  return `<section class="block" id="findings">
    <div class="block-head"><div><h2>Findings</h2><p>Automated observations, ordered by severity. Use them as starting points for investigation, not as conclusions.</p></div></div>
    <div class="card"><ul class="findings">${items}</ul></div>
  </section>`;
}

function periodLabels(m: ReportModel): { labels: string[]; tips: string[] } {
  return {
    labels: m.periods.map((p) => fmtOffset(p.offsetMs)),
    tips: m.periods.map((p) => `${fmtClock(p.ts, m.meta.timeZone)} · ${fmtOffset(p.offsetMs)} · window ${fmtNum(p.windowMs / 1000, 1)} s`),
  };
}

function chartCard(title: string, sub: string, legendHtml: string, svg: string): string {
  return `<div class="card"><div class="card-head"><div><h3>${esc(title)}</h3><div class="sub">${esc(sub)}</div></div>${legendHtml}</div><div class="card-body">${svg}</div></div>`;
}

function thresholdsFor(m: ReportModel, metric: MetricInfo): Threshold[] {
  const out: Threshold[] = [];
  if (metric.vital) {
    const spec = WEB_VITALS[metric.vital];
    out.push({ value: spec.good, label: `good ≤ ${fmtValue(spec.good, spec.unit)}`, status: "warn" });
    out.push({ value: spec.poor, label: `poor > ${fmtValue(spec.poor, spec.unit)}`, status: "fail" });
    return out;
  }
  for (const c of m.checks.filter((c) => c.metric === metric.key && c.unit === "ms")) {
    if (c.warn !== undefined) out.push({ value: c.warn, label: `warn > ${fmtMs(c.warn)}`, status: "warn" });
    if (c.fail !== undefined) out.push({ value: c.fail, label: `fail > ${fmtMs(c.fail)}`, status: "fail" });
  }
  return out;
}

/**
 * Metrics shown as individual charts and cards. With more than two pages, per-page
 * metrics would multiply into dozens of charts; they live in the Pages table and
 * the Metrics explorer instead. Third-party pages never get overview charts.
 */
function overviewMetrics(m: ReportModel): MetricInfo[] {
  const third = new Set(m.pages.filter((p) => !p.firstParty).map((p) => p.id));
  const manyPages = m.pages.filter((p) => p.firstParty).length > 2;
  return m.metrics.filter((x) => {
    if (x.qualifier && third.has(x.qualifier)) return false;
    if (manyPages && (x.pageKind === "url" || x.pageKind === "name")) return false;
    return true;
  });
}

function timelineSection(m: ReportModel): string {
  if (m.periods.length === 0) {
    return `<section class="block" id="timeline"><div class="block-head"><div><h2>Timeline</h2></div></div><div class="card empty">The report has no intermediate periods, so no time series is available.</div></section>`;
  }
  const { labels, tips } = periodLabels(m);
  const vuSeries: Series[] = [
    { name: "Created", color: "var(--s1)", values: m.periods.map((p) => p.vusersCreated), display: m.periods.map((p) => fmtInt(p.vusersCreated)) },
    { name: "Completed", color: "var(--good)", values: m.periods.map((p) => p.vusersCompleted), display: m.periods.map((p) => fmtInt(p.vusersCompleted)) },
    { name: "Failed", color: "var(--crit)", values: m.periods.map((p) => p.vusersFailed), display: m.periods.map((p) => fmtInt(p.vusersFailed)) },
  ];
  const rpsSeries: Series[] = [
    { name: "Requests / s", color: "var(--s1)", values: m.periods.map((p) => p.rps), display: m.periods.map((p) => `${fmtNum(p.rps, 1)} req/s (${fmtInt(p.requests)} total)`) },
  ];

  const latencyCards = overviewMetrics(m)
    .filter((x) => x.unit === "ms" || x.unit === "score" || x.unit === "mb")
    .map((metric) => {
      const pick = (stat: "p50" | "p95" | "p99"): (number | null)[] => m.periods.map((p) => p.summaries[metric.key]?.[stat] ?? null);
      const fmt = (vals: (number | null)[]): string[] => vals.map((v) => (v === null ? "—" : fmtValue(v, metric.unit)));
      const series: Series[] = (["p50", "p95", "p99"] as const).map((stat, i) => {
        const values = pick(stat);
        return { name: stat, color: `var(--s${i + 1})`, values, display: fmt(values), dashed: stat === "p99" };
      });
      const counts = m.periods.map((p) => p.summaries[metric.key]?.count ?? 0);
      const svg = lineChart({
        labels,
        tipLabels: tips.map((t, i) => `${t} · n=${counts[i]}`),
        series,
        unit: metric.unit,
        thresholds: thresholdsFor(m, metric),
        ariaLabel: `${metricName(metric)} percentiles over time`,
        height: 210,
      });
      const page = m.pages.find((p) => p.id === metric.qualifier);
      return chartCard(metric.label, page ? page.label : (metric.qualifier ?? metric.key), legend(series, "line"), svg);
    });

  return `<section class="block" id="timeline">
    <div class="block-head"><div><h2>Timeline</h2><p>Per-period activity (${m.periods.length} × 10 s buckets). Hover or focus any chart for exact values.</p></div></div>
    <div class="grid g2">
      ${chartCard("Virtual user activity", "VUs created, completed and failed per period", legend(vuSeries, "rect"), barChart({ labels, tipLabels: tips, series: vuSeries, unit: "count", ariaLabel: "Virtual users per period" }))}
      ${chartCard("Request throughput", "Requests per second, normalised to the measured window", "", barChart({ labels, tipLabels: tips, series: rpsSeries, unit: "rps", ariaLabel: "Requests per second per period" }))}
    </div>
    ${latencyCards.length ? `<h3 style="font-size:14px;margin:24px 0 12px">Percentiles over time</h3><div class="grid g2">${latencyCards.join("")}</div>` : ""}
    ${overviewMetrics(m).length < m.metrics.length ? `<p class="muted" style="font-size:12.5px;margin:12px 0 0">Per-page charts are in <a href="#metrics">Metrics</a>${m.pages.length ? `, and page comparisons in <a href="#pages">${m.pageMetricsBy === "name" ? "Scenarios" : "Pages"}</a>` : ""}.</p>` : ""}
  </section>`;
}

function vitalCard(metric: MetricInfo): string {
  const spec = WEB_VITALS[metric.vital!];
  const value = metric.stats.p75;
  const rating = rateVital(spec, value);
  const domain = Math.max(spec.poor * 1.5, value * 1.08);
  const g1 = (spec.good / domain) * 100;
  const g2 = ((spec.poor - spec.good) / domain) * 100;
  const needle = Math.min(100, (value / domain) * 100);
  return html`<div class="card vital">
    <div class="v-head"><div><div class="v-name">${spec.name}</div><div class="v-title">${spec.title}</div></div>
      <span class="badge ${rating}">${raw(ICONS[rating === "good" ? "pass" : rating === "poor" ? "fail" : "warn"])}${RATING_TEXT[rating]}</span></div>
    <div class="v-value">${fmtValue(value, spec.unit)} <small>p75</small></div>
    <div class="gauge" style="--g1:${g1.toFixed(2)}fr;--g2:${g2.toFixed(2)}fr;--g3:${(100 - g1 - g2).toFixed(2)}fr" role="img" aria-label="${`${spec.name} p75 ${fmtValue(value, spec.unit)}, rated ${RATING_TEXT[rating]}`}">
      <i></i><i></i><i></i><span class="needle" style="left:${needle.toFixed(2)}%"></span></div>
    <div class="gauge-scale"><span>0</span><span>good ≤ ${fmtValue(spec.good, spec.unit)} · poor &gt; ${fmtValue(spec.poor, spec.unit)}</span></div>
    <div class="v-foot"><span>p50 <b>${fmtValue(metric.stats.p50, spec.unit)}</b></span><span>p95 <b>${fmtValue(metric.stats.p95, spec.unit)}</b></span><span>max <b>${fmtValue(metric.stats.max, spec.unit)}</b></span><span>n=${fmtInt(metric.stats.count)}</span></div>
  </div>`;
}

/** Table cell with a p75 value and its Google rating (icon shape + colour, never colour alone). */
function vitalCell(stats: ArtillerySummary | undefined, name: WebVitalName): string {
  if (!stats) return `<td class="num muted" data-v="-1">—</td>`;
  const spec = WEB_VITALS[name];
  const rating = rateVital(spec, stats.p75);
  const icon = ICONS[rating === "good" ? "pass" : rating === "poor" ? "fail" : "warn"];
  const tip = JSON.stringify({ t: `${name} · ${spec.title}`, r: [{ c: `var(--${rating === "good" ? "good" : rating === "poor" ? "crit" : "warn"})`, n: `p75 · ${RATING_TEXT[rating]}`, v: fmtValue(stats.p75, spec.unit) }, { c: "var(--text-3)", n: "p95", v: fmtValue(stats.p95, spec.unit) }, { c: "var(--text-3)", n: "samples", v: fmtInt(stats.count) }] });
  return `<td class="num" data-v="${stats.p75}"><span class="rate" data-tip="${esc(tip)}" tabindex="0"><span class="ico-${rating === "good" ? "pass" : rating === "poor" ? "fail" : "warn"}">${icon}</span>${esc(fmtValue(stats.p75, spec.unit))}</span></td>`;
}

function pagesTable(m: ReportModel, pages: PageModel[], id: string, vitals: WebVitalName[], hasDomi: boolean): string {
  const byName = m.pageMetricsBy === "name";
  const rows = pages
    .map((p, i) => {
      const badges = p.clientSideRoute ? ` <span class="badge neutral" title="Only LCP was reported: typical of a client-side route change">client-side route</span>` : "";
      const sub = !p.firstParty && p.host ? `<div class="sub">${esc(p.host)}</div>` : p.url && p.firstParty && m.pages.some((x) => !x.firstParty) ? `<div class="sub">${esc(p.host ?? "")}</div>` : "";
      return `<tr><td class="num" data-v="${i + 1}">${i + 1}</td><td class="wrap-cell" data-csv="${esc(p.id)}"><span class="${byName ? "" : "mono"}" title="${esc(p.id)}">${esc(p.label)}</span>${badges}${sub}</td><td class="num" data-v="${p.views}">${esc(fmtInt(p.views))}</td>${vitals.map((v) => vitalCell(p.vitals[v], v)).join("")}${hasDomi ? `<td class="num" data-v="${p.domInteractive?.p75 ?? -1}">${p.domInteractive ? esc(fmtMs(p.domInteractive.p75)) : "—"}</td>` : ""}</tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="data" id="${id}"><thead><tr><th class="num" data-sort="num">#</th><th data-sort="text">${byName ? "Scenario" : "Page"}</th><th class="num" data-sort="num" title="${m.counters.some((c) => c.key.startsWith("browser.page.domcontentloaded.")) ? "DOMContentLoaded events" : "Largest Web Vitals sample count"}">Views</th>${vitals.map((v) => `<th class="num" data-sort="num" title="${esc(WEB_VITALS[v].title)}, p75">${v} p75</th>`).join("")}${hasDomi ? `<th class="num" data-sort="num" title="DOM interactive, p75 (extendedMetrics)">DOM interactive p75</th>` : ""}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function pagesSection(m: ReportModel): string {
  if (!m.pages.length) return "";
  const first = m.pages.filter((p) => p.firstParty);
  const others = m.pages.filter((p) => !p.firstParty);
  const vitals = VITAL_ORDER.filter((v) => m.pages.some((p) => p.vitals[v]));
  const hasDomi = m.pages.some((p) => p.domInteractive);
  const byName = m.pageMetricsBy === "name";

  const details = first
    .map((p) => {
      const cards = m.metrics.filter((x) => x.vital && x.qualifier === p.id).sort((a, b) => VITAL_ORDER.indexOf(a.vital!) - VITAL_ORDER.indexOf(b.vital!));
      if (!cards.length) return "";
      return `<details class="card page-detail"${first.length === 1 ? " open" : ""}><summary><span><span class="${byName ? "" : "mono"}">${esc(p.label)}</span> <span class="sub">${esc(plural(p.views, "view"))}${p.clientSideRoute ? " · client-side route" : ""}</span></span></summary><div class="grid g3" style="padding:16px 20px 20px">${cards.map(vitalCard).join("")}</div></details>`;
    })
    .join("");

  const intro = byName
    ? "Metrics are grouped by scenario name (aggregateByName), so each row combines every page that scenario visited."
    : `${plural(first.length, "page")} in the order they were first visited${m.primaryHost ? ` on ${esc(m.primaryHost)}` : ""}. Values are p75, rated against Google's thresholds. Hover a value for details.`;

  return `<section class="block" id="pages">
    <div class="block-head"><div><h2>${byName ? "Scenarios" : "Pages"} &amp; Web Vitals</h2><p>${intro}</p></div><div class="table-tools"><button class="btn" data-csv="pages-table" type="button">${ICONS.download}CSV</button></div></div>
    <div class="card">${pagesTable(m, first, "pages-table", vitals, hasDomi)}
      <div class="rate-legend"><span><span class="ico-pass">${ICONS.pass}</span>Good</span><span><span class="ico-warn">${ICONS.warn}</span>Needs improvement</span><span><span class="ico-fail">${ICONS.fail}</span>Poor</span><span class="muted">Lab measurements from synthetic users; real-user (field) data may differ.</span></div></div>
    ${others.length ? `<details class="card" style="margin-top:16px"><summary>Other hosts <span class="sub" style="margin-left:8px">${esc(plural(others.length, "page"))} · iframes, third-party content or redirects (showAllPageMetrics) · not included in SLO checks</span></summary>${pagesTable(m, others, "other-pages-table", vitals, hasDomi)}</details>` : ""}
    ${details ? `<h3 style="font-size:14px;margin:22px 0 12px">Per-${byName ? "scenario" : "page"} detail</h3><div class="page-details">${details}</div>` : ""}
  </section>`;
}

function ladder(metric: MetricInfo, thresholds: Threshold[]): string {
  const s = metric.stats;
  const rows: [string, number][] = [["min", s.min], ["p50", s.p50], ["p75", s.p75], ["p90", s.p90], ["p95", s.p95], ["p99", s.p99], ["max", s.max]];
  const domain = Math.max(s.max, ...thresholds.filter((t) => t.value <= s.max * 1.4).map((t) => t.value)) || 1;
  const marks = thresholds
    .filter((t) => t.value <= domain)
    .map((t) => `<span class="mark ${t.status}" style="left:${((t.value / domain) * 100).toFixed(2)}%" title="${esc(t.label)}"></span>`)
    .join("");
  return `<div class="ladder">${rows
    .map(
      ([k, v]) =>
        `<span class="l-stat">${k}</span><div class="track" data-tip="${esc(JSON.stringify({ t: metricName(metric), r: [{ c: "var(--s1)", n: k, v: fmtValue(v, metric.unit) }] }))}"><span style="width:${Math.max(0.5, (v / domain) * 100).toFixed(2)}%"></span>${marks}</div><span class="l-val">${esc(fmtValue(v, metric.unit))}</span>`,
    )
    .join("")}</div>`;
}

function latencySection(m: ReportModel): string {
  if (!m.metrics.length) {
    return `<section class="block" id="latency"><div class="block-head"><div><h2>Latency</h2></div></div><div class="card empty">No timing metrics (summaries/histograms) in this report.</div></section>`;
  }
  const cards = overviewMetrics(m).map((metric) => {
    const s = metric.stats;
    return html`<div class="card" id="metric-${slug(metric.key)}"><div class="card-head"><div><h3>${metric.label}</h3><div class="sub">${metric.qualifier ?? metric.key}</div></div><span class="badge neutral">n=${fmtInt(s.count)}</span></div>
      <div class="card-body">
        <dl class="stat-strip"><div><dt>Mean</dt><dd>${fmtValue(s.mean, metric.unit)}</dd></div><div><dt>Median</dt><dd>${fmtValue(s.median, metric.unit)}</dd></div><div><dt>p95</dt><dd>${fmtValue(s.p95, metric.unit)}</dd></div><div><dt>p99</dt><dd>${fmtValue(s.p99, metric.unit)}</dd></div></dl>
        ${raw(ladder(metric, thresholdsFor(m, metric)))}
      </div></div>`;
  });

  const cols = ["count", "min", "mean", "p50", "p75", "p90", "p95", "p99", "p999", "max"] as const;
  const head = cols.map((c) => `<th class="num" data-sort="num">${c === "p999" ? "p99.9" : c === "count" ? "Count" : c}</th>`).join("");
  const rows = m.metrics
    .map(
      (metric) =>
        `<tr><td data-csv="${esc(metric.key)}"><b>${esc(metric.label)}</b><div class="sub">${esc(metric.qualifier ?? metric.key)}</div></td>${cols
          .map((c) => `<td class="num" data-v="${metric.stats[c]}">${esc(c === "count" ? fmtInt(metric.stats[c]) : fmtValue(metric.stats[c], metric.unit))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return `<section class="block" id="latency">
    <div class="block-head"><div><h2>Latency distribution</h2><p>Aggregate percentiles for every timing metric in the run. Dashed markers show thresholds where they fall within range.</p></div></div>
    <div class="grid g3">${cards.join("")}</div>
    <div class="block-head" style="margin-top:22px"><div><h3 style="font-size:14px">All timing metrics</h3></div><div class="table-tools"><button class="btn" data-csv="latency-table" type="button">${ICONS.download}CSV</button></div></div>
    <div class="card table-wrap"><table class="data" id="latency-table"><thead><tr><th data-sort="text">Metric</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function responsesSection(m: ReportModel): string {
  const clsColor: Record<string, string> = { "1xx": "var(--text-3)", "2xx": "var(--good)", "3xx": "var(--s1)", "4xx": "var(--warn)", "5xx": "var(--crit)", other: "var(--text-3)" };
  const clsStatus: Record<string, string> = { "2xx": "pass", "3xx": "info", "4xx": "warn", "5xx": "fail" };
  const maxCode = Math.max(1, ...m.requests.codes.map((c) => c.count));
  const codeRows = m.requests.codes.length
    ? m.requests.codes
        .map(
          (c) => html`<tr><td data-v="${c.code}"><span class="badge ${clsStatus[c.cls] ?? "neutral"}">${c.code}</span></td><td>${c.cls}</td>
            <td class="num" data-v="${c.count}">${fmtInt(c.count)}</td><td class="num" data-v="${c.share}">${fmtPct(c.share, 2)}</td>
            <td style="width:40%"><div class="hbar"><span style="${`width:${Math.max(0.5, (c.count / maxCode) * 100).toFixed(2)}%;--c:${clsColor[c.cls]}`}"></span></div></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No status-code counters in this report.</td></tr>`;

  const errTotal = m.errors.reduce((a, e) => a + e.count, 0);
  const errRows = m.errors.length
    ? m.errors
        .map((e) => html`<tr><td class="wrap-cell"><span class="ico-fail" style="display:inline-flex;width:14px;vertical-align:-2px;margin-right:6px">${raw(ICONS.fail)}</span>${e.name.startsWith("pw_failed_assertion.") ? raw(html`Failed assertion: <code>${e.name.slice(20)}</code>`) : e.name}</td><td class="num" data-v="${e.count}">${fmtInt(e.count)}</td><td class="num" data-v="${e.share}">${fmtPct(e.share)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="empty"><span class="ico-pass" style="display:inline-flex;width:14px;vertical-align:-2px;margin-right:6px">${ICONS.pass}</span>No errors recorded.</td></tr>`;

  const scenRows = m.scenarios
    .map((s) => html`<tr><td><b>${s.name}</b></td><td class="num" data-v="${s.created}">${fmtInt(s.created)}</td><td class="num" data-v="${s.share}">${fmtPct(s.share)}</td><td style="width:40%"><div class="hbar"><span style="width:${s.share.toFixed(2)}%"></span></div></td></tr>`)
    .join("");

  return `<section class="block" id="responses">
    <div class="block-head"><div><h2>Responses &amp; errors</h2><p>Status-code distribution, error breakdown and scenario mix.</p></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-head"><div><h3>Status codes</h3><div class="sub">${esc(fmtInt(m.requests.responses))} responses</div></div></div><div class="card-body" style="padding:8px 0 4px"><div class="table-wrap"><table class="data" id="codes-table"><thead><tr><th data-sort="text">Code</th><th>Class</th><th class="num" data-sort="num">Count</th><th class="num" data-sort="num">Share</th><th></th></tr></thead><tbody>${codeRows}</tbody></table></div></div></div>
      <div class="card"><div class="card-head"><div><h3>Errors</h3><div class="sub">${esc(plural(errTotal, "error"))}</div></div></div><div class="card-body" style="padding:8px 0 4px"><div class="table-wrap"><table class="data" id="errors-table"><thead><tr><th data-sort="text">Error</th><th class="num" data-sort="num">Count</th><th class="num" data-sort="num">Share</th></tr></thead><tbody>${errRows}</tbody></table></div></div></div>
    </div>
    ${scenRows ? `<div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Scenarios</h3><div class="sub">Virtual users created per scenario</div></div></div><div class="card-body" style="padding:8px 0 4px"><div class="table-wrap"><table class="data"><thead><tr><th>Scenario</th><th class="num">VUs</th><th class="num">Share</th><th></th></tr></thead><tbody>${scenRows}</tbody></table></div></div></div>` : ""}
  </section>`;
}

function periodsSection(m: ReportModel): string {
  if (!m.periods.length) return "";
  const head = headlineLatency(m);
  const rows = m.periods
    .map((p) => {
      const s = head ? p.summaries[head.metric.key] : undefined;
      return html`<tr>
        <td class="num" data-v="${p.index + 1}">${p.index + 1}</td>
        <td data-v="${p.ts}">${fmtClock(p.ts, m.meta.timeZone)}</td>
        <td>${fmtOffset(p.offsetMs)}</td>
        <td class="num" data-v="${p.windowMs}">${fmtNum(p.windowMs / 1000, 1)} s</td>
        <td class="num" data-v="${p.vusersCreated}">${fmtInt(p.vusersCreated)}</td>
        <td class="num" data-v="${p.vusersCompleted}">${fmtInt(p.vusersCompleted)}</td>
        <td class="num" data-v="${p.vusersFailed}">${p.vusersFailed ? raw(html`<b style="color:var(--crit-ink)">${fmtInt(p.vusersFailed)}</b>`) : "0"}</td>
        <td class="num" data-v="${p.requests}">${fmtInt(p.requests)}</td>
        <td class="num" data-v="${p.rps}">${fmtNum(p.rps, 1)}</td>
        <td class="num" data-v="${p.errors}">${fmtInt(p.errors)}</td>
        ${head ? raw(html`<td class="num" data-v="${s?.p50 ?? ""}">${s ? fmtValue(s.p50, head.metric.unit) : "—"}</td><td class="num" data-v="${s?.[head.stat] ?? ""}">${s ? fmtValue(s[head.stat], head.metric.unit) : "—"}</td>`) : ""}
      </tr>`;
    })
    .join("");
  const t = m.periods.reduce((a, p) => ({ c: a.c + p.vusersCreated, d: a.d + p.vusersCompleted, f: a.f + p.vusersFailed, r: a.r + p.requests, e: a.e + p.errors }), { c: 0, d: 0, f: 0, r: 0, e: 0 });
  const metricHeads = head ? `<th class="num" data-sort="num">${esc(head.metric.vital ?? "Latency")} p50</th><th class="num" data-sort="num">${esc(head.metric.vital ?? "Latency")} ${head.stat}</th>` : "";
  return `<section class="block" id="periods">
    <div class="block-head"><div><h2>Period breakdown</h2><p>One row per 10-second reporting bucket${head ? `; latency columns show ${esc(metricName(head.metric))}` : ""}.</p></div><div class="table-tools"><button class="btn" data-csv="periods-table" type="button">${ICONS.download}CSV</button></div></div>
    <div class="card table-wrap"><table class="data" id="periods-table">
      <thead><tr><th class="num" data-sort="num">#</th><th data-sort="num">Start</th><th>Offset</th><th class="num" data-sort="num">Window</th><th class="num" data-sort="num">VUs created</th><th class="num" data-sort="num">Completed</th><th class="num" data-sort="num">Failed</th><th class="num" data-sort="num">Requests</th><th class="num" data-sort="num">Req/s</th><th class="num" data-sort="num">Errors</th>${metricHeads}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td colspan="3">Total</td><td class="num">${fmtInt(t.c)}</td><td class="num">${fmtInt(t.d)}</td><td class="num">${fmtInt(t.f)}</td><td class="num">${fmtInt(t.r)}</td><td class="num">${fmtNum(m.requests.meanRps, 1)}</td><td class="num">${fmtInt(t.e)}</td>${head ? "<td></td><td></td>" : ""}</tr></tfoot>
    </table></div>
  </section>`;
}

/** Split a metric key into a display group and leaf, keeping URLs / free-text names intact. */
export function splitMetricKey(key: string): { group: string[]; leaf: string } {
  const parts = key.split(".");
  if (parts.length < 2) return { group: [], leaf: key };
  // Error names and scenario names are free text that may contain dots.
  if (parts[0] === "errors") return { group: ["errors"], leaf: parts.slice(1).join(".") };
  if (parts[0] === "vusers" && parts[1] === "created_by_name") return { group: ["vusers", "created_by_name"], leaf: parts.slice(2).join(".") };
  // Playwright: page URL / scenario name (aggregateByName) and step names are free text after a fixed prefix.
  if (parts[0] === "browser" && parts[1] === "page" && parts.length > 3 && /^(FCP|LCP|TTFB|CLS|FID|INP|dominteractive|domcontentloaded)$/.test(parts[2] ?? "")) {
    return { group: parts.slice(0, 3), leaf: parts.slice(3).join(".") };
  }
  if (parts[0] === "browser" && parts[1] === "step" && parts.length > 2) return { group: ["browser", "step"], leaf: parts.slice(2).join(".") };
  let i = 0;
  for (; i < parts.length - 1; i++) {
    if (/[\s:/]/.test(parts[i] ?? "")) break; // start of a URL, path or sentence
  }
  if (i === 0) return { group: [], leaf: key };
  return { group: parts.slice(0, i), leaf: parts.slice(i).join(".") };
}

interface ExplorerRow {
  key: string;
  group: string[];
  leaf: string;
  kind: "counter" | "timing";
}

function metricsSection(m: ReportModel): string {
  const rows: ExplorerRow[] = [
    ...m.counters.map((c) => ({ key: c.key, ...splitMetricKey(c.key), kind: "counter" as const })),
    ...m.metrics.map((x) => ({ key: x.key, ...splitMetricKey(x.key), kind: "timing" as const })),
  ].sort((a, b) => a.group.join(".").localeCompare(b.group.join(".")) || a.kind.localeCompare(b.kind) || a.leaf.localeCompare(b.leaf, undefined, { numeric: true }));

  const { labels, tips } = periodLabels(m);
  const counterByKey = new Map(m.counters.map((c) => [c.key, c]));
  const metricByKey = new Map(m.metrics.map((x) => [x.key, x]));

  let lastGroup: string | null = null;
  const groupSizes = new Map<string, number>();
  rows.forEach((r) => groupSizes.set(r.group.join("."), (groupSizes.get(r.group.join(".")) ?? 0) + 1));

  const body = rows
    .map((r) => {
      const gKey = r.group.join(".");
      let header = "";
      if (gKey !== lastGroup) {
        lastGroup = gKey;
        const segs = r.group.length ? r.group : ["(root)"];
        header = `<div class="mx-group">${segs
          .map((s, i) => (i === segs.length - 1 ? `<b>${esc(s)}</b>` : `<span>${esc(s)}</span><span class="sep">›</span>`))
          .join("")}<span class="count">${groupSizes.get(gKey)}</span></div>`;
      }

      let value: string;
      let spark: string;
      let detail: string;
      if (r.kind === "counter") {
        const c = counterByKey.get(r.key)!;
        const vals = c.perPeriod;
        value = `<b>${esc(fmtInt(c.total))}</b>`;
        spark = sparkline([{ color: "var(--s1)", values: vals }], `${r.key} per period`);
        const peak = Math.max(0, ...vals);
        detail =
          `<div class="mx-meta"><span>Total <b>${esc(fmtInt(c.total))}</b></span><span>Peak period <b>${esc(fmtInt(peak))}</b></span><span>Per second (mean) <b>${esc(fmtNum(m.meta.durationMs > 0 ? c.total / (m.meta.durationMs / 1000) : 0, 2))}</b></span><span><code>${esc(r.key)}</code></span></div>` +
          (m.periods.length
            ? `<div class="chart-wrap">${lineChart({ labels, tipLabels: tips, series: [{ name: "per period", color: "var(--s1)", values: vals, display: vals.map((v) => fmtInt(v)) }], unit: "count", ariaLabel: `${r.key} per period`, height: 190, width: 1120 })}</div>`
            : "");
      } else {
        const x = metricByKey.get(r.key)!;
        const pick = (stat: "p50" | "p95" | "p99"): (number | null)[] => m.periods.map((p) => p.summaries[r.key]?.[stat] ?? null);
        const series: Series[] = (["p50", "p95", "p99"] as const).map((stat, i) => {
          const values = pick(stat);
          return { name: stat, color: `var(--s${i + 1})`, values, display: values.map((v) => (v === null ? "—" : fmtValue(v, x.unit))), dashed: stat === "p99" };
        });
        value = `p50 <b>${esc(fmtValue(x.stats.p50, x.unit))}</b> · p95 <b>${esc(fmtValue(x.stats.p95, x.unit))}</b>`;
        spark = sparkline(series, `${r.key} percentiles per period`);
        detail =
          `<div class="mx-meta"><span>n <b>${esc(fmtInt(x.stats.count))}</b></span><span>min <b>${esc(fmtValue(x.stats.min, x.unit))}</b></span><span>mean <b>${esc(fmtValue(x.stats.mean, x.unit))}</b></span><span>p99 <b>${esc(fmtValue(x.stats.p99, x.unit))}</b></span><span>max <b>${esc(fmtValue(x.stats.max, x.unit))}</b></span><span><code>${esc(r.key)}</code></span>${legend(series, "line")}</div>` +
          (m.periods.length
            ? `<div class="chart-wrap">${lineChart({ labels, tipLabels: tips, series, unit: x.unit, thresholds: thresholdsFor(m, x), ariaLabel: `${r.key} percentiles per period`, height: 190, width: 1120 })}</div>`
            : "");
      }
      return `${header}<details class="mx-row" data-key="${esc(r.key.toLowerCase())}"><summary><span class="mx-name" title="${esc(r.key)}">${esc(r.leaf)}<span class="kind">${r.kind}</span></span><span class="mx-val">${value}</span>${spark}</summary><div class="mx-body">${detail}</div></details>`;
    })
    .join("");

  const perHead = m.periods.map((p) => `<th class="num" data-sort="num">${esc(fmtOffset(p.offsetMs))}</th>`).join("");
  const tableRows = m.counters
    .map((c) => `<tr><td><code>${esc(c.key)}</code></td><td class="num" data-v="${c.total}"><b>${esc(fmtInt(c.total))}</b></td>${c.perPeriod.map((v) => `<td class="num" data-v="${v}">${esc(fmtInt(v))}</td>`).join("")}</tr>`)
    .join("");
  const rates = m.rates.length
    ? `<div class="card table-wrap" style="margin-top:16px"><table class="data"><thead><tr><th>Rate</th><th class="num">Value</th></tr></thead><tbody>${m.rates.map((r) => `<tr><td><code>${esc(r.key)}</code></td><td class="num">${esc(fmtNum(r.value, 2))}/s</td></tr>`).join("")}</tbody></table></div>`
    : "";

  return `<section class="block" id="metrics">
    <div class="block-head"><div><h2>Metrics</h2><p>Every metric recorded during the run, grouped by namespace. Sparklines show each 10-second period; open a row for the full chart.</p></div>
      <div class="mx-tools"><input class="search" type="search" placeholder="Filter metrics…" data-filter-mx="mx-list" aria-label="Filter metrics"><button class="btn" type="button" data-mx-toggle="mx-list">Expand all</button></div></div>
    <div class="card mx" id="mx-list">${body || '<div class="empty">No metrics recorded.</div>'}</div>
    <details class="card" style="margin-top:16px"><summary>Counters table <span class="badge neutral" style="margin-left:auto">${m.counters.length}</span></summary>
      <div class="table-tools" style="padding:12px 20px 0;justify-content:flex-end"><button class="btn" data-csv="counters-table" type="button">${ICONS.download}CSV</button></div>
      <div class="table-wrap"><table class="data" id="counters-table"><thead><tr><th data-sort="text">Counter</th><th class="num" data-sort="num">Total</th>${perHead}</tr></thead><tbody>${tableRows}</tbody></table></div>
    </details>
    ${rates}
  </section>`;
}

function aboutSection(m: ReportModel): string {
  const meta: [string, string][] = [
    ["Source file", m.meta.sourceFile],
    ["Source SHA-256", m.meta.sourceSha256],
    ["Source size", fmtBytes(m.meta.sourceBytes)],
    ["Test window", `${fmtDateTime(m.meta.startedAt, m.meta.timeZone)} → ${fmtDateTime(m.meta.endedAt, m.meta.timeZone)}`],
    ["Reporting periods", `${m.periods.length} × 10 s`],
    ["Engine", m.engine],
    ["Time zone", m.meta.timeZone],
    ["Report generated", fmtDateTime(m.meta.generatedAt, m.meta.timeZone)],
    ["Generator", m.meta.generator],
  ];
  const glossary: [string, string][] = [
    ["Virtual user (VU)", "One simulated user executing a scenario from start to finish."],
    ["Failure rate", "Failed VUs ÷ created VUs. A VU fails when any step in its scenario throws or an expectation is not met."],
    ["Throughput", "Requests per second. Per-period values are normalised to the measured window, so partial buckets are comparable."],
    ["Percentiles (pNN)", "NN% of samples were at or below this value. Percentiles from small samples are approximate."],
    ["TTFB / FCP / LCP", "Time to First Byte, First Contentful Paint, Largest Contentful Paint — browser timings from navigation start."],
    ["Session length", "Wall-clock time for one VU to complete its scenario."],
  ];
  return `<section class="block" id="about">
    <div class="block-head"><div><h2>About this report</h2><p>Provenance and definitions, for audit and reproducibility.</p></div></div>
    <div class="grid g2">
      <div class="card card-pad"><dl class="meta">${meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${k.includes("SHA") ? `<code>${esc(v)}</code>` : esc(v)}</dd>`).join("")}</dl></div>
      <div class="card card-pad"><div class="glossary">${glossary.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div></div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

/** JSON safe for embedding inside a <script> element. */
function scriptJson(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

export function renderReport(model: ReportModel, source: ArtilleryReport, opts: RenderOptions = {}): string {
  const title = `${model.meta.title} — ${STATUS_TEXT[model.verdict]} — load test report`;
  const sourceName = model.meta.sourceFile.split(/[\\/]/).pop() ?? "report.json";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${esc(model.meta.generator)}">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>${STYLES}</style>
</head>
<body data-source="${esc(sourceName)}">
${masthead(model, opts)}
${nav(model)}
<main><div class="wrap">
${overview(model)}
${checksSection(model)}
${findingsSection(model)}
${timelineSection(model)}
${pagesSection(model)}
${latencySection(model)}
${responsesSection(model)}
${periodsSection(model)}
${metricsSection(model)}
${aboutSection(model)}
</div></main>
<footer><div class="wrap"><span>Generated ${esc(fmtDateTime(model.meta.generatedAt, model.meta.timeZone))} by ${esc(model.meta.generator)}, an independent community plugin. Not affiliated with or endorsed by Artillery Software Inc.</span><span>Source SHA-256 <code>${esc(model.meta.sourceSha256.slice(0, 16))}…</code></span></div></footer>
${opts.embedRaw !== false ? `<script type="application/json" id="raw-report">${scriptJson(source)}</script>` : ""}
<script>${SCRIPT}</script>
</body>
</html>
`;
}
