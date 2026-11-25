/** Metric-key classification: turns raw Artillery metric names into labelled, typed metrics. */

import type { ArtillerySummary, MetricInfo, WebVitalName } from "./types.js";

export interface VitalSpec {
  name: WebVitalName;
  title: string;
  unit: "ms" | "score";
  /** Google's published "good" upper bound (inclusive). */
  good: number;
  /** Google's published "poor" lower bound (exclusive). */
  poor: number;
  description: string;
}

/** Thresholds from web.dev (assessed at the 75th percentile). */
export const WEB_VITALS: Record<WebVitalName, VitalSpec> = {
  TTFB: {
    name: "TTFB",
    title: "Time to First Byte",
    unit: "ms",
    good: 800,
    poor: 1800,
    description: "Time from navigation start until the first byte of the document response arrives.",
  },
  FCP: {
    name: "FCP",
    title: "First Contentful Paint",
    unit: "ms",
    good: 1800,
    poor: 3000,
    description: "Time until the browser renders the first text or image.",
  },
  LCP: {
    name: "LCP",
    title: "Largest Contentful Paint",
    unit: "ms",
    good: 2500,
    poor: 4000,
    description: "Time until the largest content element in the viewport is rendered. A Core Web Vital.",
  },
  CLS: {
    name: "CLS",
    title: "Cumulative Layout Shift",
    unit: "score",
    good: 0.1,
    poor: 0.25,
    description: "Unitless score for unexpected layout movement. A Core Web Vital.",
  },
  FID: {
    name: "FID",
    title: "First Input Delay",
    unit: "ms",
    good: 100,
    poor: 300,
    description: "Delay before the browser can respond to the first interaction (superseded by INP).",
  },
  INP: {
    name: "INP",
    title: "Interaction to Next Paint",
    unit: "ms",
    good: 200,
    poor: 500,
    description: "Latency of interactions throughout the page lifetime. A Core Web Vital.",
  },
};

export const VITAL_ORDER: WebVitalName[] = ["TTFB", "FCP", "LCP", "CLS", "INP", "FID"];

export function rateVital(spec: VitalSpec, value: number): "good" | "needs-improvement" | "poor" {
  if (value <= spec.good) return "good";
  if (value <= spec.poor) return "needs-improvement";
  return "poor";
}

const VITAL_RE = /^browser\.page\.(FCP|LCP|TTFB|CLS|FID|INP)\.(.+)$/;

/** A page qualifier is a URL unless aggregateByName replaced it with the scenario name. */
// Browser-internal pages (about:blank, chrome-error://…, data:…) are URLs too, even without "//".
export const isUrl = (s: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(about|data|blob|javascript|chrome|chrome-error|edge|file):/i.test(s);
/** Only http(s) pages can belong to the site under test. */
export const isWebUrl = (s: string): boolean => /^https?:\/\//i.test(s);
const pageKind = (q: string): "url" | "name" => (isUrl(q) ? "url" : "name");

export function classifyMetric(key: string, stats: ArtillerySummary): MetricInfo {
  const vital = VITAL_RE.exec(key);
  if (vital) {
    const name = vital[1] as WebVitalName;
    const spec = WEB_VITALS[name];
    const q = vital[2] as string;
    return { key, family: "web-vital", label: `${name} · ${spec.title}`, qualifier: q, unit: spec.unit, stats, vital: name, pageKind: pageKind(q) };
  }
  if (key === "browser.page.dominteractive") {
    return { key, family: "page-load", label: "DOM interactive", qualifier: "All pages", unit: "ms", stats, pageKind: "all" };
  }
  const domi = /^browser\.page\.dominteractive\.(.+)$/.exec(key);
  if (domi) {
    const q = domi[1] as string;
    return { key, family: "page-load", label: "DOM interactive", qualifier: q, unit: "ms", stats, pageKind: pageKind(q) };
  }
  if (key === "browser.memory_used_mb") {
    return { key, family: "browser", label: "JS heap used", qualifier: "browser.memory_used_mb", unit: "mb", stats };
  }
  if (key === "http.response_time") {
    return { key, family: "http", label: "HTTP response time", unit: "ms", stats };
  }
  const rtClass = /^http\.response_time\.(\dxx)$/.exec(key);
  if (rtClass) {
    return { key, family: "http", label: "HTTP response time", qualifier: `${rtClass[1]} responses`, unit: "ms", stats };
  }
  if (key === "vusers.session_length") {
    return { key, family: "session", label: "VU session length", unit: "ms", stats };
  }
  const step = /^browser\.step\.(.+)$/.exec(key);
  if (step) {
    return { key, family: "browser-step", label: "Browser step", qualifier: step[1], unit: "ms", stats };
  }
  const endpoint = /^plugins\.metrics-by-endpoint\.response_time\.(.+)$/.exec(key);
  if (endpoint) {
    return { key, family: "endpoint", label: "Endpoint response time", qualifier: endpoint[1], unit: "ms", stats };
  }
  const ws = /^(websocket|socketio)\.response_time$/.exec(key);
  if (ws) {
    return { key, family: "http", label: `${ws[1] === "socketio" ? "Socket.IO" : "WebSocket"} response time`, unit: "ms", stats };
  }
  return { key, family: "custom", label: key, unit: "ms", stats };
}

const FAMILY_ORDER: MetricInfo["family"][] = ["http", "endpoint", "web-vital", "page-load", "browser-step", "browser", "session", "custom"];

export function sortMetrics(metrics: MetricInfo[]): MetricInfo[] {
  // Page-level metrics keep the order Artillery first recorded each page (≈ visit order).
  const firstSeen = new Map<string, number>();
  metrics.forEach((m, i) => {
    if (m.pageKind && m.qualifier && !firstSeen.has(m.qualifier)) firstSeen.set(m.qualifier, i);
  });
  return [...metrics].sort((a, b) => {
    const f = FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family);
    if (f !== 0) return f;
    if (a.pageKind && b.pageKind) {
      if (a.pageKind === "all" || b.pageKind === "all") return a.pageKind === "all" ? -1 : b.pageKind === "all" ? 1 : 0;
      const q = (firstSeen.get(a.qualifier ?? "") ?? 0) - (firstSeen.get(b.qualifier ?? "") ?? 0);
      if (q !== 0) return q;
      if (a.vital && b.vital) return VITAL_ORDER.indexOf(a.vital) - VITAL_ORDER.indexOf(b.vital);
    }
    return a.key.localeCompare(b.key);
  });
}

/** Total of all counters whose key matches a prefix + numeric suffix (status codes). */
export const STATUS_CODE_RE = /^(?:http|browser\.page)\.codes\.(\d{3})$/;

/** Glob (`*`) → anchored RegExp. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}
