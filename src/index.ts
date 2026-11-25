/**
 * loadlens-html — public API and Artillery plugin entry point.
 *
 * As an Artillery plugin (loaded via `config.plugins.html`), Artillery picks up
 * the `Plugin` export and `LEGACY_METRICS_FORMAT` flag from this module.
 *
 * As a library:
 * @example
 * import { generateReport } from "loadlens-html";
 * const { html, model } = generateReport(jsonText, { sourceFile: "report.json" });
 */

export * from "./types.js";
export * from "./generate.js";
export { analyze, assertArtilleryReport, ReportFormatError } from "./analyze.js";
export { renderReport, type RenderOptions } from "./render.js";
export { DEFAULT_THRESHOLDS, evaluateChecks } from "./thresholds.js";
export { WEB_VITALS } from "./metrics.js";
export { Plugin, LEGACY_METRICS_FORMAT, type PluginConfig } from "./plugin.js";
