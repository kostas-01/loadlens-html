/** Inline stylesheet and client script embedded in every report. */

export const STYLES: string = /* css */ `
:root {
  color-scheme: light;
  --bg: #f5f6f8;
  --surface: #ffffff;
  --surface-2: #f3f4f6;
  --surface-3: #e9ebee;
  --border: #e2e5e9;
  --border-strong: #cfd4da;
  --text: #191919;
  --text-2: #595f66;
  --text-3: #80868d;
  --link: #1b64be;
  --s1: #257de0; --s2: #f47230; --s3: #00b894;
  --good: #0aac23; --warn: #fbb315; --serious: #f18a59; --crit: #dc3c3d; --info: #257de0;
  --good-ink: #006c10; --warn-ink: #8a5a00; --crit-ink: #b42526; --info-ink: #1b64be;
  --grid: #eceef1;
  --axis: #c4c9cf;
  --shadow: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
  --radius: 10px;
  --font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --bg: #111213; --surface: #191919; --surface-2: #202122; --surface-3: #2a2b2d;
    --border: #2e3033; --border-strong: #3b3e42;
    --text: #efefef; --text-2: #a9adb2; --text-3: #82868b; --link: #6aabf1;
    --s1: #338ced; --s2: #e76624; --s3: #00a888;
    --good-ink: #4fd162; --warn-ink: #fbc54a; --crit-ink: #f07a7b; --info-ink: #6aabf1;
    --grid: #262729; --axis: #45484c;
    --shadow: none;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111213; --surface: #191919; --surface-2: #202122; --surface-3: #2a2b2d;
  --border: #2e3033; --border-strong: #3b3e42;
  --text: #efefef; --text-2: #a9adb2; --text-3: #82868b; --link: #6aabf1;
  --s1: #338ced; --s2: #e76624; --s3: #00a888;
  --good-ink: #4fd162; --warn-ink: #fbc54a; --crit-ink: #f07a7b; --info-ink: #6aabf1;
  --grid: #262729; --axis: #45484c;
  --shadow: none;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-padding-top: 64px; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 var(--font); font-feature-settings: "tnum" 1, "cv11" 1; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
code, .mono { font-family: var(--mono); font-size: .92em; }
h1, h2, h3, h4 { margin: 0; letter-spacing: -.01em; }
.wrap { max-width: 1280px; margin: 0 auto; padding: 0 28px; }

/* ---------- Header ---------- */
.masthead { background: var(--surface); border-bottom: 1px solid var(--border); }
.masthead .wrap { padding-top: 28px; padding-bottom: 24px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
.eyebrow { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); display: flex; gap: 10px; align-items: center; }
.eyebrow .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text-3); }
.masthead h1 { font-size: 26px; font-weight: 650; margin: 6px 0 10px; line-height: 1.2; }
.meta-row { display: flex; flex-wrap: wrap; gap: 8px 22px; color: var(--text-2); font-size: 13px; }
.meta-row b { color: var(--text); font-weight: 550; }
.verdict { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.verdict-pill { display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px 10px 12px; border-radius: 999px; font-weight: 700; font-size: 15px; letter-spacing: .04em; border: 1px solid; }
.verdict-pill svg { width: 22px; height: 22px; }
.verdict-pill.pass { color: var(--good-ink); border-color: color-mix(in srgb, var(--good) 40%, transparent); background: color-mix(in srgb, var(--good) 10%, var(--surface)); }
.verdict-pill.warn { color: var(--warn-ink); border-color: color-mix(in srgb, var(--warn) 55%, transparent); background: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
.verdict-pill.fail { color: var(--crit-ink); border-color: color-mix(in srgb, var(--crit) 45%, transparent); background: color-mix(in srgb, var(--crit) 10%, var(--surface)); }
.verdict small { color: var(--text-2); font-size: 12.5px; }
.toolbar { display: flex; gap: 6px; }
.btn { appearance: none; font: inherit; font-size: 12.5px; font-weight: 550; color: var(--text); background: var(--surface); border: 1px solid var(--border-strong); border-radius: 7px; padding: 6px 11px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.btn:hover { background: var(--surface-2); }
.btn:focus-visible, [tabindex]:focus-visible, summary:focus-visible, input:focus-visible { outline: 2px solid var(--s1); outline-offset: 2px; }
.btn svg { width: 14px; height: 14px; }

/* ---------- Nav ---------- */
.nav { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--border); }
.nav .wrap { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
.nav a { color: var(--text-2); font-weight: 550; font-size: 13px; padding: 12px 12px; white-space: nowrap; border-bottom: 2px solid transparent; }
.nav a:hover { color: var(--text); text-decoration: none; }
.nav a.active { color: var(--text); border-bottom-color: var(--s1); }

/* ---------- Sections / cards ---------- */
main { padding: 28px 0 56px; }
section.block { margin-top: 36px; }
section.block:first-child { margin-top: 0; }
.block-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.block-head h2 { font-size: 18px; font-weight: 650; }
.block-head p { margin: 2px 0 0; color: var(--text-2); font-size: 13px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
.card-pad { padding: 18px 20px; }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 16px 20px 0; }
.card-head h3 { font-size: 14px; font-weight: 650; }
.card-head .sub { color: var(--text-2); font-size: 12.5px; margin-top: 2px; }
.card-body { padding: 12px 20px 18px; }
.grid { display: grid; gap: 16px; }
.g2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.g3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.g4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 1080px) { .g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .g3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .g2, .g3, .g4 { grid-template-columns: 1fr; } .masthead .wrap { grid-template-columns: 1fr; } .verdict { align-items: flex-start; } .wrap { padding: 0 16px; } }

/* ---------- Executive summary ---------- */
.summary-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 2fr); gap: 16px; }
@media (max-width: 1080px) { .summary-grid { grid-template-columns: 1fr; } }
.narrative { font-size: 14.5px; line-height: 1.65; color: var(--text); }
.narrative p { margin: 0 0 10px; }
.narrative p:last-child { margin-bottom: 0; }
.narrative .muted { color: var(--text-2); }
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; }
@media (max-width: 760px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.kpi { padding: 16px 18px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); min-width: 0; }
.kpi:nth-child(4n) { border-right: 0; }
.kpi:nth-last-child(-n+4) { border-bottom: 0; }
.kpi .k-label { font-size: 12px; color: var(--text-2); font-weight: 550; display: flex; align-items: center; gap: 6px; }
.kpi .k-value { font-size: 24px; font-weight: 650; letter-spacing: -.02em; margin-top: 4px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .k-value small { font-size: 13px; font-weight: 550; color: var(--text-2); letter-spacing: 0; margin-left: 2px; }
.kpi .k-foot { font-size: 12px; color: var(--text-3); margin-top: 3px; line-height: 1.4; }
.meter { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; display: flex; gap: 2px; margin-top: 8px; }
.meter span { display: block; height: 100%; }
.meter span:first-child { border-radius: 3px 0 0 3px; }
.meter span:last-child { border-radius: 0 3px 3px 0; }

/* ---------- Status badges ---------- */
.badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 650; padding: 2px 8px 2px 6px; border-radius: 999px; white-space: nowrap; border: 1px solid transparent; }
.badge svg { width: 13px; height: 13px; flex: none; }
.badge.pass, .badge.good { color: var(--good-ink); background: color-mix(in srgb, var(--good) 11%, transparent); }
.badge.warn, .badge.needs-improvement { color: var(--warn-ink); background: color-mix(in srgb, var(--warn) 17%, transparent); }
.badge.fail, .badge.poor, .badge.critical { color: var(--crit-ink); background: color-mix(in srgb, var(--crit) 11%, transparent); }
.badge.info { color: var(--info-ink); background: color-mix(in srgb, var(--info) 10%, transparent); }
.badge.neutral { color: var(--text-2); background: var(--surface-2); border-color: var(--border); }
.ico-pass, .ico-good { color: var(--good); } .ico-warn { color: var(--warn); } .ico-fail, .ico-critical { color: var(--crit); } .ico-info { color: var(--info); }

/* ---------- Checks ---------- */
.check-summary { display: flex; gap: 8px; flex: none; }

/* ---------- Findings ---------- */
.findings { list-style: none; margin: 0; padding: 0; }
.findings li { display: grid; grid-template-columns: 22px 1fr; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--border); }
.findings li:first-child { border-top: 0; }
.findings svg { width: 18px; height: 18px; margin-top: 1px; }
.findings .f-title { font-weight: 600; }
.findings .f-detail { color: var(--text-2); font-size: 13px; margin-top: 2px; }

/* ---------- Tables ---------- */
.table-wrap { overflow-x: auto; }
table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
table.data th, table.data td { padding: 9px 14px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
table.data thead th { position: sticky; top: 0; background: var(--surface-2); color: var(--text-2); font-weight: 600; font-size: 12px; text-transform: none; border-bottom: 1px solid var(--border-strong); }
table.data thead th:first-child { border-top-left-radius: var(--radius); }
table.data thead th:last-child { border-top-right-radius: var(--radius); }
table.data th[data-sort] { cursor: pointer; user-select: none; }
table.data th[data-sort]::after { content: "↕"; opacity: .35; margin-left: 5px; font-size: 11px; }
table.data th[aria-sort="ascending"]::after { content: "↑"; opacity: .9; }
table.data th[aria-sort="descending"]::after { content: "↓"; opacity: .9; }
table.data td.num, table.data th.num { text-align: right; font-variant-numeric: tabular-nums; }
table.data tbody tr:last-child td { border-bottom: 0; }
table.data tbody tr:hover td { background: color-mix(in srgb, var(--surface-2) 70%, transparent); }
table.data td.wrap-cell { white-space: normal; min-width: 220px; }
table.data td.metric-cell { white-space: normal; word-break: break-all; min-width: 200px; max-width: 360px; }
table.data .sub { color: var(--text-3); font-size: 12px; }
table.data tfoot td { font-weight: 650; border-top: 1px solid var(--border-strong); border-bottom: 0; background: var(--surface-2); }
.table-tools { display: flex; gap: 8px; align-items: center; }
.search { font: inherit; font-size: 12.5px; padding: 6px 10px; border-radius: 7px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); min-width: 220px; }

/* ---------- Charts ---------- */
.chart { width: 100%; height: auto; display: block; overflow: visible; }
.chart .grid { stroke: var(--grid); stroke-width: 1; }
.chart .axis { stroke: var(--axis); stroke-width: 1; }
.chart .tick { fill: var(--text-3); font-size: 11px; font-family: var(--font); }
.chart .series path { fill: none; stroke: var(--c); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.chart .series.dashed path { stroke-dasharray: 6 4; }
.chart .series circle { fill: var(--c); stroke: var(--surface); stroke-width: 2; }
.chart .bar path { fill: var(--c); transition: opacity .12s; }
.chart .bar:hover path, .chart .bar:focus path { opacity: .8; }
.chart .hit { fill: transparent; cursor: crosshair; outline: none; }
.chart .bar .hit { cursor: default; }
.chart .guide { stroke: var(--text-3); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0; pointer-events: none; }
.chart .guide.on { opacity: 1; }
.chart .threshold line { stroke-width: 1.5; stroke-dasharray: 5 4; }
.chart .threshold.warn line { stroke: var(--warn); }
.chart .threshold.fail line { stroke: var(--crit); }
.chart .threshold text { fill: var(--text-2); font-size: 10.5px; font-weight: 600; }
.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; padding: 0; font-size: 12px; color: var(--text-2); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.key { display: inline-block; flex: none; background: var(--c); }
.key.line { width: 14px; height: 2px; border-radius: 1px; }
.key.rect { width: 10px; height: 10px; border-radius: 2px; }
.tooltip { position: fixed; z-index: 100; pointer-events: none; min-width: 150px; max-width: 320px; background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.14); padding: 8px 10px; font-size: 12px; opacity: 0; transition: opacity .08s; }
.tooltip.on { opacity: 1; }
.tooltip .tt-title { color: var(--text-2); font-weight: 550; margin-bottom: 4px; }
.tooltip .tt-row { display: grid; grid-template-columns: 14px auto 1fr; align-items: center; gap: 7px; padding: 1px 0; }
.tooltip .tt-row b { font-weight: 650; text-align: left; }
.tooltip .tt-row span:last-child { color: var(--text-2); }

/* ---------- Bars in tables / ladders ---------- */
.hbar { position: relative; height: 8px; background: var(--surface-3); border-radius: 4px; min-width: 120px; }
.hbar span { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--c, var(--s1)); }
.ladder { display: grid; grid-template-columns: 46px 1fr 74px; gap: 6px 10px; align-items: center; font-size: 12.5px; }
.ladder .l-stat { color: var(--text-2); font-weight: 550; }
.ladder .l-val { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.ladder .track { position: relative; height: 10px; }
.ladder .track span { position: absolute; left: 0; top: 0; bottom: 0; background: var(--s1); border-radius: 0 4px 4px 0; }
.ladder .track .mark { position: absolute; top: -3px; bottom: -3px; width: 0; border-left: 1.5px dashed var(--crit); }
.ladder .track .mark.warn { border-color: var(--warn); }
.stat-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.stat-strip div { background: var(--surface-2); border-radius: 7px; padding: 7px 10px; }
.stat-strip dt { font-size: 11px; color: var(--text-2); font-weight: 550; }
.stat-strip dd { margin: 0; font-weight: 650; font-size: 13px; white-space: nowrap; }

/* ---------- Web vitals ---------- */
.vital { padding: 16px 18px; }
.vital .v-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.vital .v-name { font-weight: 700; font-size: 13px; letter-spacing: .02em; }
.vital .v-title { color: var(--text-2); font-size: 12px; }
.vital .v-value { font-size: 26px; font-weight: 650; letter-spacing: -.02em; margin: 8px 0 2px; }
.vital .v-value small { font-size: 12px; font-weight: 550; color: var(--text-2); letter-spacing: 0; }
.gauge { position: relative; display: grid; grid-template-columns: var(--g1) var(--g2) var(--g3); gap: 2px; height: 6px; margin: 14px 0 6px; }
.gauge i { display: block; border-radius: 3px; }
.gauge i:nth-child(1) { background: var(--good); }
.gauge i:nth-child(2) { background: var(--warn); }
.gauge i:nth-child(3) { background: var(--crit); }
.gauge .needle { position: absolute; top: -5px; width: 2px; height: 16px; background: var(--text); border-radius: 1px; box-shadow: 0 0 0 2px var(--surface); transform: translateX(-1px); }
.gauge-scale { display: flex; justify-content: space-between; color: var(--text-3); font-size: 11px; }
.vital .v-foot { margin-top: 10px; font-size: 12px; color: var(--text-2); display: flex; gap: 12px; flex-wrap: wrap; }
.target-head { font-size: 13px; color: var(--text-2); margin: 0 0 10px; display: flex; gap: 8px; align-items: center; }

/* ---------- Pages ---------- */
.rate { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; }
.rate svg { width: 13px; height: 13px; flex: none; }
.muted { color: var(--text-3); }
.rate-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-2); }
.rate-legend > span { display: inline-flex; align-items: center; gap: 5px; }
.rate-legend svg { width: 13px; height: 13px; }
.page-details { display: grid; gap: 10px; }
details.page-detail > summary .sub, details.card > summary .sub { color: var(--text-3); font-weight: 500; font-size: 12.5px; }
details.card > summary > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

/* ---------- Metrics explorer ---------- */
.mx { padding: 4px 0; }
.mx-group { display: flex; align-items: center; gap: 6px; padding: 14px 20px 6px; font-size: 12.5px; color: var(--text-3); border-top: 1px solid var(--border); }
.mx-group:first-child { border-top: 0; }
.mx-group b { color: var(--text); font-weight: 650; }
.mx-group .sep { opacity: .6; }
.mx-group .count { margin-left: auto; }
details.mx-row > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr) auto 128px 14px; align-items: center; gap: 16px; padding: 7px 20px; }
details.mx-row > summary::-webkit-details-marker { display: none; }
details.mx-row > summary:hover { background: var(--surface-2); }
details.mx-row > summary::after { content: ""; width: 6px; height: 6px; border-right: 1.5px solid var(--text-3); border-bottom: 1.5px solid var(--text-3); transform: rotate(-45deg); transition: transform .15s; justify-self: end; }
details.mx-row[open] > summary::after { transform: rotate(45deg); }
details.mx-row[open] > summary { background: var(--surface-2); }
.mx-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
.mx-name .kind { font-size: 11px; color: var(--text-3); margin-left: 8px; font-weight: 550; }
.mx-val { font-size: 12.5px; color: var(--text-2); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mx-val b { color: var(--text); font-weight: 650; }
.spark { display: block; justify-self: end; overflow: visible; }
.spark path { fill: none; stroke: var(--c); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
.spark circle { fill: var(--c); }
.spark-empty { color: var(--text-3); justify-self: end; font-size: 12px; }
.mx-body { padding: 4px 20px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.mx-body .chart-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px 6px; }
.mx-body .mx-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: var(--text-2); margin: 4px 0 10px; }
.mx-body .mx-meta b { color: var(--text); }
.mx-tools { display: flex; gap: 8px; align-items: center; }
@media (max-width: 760px) { details.mx-row > summary { grid-template-columns: minmax(0, 1fr) 96px 14px; } .mx-val { display: none; } }

/* ---------- Details ---------- */
details.card > summary { list-style: none; cursor: pointer; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
details.card > summary::-webkit-details-marker { display: none; }
details.card > summary::after { content: ""; width: 8px; height: 8px; border-right: 2px solid var(--text-3); border-bottom: 2px solid var(--text-3); transform: rotate(45deg); transition: transform .15s; margin-left: 12px; }
details.card[open] > summary::after { transform: rotate(-135deg); }
details.card[open] > summary { border-bottom: 1px solid var(--border); }
dl.meta { display: grid; grid-template-columns: 180px 1fr; gap: 8px 16px; margin: 0; font-size: 13px; }
dl.meta dt { color: var(--text-2); }
dl.meta dd { margin: 0; }
dl.meta dd code { word-break: break-all; }
.glossary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; font-size: 13px; }
.glossary b { display: block; }
.glossary span { color: var(--text-2); }
@media (max-width: 760px) { .glossary { grid-template-columns: 1fr; } dl.meta { grid-template-columns: 1fr; } }
.empty { color: var(--text-3); padding: 24px 20px; text-align: center; font-size: 13px; }
footer { border-top: 1px solid var(--border); color: var(--text-3); font-size: 12px; padding: 20px 0 32px; }
footer .wrap { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

/* ---------- Print ---------- */
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  :root { --bg: #fff; --shadow: none; }
  body { font-size: 11px; }
  .nav, .toolbar, .table-tools, .tooltip { display: none !important; }
  .masthead .wrap { padding-top: 0; }
  .card, section.block, .vital, tr { break-inside: avoid; }
  section.block { margin-top: 20px; }
  table.data thead th { position: static; }
  details > summary::after { display: none; }
  a { color: inherit; }
}
@media (forced-colors: active) {
  .chart .series path { stroke: CanvasText; }
  .chart .bar path, .key, .gauge i, .hbar span, .ladder .track span { background: CanvasText; fill: CanvasText; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export const SCRIPT: string = /* js */ `
(() => {
  "use strict";
  const root = document.documentElement;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  /* Theme */
  const saved = store.get("ahr-theme");
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  const themeBtn = document.getElementById("theme-toggle");
  const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const syncThemeLabel = () => { if (themeBtn) themeBtn.querySelector("span").textContent = isDark() ? "Light" : "Dark"; };
  syncThemeLabel();
  themeBtn?.addEventListener("click", () => { root.dataset.theme = isDark() ? "light" : "dark"; store.set("ahr-theme", root.dataset.theme); syncThemeLabel(); });

  /* Print */
  document.getElementById("print-btn")?.addEventListener("click", () => window.print());
  const openState = new Map();
  addEventListener("beforeprint", () => document.querySelectorAll("details").forEach((d) => { openState.set(d, d.open); d.open = true; }));
  addEventListener("afterprint", () => openState.forEach((v, d) => { d.open = v; }));

  /* Raw JSON download */
  document.getElementById("json-btn")?.addEventListener("click", () => {
    const el = document.getElementById("raw-report");
    if (!el) return;
    download(new Blob([el.textContent || ""], { type: "application/json" }), document.body.dataset.source || "report.json");
  });
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* Tooltip */
  const tip = document.createElement("div");
  tip.className = "tooltip"; tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  let current = null;
  function show(el, x, y) {
    let data; try { data = JSON.parse(el.getAttribute("data-tip")); } catch { return; }
    if (current !== el) {
      current = el;
      tip.replaceChildren();
      const t = document.createElement("div"); t.className = "tt-title"; t.textContent = data.t; tip.appendChild(t);
      for (const r of data.r) {
        const row = document.createElement("div"); row.className = "tt-row";
        const k = document.createElement("i"); k.className = "key line"; k.style.setProperty("--c", r.c);
        const v = document.createElement("b"); v.textContent = r.v;
        const n = document.createElement("span"); n.textContent = r.n;
        row.append(k, v, n); tip.appendChild(row);
      }
      const svg = el.closest("svg");
      svg?.querySelectorAll(".guide").forEach((g) => {
        const gx = el.getAttribute("data-gx");
        if (gx) { g.setAttribute("x1", gx); g.setAttribute("x2", gx); g.classList.add("on"); } else g.classList.remove("on");
      });
    }
    tip.classList.add("on");
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + pad, top = y + pad;
    if (left + w > innerWidth - 8) left = x - w - pad;
    if (top + h > innerHeight - 8) top = y - h - pad;
    tip.style.left = Math.max(8, left) + "px"; tip.style.top = Math.max(8, top) + "px";
  }
  function hide() { current?.closest("svg")?.querySelectorAll(".guide").forEach((g) => g.classList.remove("on")); current = null; tip.classList.remove("on"); }
  document.addEventListener("pointermove", (e) => {
    const el = e.target instanceof Element ? e.target.closest("[data-tip]") : null;
    if (el) show(el, e.clientX, e.clientY); else if (current) hide();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target instanceof Element ? e.target.closest("[data-tip]") : null;
    if (el) { const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); }
  });
  document.addEventListener("focusout", hide);
  addEventListener("scroll", hide, { passive: true });

  /* Sortable tables */
  document.querySelectorAll("table.data th[data-sort]").forEach((th) => {
    th.tabIndex = 0;
    const run = () => {
      const table = th.closest("table"), tbody = table.tBodies[0];
      const idx = Array.prototype.indexOf.call(th.parentElement.children, th);
      const asc = th.getAttribute("aria-sort") !== "ascending";
      table.querySelectorAll("th[aria-sort]").forEach((o) => o.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", asc ? "ascending" : "descending");
      const numeric = th.dataset.sort === "num";
      const val = (tr) => { const c = tr.children[idx]; const v = c?.dataset.v ?? c?.textContent ?? ""; return numeric ? parseFloat(v) || 0 : v.toLowerCase(); };
      [...tbody.rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1); }).forEach((r) => tbody.appendChild(r));
    };
    th.addEventListener("click", run);
    th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); } });
  });

  /* Table filter */
  document.querySelectorAll("input[data-filter]").forEach((input) => {
    const table = document.getElementById(input.dataset.filter);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      [...table.tBodies[0].rows].forEach((r) => { r.hidden = q !== "" && !r.textContent.toLowerCase().includes(q); });
    });
  });

  /* Metrics explorer: filter + expand all */
  document.querySelectorAll("input[data-filter-mx]").forEach((input) => {
    const list = document.getElementById(input.dataset.filterMx);
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      list.querySelectorAll("details.mx-row").forEach((d) => { d.hidden = q !== "" && !d.dataset.key.includes(q); });
      list.querySelectorAll(".mx-group").forEach((g) => {
        let el = g.nextElementSibling, any = false;
        while (el && !el.classList.contains("mx-group")) { if (!el.hidden) any = true; el = el.nextElementSibling; }
        g.hidden = !any;
      });
    });
  });
  document.querySelectorAll("[data-mx-toggle]").forEach((btn) => btn.addEventListener("click", () => {
    const rows = document.getElementById(btn.dataset.mxToggle).querySelectorAll("details.mx-row");
    const open = btn.textContent === "Expand all";
    rows.forEach((d) => { if (!d.hidden) d.open = open; });
    btn.textContent = open ? "Collapse all" : "Expand all";
  }));

  /* CSV export */
  document.querySelectorAll("[data-csv]").forEach((btn) => btn.addEventListener("click", () => {
    const table = document.getElementById(btn.dataset.csv);
    const q = (s) => { s = String(s).replace(/\\s+/g, " ").trim(); return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [...table.querySelectorAll("tr")].filter((r) => !r.hidden).map((r) => [...r.children].map((c) => q(c.dataset.csv ?? c.dataset.v ?? c.textContent)).join(","));
    download(new Blob([rows.join("\\n")], { type: "text/csv" }), btn.dataset.csv + ".csv");
  }));

  /* Active nav link */
  const links = [...document.querySelectorAll(".nav a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id)); });
    }, { rootMargin: "-80px 0px -70% 0px" });
    sections.forEach((s) => io.observe(s));
  }
})();
`;
