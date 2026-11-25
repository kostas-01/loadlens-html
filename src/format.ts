/** Formatting and escaping helpers. Pure functions, no dependencies. */

import type { MetricUnit } from "./types.js";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape any value for safe use in HTML text or a quoted attribute. */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Tagged template that escapes interpolations unless wrapped in `raw()`. */
export class Raw {
  constructor(public readonly html: string) {}
  toString(): string {
    return this.html;
  }
}
export const raw = (html: string): Raw => new Raw(html);

export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += render(v) + (strings[i + 1] ?? "");
  });
  return out;
}

function render(v: unknown): string {
  if (v instanceof Raw) return v.html;
  if (Array.isArray(v)) return v.map(render).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
}

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function fmtInt(n: number | undefined): string {
  if (!isNum(n)) return "—";
  return Math.round(n).toLocaleString("en-GB");
}

export function fmtNum(n: number | undefined, maxDigits = 1): string {
  if (!isNum(n)) return "—";
  return n.toLocaleString("en-GB", { maximumFractionDigits: maxDigits, minimumFractionDigits: 0 });
}

export function fmtPct(n: number | undefined, digits = 1): string {
  if (!isNum(n)) return "—";
  if (n > 0 && n < 0.1 && digits <= 1) return "<0.1%";
  return `${n.toFixed(digits)}%`;
}

/** Milliseconds → adaptive human string ("75.4 ms", "3.39 s", "2m 05s"). */
export function fmtMs(ms: number | undefined): string {
  if (!isNum(ms)) return "—";
  const abs = Math.abs(ms);
  if (abs < 10) return `${ms.toFixed(2)} ms`;
  if (abs < 1000) return `${ms.toFixed(1)} ms`;
  if (abs < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(abs / 60_000);
  const s = Math.round((abs % 60_000) / 1000);
  return `${ms < 0 ? "-" : ""}${m}m ${String(s).padStart(2, "0")}s`;
}

/** Duration in a compact "1h 02m 03s" style. */
export function fmtDuration(ms: number): string {
  if (!isNum(ms) || ms < 0) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
    : `${m}m ${String(s).padStart(2, "0")}s`;
}

export function fmtValue(v: number | undefined, unit: MetricUnit | "%"): string {
  switch (unit) {
    case "ms":
      return fmtMs(v);
    case "mb":
      return isNum(v) ? `${v.toFixed(1)} MB` : "—";
    case "score":
      return isNum(v) ? v.toFixed(3) : "—";
    case "%":
      return fmtPct(v, 2);
    default:
      return fmtNum(v, 2);
  }
}

/** Short axis-tick formatting for a unit. */
export function fmtTick(v: number, unit: MetricUnit | "rps" | "%"): string {
  if (unit === "ms") {
    if (Math.abs(v) >= 1000) return `${fmtNum(v / 1000, 1)}s`;
    return `${fmtNum(v, 0)}ms`;
  }
  if (unit === "score") return v.toFixed(2);
  if (unit === "mb") return `${fmtNum(v, 1)}MB`;
  if (unit === "%") return `${fmtNum(v, 0)}%`;
  if (Math.abs(v) >= 10_000) return `${fmtNum(v / 1000, 0)}k`;
  if (Math.abs(v) >= 1000) return `${fmtNum(v / 1000, 1)}k`;
  return fmtNum(v, 1);
}

export function fmtDateTime(ts: number, timeZone: string): string {
  if (!isNum(ts)) return "—";
  const d = new Date(ts);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(d);
  return date;
}

export function fmtClock(ts: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

/** "T+20s" relative offset label. */
export function fmtOffset(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `T+${s}s`;
  const m = Math.floor(s / 60);
  return `T+${m}m${String(s % 60).padStart(2, "0")}s`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmtInt(n)} ${n === 1 ? one : many}`;
}

/** Make a stable DOM id from an arbitrary metric key. */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
