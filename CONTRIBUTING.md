# Contributing

Thanks for helping improve loadlens-html. Bug reports, report samples and pull requests are all welcome.

## Reporting a bug

Open an issue at https://github.com/kostas-01/loadlens-html/issues and include:

- the versions of loadlens-html, Artillery and Node.js
- whether you used the plugin or the CLI, and the engine (HTTP or Playwright)
- a `report.json` that reproduces the problem, if you can share one (remove hostnames, tokens and other sensitive values first)

## Development

Requires Node.js 18 or later. There are no runtime dependencies.

```bash
npm install
npm test            # builds with tsc, then runs the node:test suite
npm run typecheck
npm run example     # regenerates examples/report.html from examples/sample-report.json
```

The source lives in `src/` (TypeScript). The pipeline is `analyze.ts` (report.json → `ReportModel`), then `thresholds.ts` (checks and verdict), then `render.ts` and `charts.ts` (HTML and SVG). The tests in `test/` run against the compiled `dist/`.

## Pull requests

- Keep changes focused, and add a test for any behaviour change.
- Add a line under `## [Unreleased]` in `CHANGELOG.md` (Added / Changed / Fixed / Removed).
- Don't add runtime dependencies. The report must stay a single offline file.
- Escape every value that comes from a report. Use the `html` template tag in `src/format.ts`.
- Don't use Artillery's logo, colours or artwork. Refer to Artillery only to describe compatibility.

## Versioning

The project follows [Semantic Versioning](https://semver.org/):

- **patch**: bug fixes, and wording or styling changes in the report
- **minor**: new options, checks, findings or report sections
- **major**: removed or renamed plugin options, CLI flags or API exports, a raised minimum Node.js version, or changes to the `summaryJson` structure

Maintainers release with `npm run release:patch|minor|major`. See [PUBLISHING.md](PUBLISHING.md).
