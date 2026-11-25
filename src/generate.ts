/** Core one-call API: parse → analyse → render. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyze, assertArtilleryReport, type AnalyzeOptions } from "./analyze.js";
import { renderReport, type RenderOptions } from "./render.js";
import type { ArtilleryReport, ReportModel } from "./types.js";
const pkg: { name?: string; version?: string } = (() => {
  try {
    return JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as { name?: string; version?: string };
  } catch {
    return {};
  }
})();

/** Package name and version, read from package.json so they always match what was published. */
export const PACKAGE_NAME: string = pkg.name ?? "loadlens-html";
export const VERSION: string = pkg.version ?? "0.0.0";

export type GenerateOptions = Omit<AnalyzeOptions, "sourceText"> & RenderOptions;

export interface GenerateResult {
  html: string;
  model: ReportModel;
}

/** Analyse and render an already-parsed Artillery report object. */
export function generateReportFromObject(report: unknown, opts: GenerateOptions, sourceText?: string): GenerateResult {
  assertArtilleryReport(report);
  const text = sourceText ?? JSON.stringify(report);
  const model = analyze(report as ArtilleryReport, { ...opts, sourceText: text, generator: opts.generator ?? `${PACKAGE_NAME} ${VERSION}` });
  const html = renderReport(model, report as ArtilleryReport, opts);
  return { html, model };
}

/** Parse, analyse and render an Artillery `report.json` string in one call. */
export function generateReport(jsonText: string, opts: GenerateOptions): GenerateResult {
  return generateReportFromObject(JSON.parse(jsonText) as unknown, opts, jsonText);
}
