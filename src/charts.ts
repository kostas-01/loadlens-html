/**
 * Dependency-free SVG chart renderers. Charts are rendered server-side so the
 * report works offline, prints correctly and needs no JS to display; a small
 * client script adds tooltips and crosshairs on top via data attributes.
 */

import { esc, fmtTick } from "./format.js";
import type { MetricUnit } from "./types.js";

export type AxisUnit = MetricUnit | "rps" | "%";

export interface Series {
  name: string;
  /** CSS colour expression, e.g. `var(--s1)`. */
  color: string;
  values: (number | null)[];
  /** Pre-formatted values for tooltips (falls back to tick format). */
  display?: string[];
  /** Render as a dashed stroke (reveals overlapping series beneath). */
  dashed?: boolean;
}

interface Frame {
  w: number;
  h: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const FRAME: Frame = { w: 640, h: 230, top: 14, right: 14, bottom: 34, left: 54 };

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/** "Nice" linear scale from 0 (or below) up to a rounded maximum. */
export function niceScale(maxValue: number, minValue = 0, tickCount = 5): Scale {
  let lo = Math.min(0, minValue);
  let hi = maxValue;
  if (!Number.isFinite(hi) || hi <= lo) hi = lo + 1;
  const rough = (hi - lo) / tickCount;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min: lo, max: hi, ticks };
}

function yAxis(f: Frame, scale: Scale, unit: AxisUnit): string {
  const plotH = f.h - f.top - f.bottom;
  return scale.ticks
    .map((t) => {
      const y = f.top + plotH - ((t - scale.min) / (scale.max - scale.min)) * plotH;
      const base = t === scale.min;
      return `<line class="${base ? "axis" : "grid"}" x1="${f.left}" x2="${f.w - f.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>` +
        `<text class="tick" x="${f.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc(fmtTick(t, unit))}</text>`;
    })
    .join("");
}

/** Pick an index stride so that at most `max` x-labels are drawn. */
const labelStride = (n: number, max = 8): number => Math.max(1, Math.ceil(n / max));

function tipAttr(title: string, rows: { c: string; n: string; v: string }[]): string {
  return `data-tip="${esc(JSON.stringify({ t: title, r: rows }))}"`;
}

export interface Threshold {
  value: number;
  label: string;
  status: "warn" | "fail";
}

export interface LineChartOptions {
  labels: string[];
  tipLabels?: string[];
  series: Series[];
  unit: AxisUnit;
  thresholds?: Threshold[];
  ariaLabel: string;
  height?: number;
  /** viewBox width; use ~1100 for full-width placements so text keeps its size. */
  width?: number;
}

export function lineChart(o: LineChartOptions): string {
  const f: Frame = { ...FRAME, h: o.height ?? FRAME.h, w: o.width ?? FRAME.w };
  const n = o.labels.length;
  const plotW = f.w - f.left - f.right;
  const plotH = f.h - f.top - f.bottom;
  const dataMax = Math.max(0, ...o.series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  // Only include thresholds in the domain when they are close enough not to flatten the data.
  const visibleThresholds = (o.thresholds ?? []).filter((t) => t.value <= Math.max(dataMax * 1.6, 1e-9));
  const scale = niceScale(Math.max(dataMax, ...visibleThresholds.map((t) => t.value)) * 1.05 || 1);
  const x = (i: number): number => (n <= 1 ? f.left + plotW / 2 : f.left + (i * plotW) / (n - 1));
  const y = (v: number): number => f.top + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;

  const stride = labelStride(n);
  const xLabels = o.labels
    .map((l, i) => (i % stride === 0 || i === n - 1 ? `<text class="tick" x="${x(i).toFixed(1)}" y="${f.h - f.bottom + 18}" text-anchor="middle">${esc(l)}</text>` : ""))
    .join("");

  const thresholdMarks = visibleThresholds
    .map((t) => {
      const yy = y(t.value).toFixed(1);
      return `<g class="threshold ${t.status}"><line x1="${f.left}" x2="${f.w - f.right}" y1="${yy}" y2="${yy}"/>` +
        `<text x="${f.w - f.right - 4}" y="${(Number(yy) - 5).toFixed(1)}" text-anchor="end">${esc(t.label)}</text></g>`;
    })
    .join("");

  const lines = o.series
    .map((s) => {
      let d = "";
      let pen = false;
      s.values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      const markers = s.values
        .map((v, i) => (v === null || !Number.isFinite(v) ? "" : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4"/>`))
        .join("");
      return `<g class="series${s.dashed ? " dashed" : ""}" style="--c:${s.color}"><path d="${d}"/>${n <= 40 ? markers : ""}</g>`;
    })
    .join("");

  const colW = n <= 1 ? plotW : plotW / (n - 1);
  const hits = o.labels
    .map((label, i) => {
      const rows = o.series.map((s) => ({ c: s.color, n: s.name, v: s.display?.[i] ?? (s.values[i] === null ? "—" : fmtTick(s.values[i] as number, o.unit)) }));
      const left = Math.max(f.left, x(i) - colW / 2);
      const right = Math.min(f.w - f.right, x(i) + colW / 2);
      return `<rect class="hit" x="${left.toFixed(1)}" y="${f.top}" width="${(right - left).toFixed(1)}" height="${plotH}" data-gx="${x(i).toFixed(1)}" tabindex="0" ${tipAttr(o.tipLabels?.[i] ?? label, rows)}/>`;
    })
    .join("");

  return `<svg class="chart" viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="${esc(o.ariaLabel)}" preserveAspectRatio="xMidYMid meet">` +
    yAxis(f, scale, o.unit) + xLabels + thresholdMarks +
    `<line class="guide" x1="0" x2="0" y1="${f.top}" y2="${f.top + plotH}"/>` +
    lines + hits + `</svg>`;
}

export interface BarChartOptions {
  labels: string[];
  tipLabels?: string[];
  series: Series[];
  unit: AxisUnit;
  ariaLabel: string;
  height?: number;
}

/** Grouped vertical bar chart (one or more series per category). */
export function barChart(o: BarChartOptions): string {
  const f: Frame = { ...FRAME, h: o.height ?? FRAME.h };
  const n = o.labels.length;
  const k = o.series.length;
  const plotW = f.w - f.left - f.right;
  const plotH = f.h - f.top - f.bottom;
  const dataMax = Math.max(0, ...o.series.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const scale = niceScale(dataMax * 1.05 || 1);
  const band = plotW / Math.max(1, n);
  const groupW = Math.min(band * 0.72, 34 * k);
  const gap = 2;
  const barW = Math.max(2, (groupW - gap * (k - 1)) / k);
  const y = (v: number): number => f.top + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;
  const baseY = y(0);
  const r = Math.min(4, barW / 2);

  const stride = labelStride(n);
  const xLabels = o.labels
    .map((l, i) => (i % stride === 0 || i === n - 1 ? `<text class="tick" x="${(f.left + band * (i + 0.5)).toFixed(1)}" y="${f.h - f.bottom + 18}" text-anchor="middle">${esc(l)}</text>` : ""))
    .join("");

  const bars = o.labels
    .map((label, i) => {
      const gx = f.left + band * (i + 0.5) - groupW / 2;
      return o.series
        .map((s, j) => {
          const v = s.values[i];
          if (v === null || v === undefined) return "";
          const bx = gx + j * (barW + gap);
          const top = y(v);
          const h = Math.max(0, baseY - top);
          const tip = tipAttr(o.tipLabels?.[i] ?? label, [{ c: s.color, n: s.name, v: s.display?.[i] ?? fmtTick(v, o.unit) }]);
          // Rounded data-end, square baseline.
          const rr = Math.min(r, h);
          const path = h <= 0.5
            ? ""
            : `M${bx.toFixed(1)},${baseY.toFixed(1)}V${(top + rr).toFixed(1)}Q${bx.toFixed(1)},${top.toFixed(1)} ${(bx + rr).toFixed(1)},${top.toFixed(1)}H${(bx + barW - rr).toFixed(1)}Q${(bx + barW).toFixed(1)},${top.toFixed(1)} ${(bx + barW).toFixed(1)},${(top + rr).toFixed(1)}V${baseY.toFixed(1)}Z`;
          // Hit target taller/wider than the painted mark.
          return `<g class="bar" style="--c:${s.color}" tabindex="0" ${tip}><rect class="hit" x="${(bx - gap / 2).toFixed(1)}" y="${f.top}" width="${(barW + gap).toFixed(1)}" height="${plotH}"/>${path ? `<path d="${path}"/>` : ""}</g>`;
        })
        .join("");
    })
    .join("");

  return `<svg class="chart" viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="${esc(o.ariaLabel)}" preserveAspectRatio="xMidYMid meet">` +
    yAxis(f, scale, o.unit) + xLabels + bars + `</svg>`;
}

/** HTML legend. `kind` mirrors the mark: line for line charts, rect for bars. */
export function legend(series: { name: string; color: string }[], kind: "line" | "rect"): string {
  if (series.length < 2) return "";
  return `<ul class="legend">${series
    .map((s) => `<li><span class="key ${kind}" style="--c:${s.color}"></span>${esc(s.name)}</li>`)
    .join("")}</ul>`;
}

/**
 * Compact sparkline for metric lists: no axes, no labels. Every series shares
 * one y-scale from zero, so shapes are comparable within a row.
 */
export function sparkline(series: { color: string; values: (number | null)[] }[], ariaLabel: string, w = 120, h = 28): string {
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  const n = Math.max(0, ...series.map((s) => s.values.length));
  if (n === 0 || all.length === 0) return `<span class="spark-empty" aria-label="${esc(ariaLabel)}">—</span>`;
  const max = Math.max(...all) || 1;
  const pad = 3;
  const x = (i: number): number => (n <= 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (v: number): number => h - pad - (v / max) * (h - pad * 2);
  const paths = series
    .map((s) => {
      let d = "";
      let pen = false;
      s.values.forEach((v, i) => {
        if (v === null || !Number.isFinite(v)) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      const lastIdx = s.values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop();
      const last = lastIdx !== undefined ? s.values[lastIdx] : null;
      const dot = lastIdx !== undefined && last !== null && last !== undefined ? `<circle cx="${x(lastIdx).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2"/>` : "";
      // A single point would be an invisible path; the end dot carries it.
      return `<g style="--c:${s.color}"><path d="${d}"/>${dot}</g>`;
    })
    .join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(ariaLabel)}">${paths}</svg>`;
}
