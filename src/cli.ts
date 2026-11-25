#!/usr/bin/env node
/**
 * CLI: loadlens-html <report.json> [options]
 *
 * Exit codes: 0 = pass (or warn without --strict), 1 = checks failed
 * (with --fail-on), 2 = usage / input error.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";
import { parseArgs } from "node:util";
import { generateReport, ReportFormatError, VERSION, type ThresholdConfig, type Status } from "./index.js";

const HELP = `loadlens-html ${VERSION}

Generate a self-contained HTML report from an Artillery report.json.

Usage
  loadlens-html <report.json> [options]

Options
  -o, --output <file>       Output HTML file (default: <input>.html)
  -t, --title <text>        Report title (default: scenario name)
  -d, --description <text>  Short description shown under the title
      --thresholds <file>   JSON threshold / SLO config (see README)
      --target <url>        The test's config.target. Pages on other hosts are listed separately
                            (only needed for Playwright tests with showAllPageMetrics)
      --label <k=v>         Header label, repeatable (e.g. --label env=staging)
      --tz <zone>           IANA time zone for timestamps (default: UTC)
      --no-embed            Do not embed the raw JSON in the report
      --fail-on <level>     Exit 1 when the verdict is at or above: fail | warn | never (default: never)
      --summary-json <file> Also write the analysed model (checks, KPIs) as JSON
  -q, --quiet               Only print errors
  -h, --help                Show this help
  -v, --version             Print version
`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      title: { type: "string", short: "t" },
      description: { type: "string", short: "d" },
      thresholds: { type: "string" },
      target: { type: "string" },
      label: { type: "string", multiple: true },
      tz: { type: "string", default: "UTC" },
      "no-embed": { type: "boolean", default: false },
      "fail-on": { type: "string", default: "never" },
      "summary-json": { type: "string" },
      quiet: { type: "boolean", short: "q", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  const input = positionals[0];
  if (!input) {
    process.stderr.write(`error: missing input file\n\n${HELP}`);
    return 2;
  }
  const failOn = values["fail-on"];
  if (!["fail", "warn", "never"].includes(failOn ?? "")) {
    process.stderr.write(`error: --fail-on must be one of fail | warn | never\n`);
    return 2;
  }
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: values.tz });
  } catch {
    process.stderr.write(`error: unknown time zone "${values.tz}"\n`);
    return 2;
  }

  const inputPath = resolve(input);
  const output = resolve(values.output ?? inputPath.replace(/\.json$/i, "") + ".html");

  let thresholds: ThresholdConfig | undefined;
  if (values.thresholds) {
    thresholds = JSON.parse(await readFile(resolve(values.thresholds), "utf8")) as ThresholdConfig;
  }

  const labels: Record<string, string> = {};
  for (const l of values.label ?? []) {
    const i = l.indexOf("=");
    if (i <= 0) {
      process.stderr.write(`error: --label expects key=value, got "${l}"\n`);
      return 2;
    }
    labels[l.slice(0, i)] = l.slice(i + 1);
  }

  const text = await readFile(inputPath, "utf8");
  const { html, model } = generateReport(text, {
    sourceFile: basename(inputPath),
    title: values.title,
    defaultTitle: basename(inputPath).replace(/\.json$/i, ""),
    description: values.description,
    thresholds,
    timeZone: values.tz,
    targets: values.target ? [values.target] : undefined,
    labels,
    embedRaw: !values["no-embed"],
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  if (values["summary-json"]) {
    const { periods: _p, counters: _c, ...summary } = model;
    await writeFile(resolve(values["summary-json"]), JSON.stringify(summary, null, 2), "utf8");
  }

  if (!values.quiet) {
    const counts = { pass: 0, warn: 0, fail: 0 } as Record<Status, number>;
    model.checks.forEach((c) => counts[c.status]++);
    process.stdout.write(
      `${model.verdict.toUpperCase()}  ${model.meta.title}\n` +
        `  checks: ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail\n` +
        `  report: ${output}\n`,
    );
  }

  const rank: Record<Status, number> = { pass: 0, warn: 1, fail: 2 };
  if (failOn === "fail" && rank[model.verdict] >= 2) return 1;
  if (failOn === "warn" && rank[model.verdict] >= 1) return 1;
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" || code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
      process.stderr.write(`error: ${(err as Error).message.split(". ")[0]}\nRun with --help for usage.\n`);
      process.exit(2);
    }
    const msg =
      code === "ENOENT" || code === "EACCES" || code === "EISDIR"
        ? `cannot read ${(err as NodeJS.ErrnoException).path ?? "file"} (${code})`
        : err instanceof ReportFormatError || err instanceof SyntaxError
          ? err.message
          : err instanceof Error
            ? (err.stack ?? err.message)
            : String(err);
    process.stderr.write(`error: ${msg}\n`);
    process.exit(2);
  },
);
