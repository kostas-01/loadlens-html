# loadlens-html — HTML reports for Artillery load tests

[![npm version](https://img.shields.io/npm/v/loadlens-html.svg)](https://www.npmjs.com/package/loadlens-html)
[![CI](https://github.com/kostas-01/loadlens-html/actions/workflows/ci.yml/badge.svg)](https://github.com/kostas-01/loadlens-html/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/loadlens-html.svg)](https://nodejs.org)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Artillery HTML report generator.** Self-contained HTML reports for [Artillery](https://www.artillery.io/) load tests, with a pass/warn/fail verdict, SLO checks, Core Web Vitals, automated findings and a metrics explorer. One file: it opens offline and prints to PDF.

Looking for an **Artillery HTML report** now that the built-in `artillery report` command is deprecated? Run `npx loadlens-html report.json` on any Artillery v2 `report.json`, or add it as a plugin so every `artillery run` writes the report automatically. It covers HTTP and Playwright (browser) tests.

> **Independent community plugin.** This project is not affiliated with, endorsed by or sponsored by Artillery Software Inc. "Artillery" is a trademark of Artillery Software Inc. and is used here only to describe compatibility.

- **Two ways to use it:** as an Artillery plugin that writes the report automatically after every `artillery run`, or as a command-line tool for any existing `report.json`.
- **Verdict and SLO checks:** VU failure rate, 5xx responses, HTTP response-time percentiles, and Web Vitals at p75 against Google's thresholds. Add your own rules, with `*` wildcards.
- **Automated findings:** failed VUs and their errors, 4xx/5xx responses, long latency tails, degradation during the run, small samples, interrupted runs.
- **Metrics explorer:** every counter and timing metric, grouped by namespace, with a sparkline per 10-second period and an expandable full chart.
- **Both engines:** HTTP (including `metrics-by-endpoint`) and Playwright: a per-page Web Vitals comparison, steps, extended metrics, `aggregateByName`, third-party pages and SPA navigation.
- **CI-ready:** sets the `artillery run` exit code on FAIL, writes a machine-readable summary, and has zero runtime dependencies.
- Light and dark themes, sortable tables, CSV export, keyboard-accessible tooltips, print styles. All values from the report are HTML-escaped.

## Install

```bash
npm install --save-dev loadlens-html
# or, if Artillery is installed globally:
npm install -g loadlens-html
```

Install the plugin the same way you installed Artillery: globally next to a global Artillery, or locally in the project.

## Use as an Artillery plugin

Add it to `config.plugins` in your test script. Artillery loads a plugin's module as `scope + key` (the scope defaults to `artillery-plugin-`), so set `scope: "loadlens-"` and Artillery loads `loadlens-html`:

```yaml
config:
  target: https://api.example.com
  phases:
    - duration: 60
      arrivalRate: 10
  plugins:
    html:
      scope: "loadlens-"
```

Run your test as usual. The report is written when the test finishes:

```
$ artillery run test.yml
…
HTML report (PASS): /path/to/artillery-report-20261125-124642.html
```

### Plugin options

```yaml
plugins:
  html:
    scope: "loadlens-"     # required: tells Artillery which package to load
    output: reports/{name}-{timestamp}.html   # placeholders: {name} {timestamp} {date}
    title: Checkout API — nightly
    description: 10 → 50 VUs over 5 minutes against staging
    labels:
      env: staging
      build: "1.4.2"
    timeZone: Europe/London
    failOn: fail            # never | warn | fail
    summaryJson: reports/summary.json
    thresholds: thresholds.json   # or an inline object (see below)
    embedRaw: true
    quiet: false
```

| Option | Default | Description |
|---|---|---|
| `scope` | — | Set to `"loadlens-"`. Artillery uses it to find the package (`loadlens-` + `html`). |
| `output` | `artillery-report-{timestamp}.html`, or next to `--output` as `.html` | Report path, relative to the working directory. |
| `title` | scenario name | Report title. |
| `description` | — | Text shown under the title. |
| `labels` | — | Key/value labels shown in the header (environment, build, branch…). |
| `thresholds` | built-in defaults | Inline threshold object, or a path to a JSON file. Paths are resolved relative to the test script first, then the working directory. |
| `timeZone` | `UTC` | IANA time zone for timestamps. |
| `failOn` | `never` | Make `artillery run` exit with code 1 when the verdict is `fail` (or `warn`). |
| `summaryJson` | — | Also write verdict, checks, KPIs and findings as JSON. |
| `embedRaw` | `true` | Embed the raw metrics so viewers can download them from the report. |
| `quiet` | `false` | Don't print the report path. |

If a test is interrupted (for example with Ctrl-C), the plugin still writes a report from the periods recorded so far, clearly marked **Incomplete run**.

## Use from the command line

For a `report.json` you already have (`artillery run --output report.json test.yml`):

```bash
npx loadlens-html report.json -o report.html \
  --thresholds thresholds.json \
  --label env=staging --tz Europe/London \
  --fail-on fail --summary-json summary.json
```

| Option | Description |
|---|---|
| `-o, --output <file>` | Output file (default `<input>.html`) |
| `-t, --title <text>` | Report title |
| `-d, --description <text>` | Description under the title |
| `--thresholds <file>` | Threshold config (JSON) |
| `--target <url>` | The test's `config.target`, used to separate pages on other hosts (Playwright) |
| `--label k=v` | Header label; repeatable |
| `--tz <zone>` | IANA time zone (default `UTC`) |
| `--no-embed` | Don't embed the raw JSON |
| `--fail-on fail\|warn\|never` | Exit 1 when the verdict reaches this level |
| `--summary-json <file>` | Write the analysed summary as JSON |
| `-q, --quiet` | Only print errors |

Exit codes: `0` OK · `1` verdict reached `--fail-on` · `2` usage or input error.

## Thresholds

Every field is optional. A value **strictly above** `warn` is a warning, and a value **strictly above** `fail` fails the run.

```jsonc
{
  "failureRate": { "warn": 0, "fail": 1 },                            // % of VUs that failed; false disables
  "webVitals": true,                                                   // TTFB/FCP/LCP/CLS/INP/FID at p75
  "httpResponseTime": { "stat": "p95", "warn": 500, "fail": 1000 },   // false disables
  "fail5xx": true,
  "checks": [
    { "label": "Checkout p99", "metric": "plugins.metrics-by-endpoint.response_time./api/checkout", "stat": "p99", "fail": 800 },
    { "metric": "browser.page.LCP.*", "stat": "p75", "warn": 2000, "fail": 2500 },
    { "label": "Recorded errors", "metric": "errors.*", "type": "counter", "fail": 0 },
    { "label": "Timeout rate", "metric": "errors.ETIMEDOUT", "type": "rate", "of": "http.requests", "fail": 0.5 }
  ]
}
```

- `stat`: `min`, `max`, `mean`, `median`, `p50`, `p75`, `p90`, `p95`, `p99` or `p999`.
- `type`: `summary` (default) compares a timing statistic, `counter` compares a summed counter, and `rate` compares a counter as a percentage of `of`.
- A summary rule whose metric isn't in the report becomes a **warning**, so a typo can't pass silently.

## Playwright (browser) tests

The report adapts to however the [Playwright engine](https://www.artillery.io/docs/reference/engines/playwright) is configured:

| Your setup | What the report shows |
|---|---|
| Default (`page.goto`, clicking links or nav tabs) | **Pages & Web Vitals**: one row per page in visit order, with TTFB / FCP / LCP / CLS / INP at p75, each rated good / needs improvement / poor. Query strings appear as Artillery normalises them (`/search?q=STRING`). Plus per-page gauges, and a Web Vitals check per page. |
| `showAllPageMetrics: true` | Pages on other hosts (iframes, third-party widgets, redirects) are listed under **Other hosts** and excluded from the built-in checks. |
| `extendedMetrics: true` | Adds DOM interactive per page, page views (DOMContentLoaded counts) and JS heap usage in MB. |
| `aggregateByName: true` | One row per **scenario** instead of per page, with a note that values combine all pages. |
| `test.step('name', …)` | Each step is a timing metric (`browser.step.name`): charts, percentile bars and Metrics rows. The headline shows the slowest step when there are no page metrics. |
| `stripQueryString` / `normalizeQueryString` | Page names follow whatever Artillery reports. |
| Failed `expect(…)` assertions | A critical finding plus readable rows such as "Failed assertion: toHaveText". |

**Clicking through a single-page app.** Client-side route changes (clicking tabs that only change the URL) are not page loads, so Artillery records no new TTFB/FCP. The pending LCP is also reported under the new URL. The report marks these rows as *client-side route*, leaves them out of the "slowest page" ranking, and suggests `test.step()` to time those interactions.

**No page metrics at all?** Artillery only reports Web Vitals for URLs that start with `config.target`, exactly. `https://example.com` doesn't match `https://www.example.com/news`, and redirects to another host are dropped. The report detects this and explains the fix: match `target` to the URLs you visit, set `showAllPageMetrics: true`, or use `test.step()`.

With the CLI, pass `--target <url>` so pages on other hosts are separated correctly. The plugin reads `config.target` automatically. Without it, the host with the most samples is treated as your site.

To set thresholds for one site's pages only, include the host in the pattern: `{ "metric": "browser.page.LCP.https://www.example.com/*", "stat": "p75", "fail": 2500 }`.

A runnable demo with nav tabs, a cross-origin iframe and SPA tabs is in `examples/playwright-demo/`.

## CI example (GitHub Actions)

```yaml
- run: npx artillery run test.yml        # plugin configured with failOn: fail
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: load-test-report
    path: reports/*.html
```

## Programmatic API

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { generateReport } from "loadlens-html";

const { html, model } = generateReport(readFileSync("report.json", "utf8"), {
  sourceFile: "report.json",
  thresholds: { httpResponseTime: { warn: 300, fail: 600 } },
  labels: { env: "prod" },
});
writeFileSync("report.html", html);
if (model.verdict === "fail") process.exitCode = 1;
```

Also exported: `generateReportFromObject`, `analyze`, `renderReport`, `evaluateChecks`, `DEFAULT_THRESHOLDS`, `WEB_VITALS`, and all types.

## Compatibility

- Artillery v2 (the counters/summaries metrics format). Tested with Artillery 2.0.34. v1 reports are detected and rejected with a clear message.
- Node.js 18 or later.
- The plugin has been tested with local `artillery run`. For distributed runs (`run-lambda`, `run-fargate`), write `--output report.json` and generate the report with the CLI.

## Versioning

This package follows [Semantic Versioning](https://semver.org/). Breaking changes to plugin options, CLI flags or the programmatic API only happen in a major release. See [CHANGELOG.md](CHANGELOG.md) for every release.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, see [SECURITY.md](SECURITY.md).

```bash
npm install
npm test            # builds, then runs the node:test suite
npm run example     # regenerates examples/report.html
```

## License

MIT. See [LICENSE](LICENSE).

*Not affiliated with or endorsed by Artillery Software Inc. "Artillery" is a trademark of Artillery Software Inc.*
