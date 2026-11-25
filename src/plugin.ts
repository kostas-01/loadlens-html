/**
 * Artillery plugin. Enable it in a test script with:
 *
 *   config:
 *     plugins:
 *       html:
 *         scope: "loadlens-"   # Artillery loads scope + key = "loadlens-html"
 *
 * Artillery loads plugins in the main process and in every worker thread.
 * This plugin only does work in the main process, where it receives the
 * merged metrics for each reporting period (`stats`) and the final
 * aggregate (`done`). The report is written in `cleanup()`, which Artillery
 * calls before exiting. A plugin can still change the exit code there.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, resolve } from "node:path";
import type { EventEmitter } from "node:events";
import { generateReportFromObject, PACKAGE_NAME } from "./generate.js";
import type { ArtilleryMetricsBlock, ArtilleryReport, ArtillerySummary, Status, ThresholdConfig } from "./types.js";

/** Ask Artillery for metrics in the same shape as `report.json`. */
export const LEGACY_METRICS_FORMAT = false;

export interface PluginConfig {
  /**
   * Output file, relative to the current working directory.
   * Placeholders: `{timestamp}` (YYYYMMDD-HHmmss), `{date}` (YYYY-MM-DD), `{name}` (script file name).
   * Default: next to `--output` if given (same name, `.html`), else `artillery-report-{timestamp}.html`.
   */
  output?: string;
  title?: string;
  description?: string;
  labels?: Record<string, string>;
  /** Inline threshold config, or a path to a JSON file (relative to the test script, then the cwd). */
  thresholds?: ThresholdConfig | string;
  /** IANA time zone for timestamps. Default `UTC`. */
  timeZone?: string;
  /** Embed the raw metrics JSON in the report. Default true. */
  embedRaw?: boolean;
  /** Make `artillery run` exit with code 1 when the verdict reaches this level. Default `never`. */
  failOn?: "never" | "warn" | "fail";
  /** Also write the analysed summary (verdict, checks, findings) as JSON to this path. */
  summaryJson?: string;
  /** Suppress the console line printed after the report is written. */
  quiet?: boolean;
}

interface ArtilleryGlobal {
  log?: (msg: unknown, level?: string) => void;
  suggestedExitCode?: number;
  testInfo?: {
    flags?: { output?: string };
    metadata?: { testConfig?: { scriptPath?: string } };
  };
}

interface TestScript {
  config?: { plugins?: Record<string, unknown>; pluginsScope?: string; target?: string };
  _scriptPath?: string;
}

type RawStats = Partial<ArtilleryMetricsBlock> & { summaries?: Record<string, ArtillerySummary> };

const artilleryGlobal = (): ArtilleryGlobal | undefined => (globalThis as { artillery?: ArtilleryGlobal }).artillery;

function log(msg: string, level: "info" | "warn" | "error" = "info"): void {
  const g = artilleryGlobal();
  // artillery.log is variadic (console-style): pass the message only.
  if (g?.log) g.log(msg);
  else (level === "info" ? console.log : console.error)(msg);
}

/** Copy only plain-JSON fields; Artillery's raw histogram objects are not serialisable. */
function snapshot(stats: RawStats): ArtilleryMetricsBlock {
  const summaries = JSON.parse(JSON.stringify(stats.summaries ?? {})) as Record<string, ArtillerySummary>;
  const block: ArtilleryMetricsBlock = {
    period: stats.period ?? Date.now(),
    counters: { ...(stats.counters ?? {}) },
    rates: { ...(stats.rates ?? {}) },
    summaries,
    histograms: summaries,
  };
  for (const k of ["firstCounterAt", "firstHistogramAt", "lastCounterAt", "lastHistogramAt", "firstMetricAt", "lastMetricAt"] as const) {
    if (typeof stats[k] === "number") block[k] = stats[k];
  }
  return block;
}

/** Best-effort aggregate when the run stopped before `done` (e.g. Ctrl-C). Summaries cannot be merged exactly, so they are omitted. */
function synthesiseAggregate(periods: ArtilleryMetricsBlock[]): ArtilleryMetricsBlock {
  const counters: Record<string, number> = {};
  for (const p of periods) for (const [k, v] of Object.entries(p.counters ?? {})) counters[k] = (counters[k] ?? 0) + v;
  const firsts = periods.map((p) => p.firstMetricAt).filter((v): v is number => typeof v === "number");
  const lasts = periods.map((p) => p.lastMetricAt).filter((v): v is number => typeof v === "number");
  return {
    period: periods[0]?.period ?? Date.now(),
    counters,
    rates: {},
    summaries: {},
    histograms: {},
    firstMetricAt: firsts.length ? Math.min(...firsts) : undefined,
    lastMetricAt: lasts.length ? Math.max(...lasts) : undefined,
  };
}

/**
 * Find this plugin's entry in `config.plugins`. Artillery loads the module
 * `(scope ?? config.pluginsScope ?? "artillery-plugin-") + key`, so the entry
 * whose resolved name is this package is ours, e.g. `html: { scope: "loadlens-" }`.
 * Falls back to an `html` key (for example when loaded from a local path).
 */
export function findOwnConfig(script: TestScript): PluginConfig {
  const plugins = script?.config?.plugins ?? {};
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const globalScope = typeof script?.config?.pluginsScope === "string" ? script.config.pluginsScope : undefined;
  let fallback: PluginConfig | undefined;
  for (const [key, value] of Object.entries(plugins)) {
    const cfg = isObj(value) ? value : {};
    const scope = typeof cfg.scope === "string" && cfg.scope ? cfg.scope : globalScope || "artillery-plugin-";
    if (scope + key === PACKAGE_NAME || key === PACKAGE_NAME) {
      const { scope: _s, ...rest } = cfg;
      return rest as PluginConfig;
    }
    if (key === "html" && !fallback) {
      const { scope: _s, ...rest } = cfg;
      fallback = rest as PluginConfig;
    }
  }
  return fallback ?? {};
}

function stamp(d = new Date()): { timestamp: string; date: string } {
  const p = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return { date, timestamp: `${date.replace(/-/g, "")}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}` };
}

export class Plugin {
  private readonly enabled: boolean;
  private readonly config: PluginConfig = {};
  private readonly scriptPath?: string;
  private readonly target?: string;
  private readonly intermediate: ArtilleryMetricsBlock[] = [];
  private aggregate?: ArtilleryMetricsBlock;
  private written = false;

  constructor(script: TestScript, events: EventEmitter) {
    // Worker threads set LOCAL_WORKER_ID; only the main process sees merged metrics.
    this.enabled = typeof process.env.LOCAL_WORKER_ID === "undefined";
    if (!this.enabled) return;

    this.config = findOwnConfig(script);
    this.scriptPath = script?._scriptPath;
    this.target = typeof script?.config?.target === "string" ? script.config.target : undefined;

    events.on("stats", (stats: RawStats) => {
      try {
        this.intermediate.push(snapshot(stats));
      } catch (err) {
        log(`[${PACKAGE_NAME}] could not record period metrics: ${String(err)}`, "warn");
      }
    });
    events.on("done", (stats: RawStats) => {
      try {
        this.aggregate = snapshot(stats);
      } catch (err) {
        log(`[${PACKAGE_NAME}] could not record final metrics: ${String(err)}`, "warn");
      }
    });
  }

  cleanup(done: (err?: Error) => void): void {
    if (this.enabled && !this.written) {
      this.written = true;
      try {
        this.writeReport();
      } catch (err) {
        log(`[${PACKAGE_NAME}] failed to write HTML report: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }
    done();
  }

  private resolveScriptPath(): string | undefined {
    return artilleryGlobal()?.testInfo?.metadata?.testConfig?.scriptPath ?? this.scriptPath;
  }

  private resolveOutput(): string {
    const scriptPath = this.resolveScriptPath();
    const name = scriptPath ? basename(scriptPath, extname(scriptPath)) : "artillery";
    const { timestamp, date } = stamp();
    let template = this.config.output;
    if (!template) {
      const jsonOut = artilleryGlobal()?.testInfo?.flags?.output;
      template = jsonOut ? jsonOut.replace(/\.json$/i, "") + ".html" : "artillery-report-{timestamp}.html";
    }
    return resolve(template.replace(/\{timestamp\}/g, timestamp).replace(/\{date\}/g, date).replace(/\{name\}/g, name));
  }

  private loadThresholds(): ThresholdConfig | undefined {
    const t = this.config.thresholds;
    if (!t) return undefined;
    if (typeof t === "object") return t;
    const scriptDir = this.resolveScriptPath() ? dirname(resolve(this.resolveScriptPath() as string)) : process.cwd();
    const candidates = isAbsolute(t) ? [t] : [resolve(scriptDir, t), resolve(t)];
    const file = candidates.find((c) => existsSync(c));
    if (!file) throw new Error(`thresholds file not found: ${t}`);
    return JSON.parse(readFileSync(file, "utf8")) as ThresholdConfig;
  }

  private writeReport(): void {
    if (!this.aggregate && this.intermediate.length === 0) {
      log(`[${PACKAGE_NAME}] no metrics were recorded; skipping HTML report`, "warn");
      return;
    }
    const partial = !this.aggregate;
    const intermediate = [...this.intermediate].sort((a, b) => Number(a.period) - Number(b.period));
    const report: ArtilleryReport = { aggregate: this.aggregate ?? synthesiseAggregate(intermediate), intermediate };

    const scriptPath = this.resolveScriptPath();
    const output = this.resolveOutput();
    const { html, model } = generateReportFromObject(report, {
      sourceFile: scriptPath ? `${basename(scriptPath)} (live run)` : "live run",
      title: this.config.title,
      defaultTitle: scriptPath ? basename(scriptPath, extname(scriptPath)) : undefined,
      description: this.config.description,
      labels: this.config.labels,
      thresholds: this.loadThresholds(),
      timeZone: this.config.timeZone,
      embedRaw: this.config.embedRaw,
      partial,
      targets: this.target ? [this.target] : undefined,
    });

    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, html, "utf8");
    if (this.config.summaryJson) {
      const { periods: _p, counters: _c, ...summary } = model;
      const summaryPath = resolve(this.config.summaryJson);
      mkdirSync(dirname(summaryPath), { recursive: true });
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
    }

    if (!this.config.quiet) log(`HTML report (${model.verdict.toUpperCase()}): ${output}`);

    const rank: Record<Status, number> = { pass: 0, warn: 1, fail: 2 };
    const failOn = this.config.failOn ?? "never";
    const threshold = failOn === "warn" ? 1 : failOn === "fail" ? 2 : Infinity;
    if (rank[model.verdict] >= threshold) {
      const g = artilleryGlobal();
      if (g && !g.suggestedExitCode) g.suggestedExitCode = 1;
      log(`[${PACKAGE_NAME}] verdict ${model.verdict.toUpperCase()} reached failOn=${failOn}; exit code set to 1`, "warn");
    }
  }
}
