/**
 * Type definitions for the Artillery v2 `report.json` format
 * (produced by `artillery run --output report.json`), plus the
 * normalised model this generator builds from it.
 */

/* ------------------------------------------------------------------ */
/* Raw Artillery input                                                 */
/* ------------------------------------------------------------------ */

export interface ArtillerySummary {
  min: number;
  max: number;
  count: number;
  mean: number;
  p50: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
}

export interface ArtilleryMetricsBlock {
  /** Bucket start (epoch ms). Numeric in `aggregate`, string in `intermediate`. */
  period: number | string;
  counters?: Record<string, number>;
  rates?: Record<string, number>;
  summaries?: Record<string, ArtillerySummary>;
  histograms?: Record<string, ArtillerySummary>;
  firstCounterAt?: number;
  firstHistogramAt?: number;
  lastCounterAt?: number;
  lastHistogramAt?: number;
  firstMetricAt?: number;
  lastMetricAt?: number;
}

export interface ArtilleryReport {
  aggregate: ArtilleryMetricsBlock;
  intermediate?: ArtilleryMetricsBlock[];
}

/* ------------------------------------------------------------------ */
/* Thresholds / SLO configuration                                      */
/* ------------------------------------------------------------------ */

export type Stat = keyof ArtillerySummary;
export type Status = "pass" | "warn" | "fail";

export interface ThresholdRule {
  /** Human label shown in the report. Defaults to metric + stat. */
  label?: string;
  /** Metric key. `*` wildcards are allowed, e.g. `browser.page.LCP.*`. */
  metric: string;
  /**
   * `summary` (default): compare a statistic of a timing metric.
   * `counter`: compare the aggregate counter value.
   * `rate`: compare counter / `of` counter as a percentage.
   */
  type?: "summary" | "counter" | "rate";
  /** Statistic for summary rules. Default `p95`. */
  stat?: Stat;
  /** Denominator counter for `rate` rules. */
  of?: string;
  /** Value strictly above which the check is a warning. */
  warn?: number;
  /** Value strictly above which the check fails. */
  fail?: number;
}

export interface ThresholdConfig {
  /** VU failure-rate thresholds, in percent. Set to `false` to disable. */
  failureRate?: { warn?: number; fail?: number } | false;
  /** Rate Core Web Vitals at p75 against Google's published thresholds. Default true. */
  webVitals?: boolean;
  /** Default HTTP response time p95 check (ms). Set to `false` to disable. */
  httpResponseTime?: { stat?: Stat; warn?: number; fail?: number } | false;
  /** Fail when any 5xx response is recorded. Default true. */
  fail5xx?: boolean;
  /** Additional custom rules. */
  checks?: ThresholdRule[];
}

/* ------------------------------------------------------------------ */
/* Normalised model                                                    */
/* ------------------------------------------------------------------ */

export type MetricUnit = "ms" | "score" | "count" | "mb";

export type WebVitalName = "FCP" | "LCP" | "TTFB" | "CLS" | "FID" | "INP";

export interface MetricInfo {
  key: string;
  /** Grouping used for presentation. */
  family: "http" | "web-vital" | "page-load" | "browser-step" | "browser" | "session" | "endpoint" | "custom";
  label: string;
  /** Secondary qualifier (URL, endpoint, status class…). */
  qualifier?: string;
  unit: MetricUnit;
  stats: ArtillerySummary;
  vital?: WebVitalName;
  /** For page-level metrics: whether the qualifier is a page URL, a scenario name (aggregateByName) or all pages. */
  pageKind?: "url" | "name" | "all";
}

/** One page (or scenario, with aggregateByName) with its page-level metrics. */
export interface PageModel {
  /** Metric qualifier exactly as Artillery reported it. */
  id: string;
  kind: "url" | "name";
  /** Display label: path for first-party URLs, full URL for other hosts, scenario name for aggregateByName. */
  label: string;
  url?: string;
  host?: string;
  /** Same host as the test target (or the dominant host when no target is known). */
  firstParty: boolean;
  /** Navigations: domcontentloaded count (extendedMetrics) or the largest Web Vitals sample count. */
  views: number;
  vitals: Partial<Record<WebVitalName, ArtillerySummary>>;
  domInteractive?: ArtillerySummary;
  /** Has LCP but no TTFB/FCP: typical of a client-side (SPA) route change. */
  clientSideRoute: boolean;
}

export interface PeriodModel {
  index: number;
  /** Bucket start, epoch ms. */
  ts: number;
  /** Measured activity window within the bucket, ms. */
  windowMs: number;
  /** Offset of bucket start from test start, ms. */
  offsetMs: number;
  counters: Record<string, number>;
  summaries: Record<string, ArtillerySummary>;
  vusersCreated: number;
  vusersCompleted: number;
  vusersFailed: number;
  requests: number;
  rps: number;
  errors: number;
}

export interface CheckResult {
  id: string;
  label: string;
  category: "Reliability" | "Latency" | "Web Vitals" | "Errors" | "Custom";
  metric: string;
  stat?: string;
  value: number;
  unit: MetricUnit | "%";
  warn?: number;
  fail?: number;
  status: Status;
  source: "default" | "config";
  note?: string;
}

export interface Finding {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

export interface StatusCodeRow {
  code: string;
  cls: "1xx" | "2xx" | "3xx" | "4xx" | "5xx" | "other";
  count: number;
  share: number;
}

export interface ReportModel {
  meta: {
    title: string;
    sourceFile: string;
    sourceSha256: string;
    sourceBytes: number;
    generatedAt: number;
    startedAt: number;
    endedAt: number;
    durationMs: number;
    timeZone: string;
    generator: string;
    /** True when the run stopped before Artillery emitted final metrics. */
    partial: boolean;
  };
  engine: "http" | "playwright" | "mixed" | "unknown";
  targets: string[];
  vusers: {
    created: number;
    completed: number;
    failed: number;
    skipped: number;
    failureRate: number;
    completionRate: number;
    sessionLength?: ArtillerySummary;
  };
  scenarios: { name: string; created: number; share: number }[];
  requests: {
    total: number;
    meanRps: number;
    peakRps: number;
    responses: number;
    codes: StatusCodeRow[];
  };
  errors: { name: string; count: number; share: number }[];
  metrics: MetricInfo[];
  /** Pages in the order Artillery first recorded them (≈ visit order). */
  pages: PageModel[];
  /** How page-level metrics are keyed: by URL (default), by scenario name (aggregateByName), or absent. */
  pageMetricsBy: "url" | "name" | "none";
  primaryHost?: string;
  periods: PeriodModel[];
  counters: { key: string; total: number; perPeriod: number[] }[];
  rates: { key: string; value: number }[];
  checks: CheckResult[];
  verdict: Status;
  findings: Finding[];
}
