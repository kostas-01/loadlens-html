# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-11-25

### Added
- Artillery plugin (`config.plugins.html` with `scope: "loadlens-"`) that writes a self-contained HTML report at the end of `artillery run`, including for interrupted runs.
- `loadlens-html` CLI for existing `report.json` files.
- Pass / warn / fail verdict with built-in checks (VU failure rate, 5xx responses, HTTP response time, Web Vitals at p75) and custom rules with wildcards.
- Automated findings, timeline charts, Web Vitals gauges, latency distribution, status codes, errors, scenarios, period breakdown.
- Metrics explorer: every metric grouped by namespace, with per-period sparklines and expandable charts.
- `failOn` / `--fail-on` exit-code gating and `summaryJson` / `--summary-json` output for CI.
- Programmatic API with TypeScript types.
- Playwright: Pages & Web Vitals comparison in visit order, per-page detail, client-side (SPA) route detection, separation of pages on other hosts (`showAllPageMetrics`), `extendedMetrics` (DOM interactive, page views, JS heap MB), `aggregateByName` support, `test.step()` timings and readable failed-assertion errors.
- `--target` CLI flag.
- Browser-internal pages (`about:blank`, `chrome-error://…`) are never counted as your site's pages.
- Unnamed scenarios are labelled "Unnamed scenario #n", and the report title falls back to the test script's (or input file's) name.
- `npm run configure` setup script for author and repository details.

[Unreleased]: https://github.com/kostas-01/loadlens-html/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kostas-01/loadlens-html/releases/tag/v1.0.0
