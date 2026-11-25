/** SLO / threshold evaluation. */

import { WEB_VITALS, globToRegExp, rateVital } from "./metrics.js";
import type { CheckResult, ReportModel, Stat, Status, ThresholdConfig, ThresholdRule } from "./types.js";

export const DEFAULT_THRESHOLDS: Required<Omit<ThresholdConfig, "checks">> = {
  failureRate: { warn: 0, fail: 1 },
  webVitals: true,
  httpResponseTime: { stat: "p95", warn: 500, fail: 1000 },
  fail5xx: true,
};

const RANK: Record<Status, number> = { pass: 0, warn: 1, fail: 2 };

export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>((w, s) => (RANK[s] > RANK[w] ? s : w), "pass");
}

function judge(value: number, warn?: number, fail?: number): Status {
  if (fail !== undefined && value > fail) return "fail";
  if (warn !== undefined && value > warn) return "warn";
  return "pass";
}

const STAT_LABEL: Partial<Record<Stat, string>> = { p999: "p99.9", median: "median" };
const statLabel = (s: Stat): string => STAT_LABEL[s] ?? s;

export function evaluateChecks(model: ReportModel, config: ThresholdConfig): CheckResult[] {
  const cfg = { ...DEFAULT_THRESHOLDS, ...config };
  const out: CheckResult[] = [];

  if (cfg.failureRate !== false && model.vusers.created > 0) {
    const { warn, fail } = { ...DEFAULT_THRESHOLDS.failureRate, ...cfg.failureRate };
    out.push({
      id: "vu-failure-rate",
      label: "Virtual user failure rate",
      category: "Reliability",
      metric: "vusers.failed / vusers.created",
      value: model.vusers.failureRate,
      unit: "%",
      warn,
      fail,
      status: judge(model.vusers.failureRate, warn, fail),
      source: config.failureRate ? "config" : "default",
    });
  }

  if (cfg.fail5xx && model.requests.codes.length > 0) {
    const n = model.requests.codes.filter((c) => c.cls === "5xx").reduce((a, c) => a + c.count, 0);
    out.push({
      id: "http-5xx",
      label: "Server errors (5xx)",
      category: "Errors",
      metric: "*.codes.5xx",
      value: n,
      unit: "count",
      fail: 0,
      status: n > 0 ? "fail" : "pass",
      source: "default",
    });
  }

  if (cfg.httpResponseTime !== false) {
    const rt = model.metrics.find((m) => m.key === "http.response_time");
    if (rt) {
      const { stat = "p95", warn, fail } = { ...DEFAULT_THRESHOLDS.httpResponseTime, ...cfg.httpResponseTime };
      const value = rt.stats[stat];
      out.push({
        id: "http-response-time",
        label: `HTTP response time ${statLabel(stat)}`,
        category: "Latency",
        metric: rt.key,
        stat: statLabel(stat),
        value,
        unit: "ms",
        warn,
        fail,
        status: judge(value, warn, fail),
        source: config.httpResponseTime ? "config" : "default",
      });
    }
  }

  if (cfg.webVitals) {
    for (const m of model.metrics) {
      if (!m.vital) continue;
      const page = model.pages.find((p) => p.id === m.qualifier);
      // Third-party pages (showAllPageMetrics) aren't yours to fix; keep them out of the verdict.
      if (page && !page.firstParty) continue;
      const spec = WEB_VITALS[m.vital];
      const value = m.stats.p75;
      const rating = rateVital(spec, value);
      out.push({
        id: `vital-${m.key}`,
        label: `${m.vital} p75 — ${spec.title}`,
        category: "Web Vitals",
        metric: m.key,
        stat: "p75",
        value,
        unit: spec.unit,
        warn: spec.good,
        fail: spec.poor,
        status: rating === "good" ? "pass" : rating === "poor" ? "fail" : "warn",
        source: "default",
        note: page ? `${page.kind === "name" ? "Scenario" : "Page"}: ${page.label}${page.clientSideRoute ? " (client-side route; LCP may belong to the previous page)" : ""}` : m.qualifier,
      });
    }
  }

  for (const [i, rule] of (config.checks ?? []).entries()) out.push(...evaluateRule(model, rule, i));
  return out;
}

function evaluateRule(model: ReportModel, rule: ThresholdRule, index: number): CheckResult[] {
  const re = globToRegExp(rule.metric);
  const type = rule.type ?? "summary";
  const base = { category: "Custom" as const, source: "config" as const, warn: rule.warn, fail: rule.fail };

  if (type === "counter" || type === "rate") {
    const matching = model.counters.filter((c) => re.test(c.key));
    let value = matching.reduce((a, c) => a + c.total, 0);
    let unit: CheckResult["unit"] = "count";
    if (type === "rate") {
      const denom = model.counters.find((c) => c.key === rule.of)?.total ?? 0;
      value = denom ? (value / denom) * 100 : 0;
      unit = "%";
    }
    return [
      {
        ...base,
        id: `rule-${index}`,
        label: rule.label ?? (type === "rate" ? `${rule.metric} / ${rule.of}` : rule.metric),
        metric: rule.metric,
        value,
        unit,
        status: judge(value, rule.warn, rule.fail),
        note: matching.length === 0 ? "No matching counters — treated as 0" : undefined,
      },
    ];
  }

  const stat: Stat = rule.stat ?? "p95";
  const matches = model.metrics.filter((m) => re.test(m.key));
  if (matches.length === 0) {
    return [
      {
        ...base,
        id: `rule-${index}`,
        label: rule.label ?? `${rule.metric} ${statLabel(stat)}`,
        metric: rule.metric,
        stat: statLabel(stat),
        value: NaN,
        unit: "ms",
        status: "warn",
        note: "Metric not found in report",
      },
    ];
  }
  return matches.map((m, j) => ({
    ...base,
    id: `rule-${index}-${j}`,
    label: rule.label ?? `${m.label} ${statLabel(stat)}`,
    metric: m.key,
    stat: statLabel(stat),
    value: m.stats[stat],
    unit: m.unit,
    status: judge(m.stats[stat], rule.warn, rule.fail),
    note: m.qualifier,
  }));
}
