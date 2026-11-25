# Publishing checklist

A step-by-step guide from this folder to a published npm package. Run the commands from the project root.

## 1. Create the repository

```bash
cd loadlens-html
git init -b main
git add .
git commit -m "Initial release: loadlens-html 1.0.0"
```

Create an empty repository on GitHub (e.g. `your-user/loadlens-html`), then:

```bash
git remote add origin git@github.com:your-user/loadlens-html.git
git push -u origin main
```

The CI workflow (`.github/workflows/ci.yml`) runs the tests on Node 18, 20, 22 and 24 on every push and pull request.

## 2. Fill in your details

Run the setup script once with your name and GitHub repository:

```bash
npm run configure -- --author "Your Name <you@example.com>" --repo your-user/loadlens-html
```

This sets `author`, `repository`, `homepage` and `bugs` in `package.json`, and the copyright holder in `LICENSE`. Add `--dry-run` to preview it. npm shows these on the package page, and provenance (step 6) requires `repository` to match the GitHub repo exactly.

It also replaces the `OWNER/loadlens-html` placeholders in the README badges and the CHANGELOG links. `npm publish` refuses to run while placeholders are left (`scripts/check-metadata.mjs`).

To publish under your own npm scope instead, add `--name @your-user/loadlens-html`. Users then enable it with `plugins: { html: { scope: "@your-user/loadlens-" } }`.

Commit and push:

```bash
git commit -am "Configure package metadata" && git push
```

## 3. Check before publishing

```bash
npm view loadlens-html   # should say 404 Not Found (name still free)
npm ci
npm run typecheck
npm test                          # builds + 30 tests
npm pack --dry-run                # lists exactly what will be published (~28 files, ~46 kB)
```

Optional end-to-end check against a real Artillery install:

```bash
npm pack                                          # creates loadlens-html-1.0.0.tgz
mkdir /tmp/try && cd /tmp/try && npm init -y
npm i artillery /path/to/loadlens-html-1.0.0.tgz
npx artillery run /path/to/loadlens-html/examples/artillery-test.yml
```

### Optional: rehearse the whole publish locally

[Verdaccio](https://verdaccio.org) is a private npm registry that runs on your machine. It lets you run a real `npm publish` and `npm install loadlens-html` by name without touching npmjs.com:

```bash
npx verdaccio@6 &                                   # registry on http://localhost:4873
npm adduser --registry http://localhost:4873        # any username/password
npm publish --registry http://localhost:4873        # runs build + tests first

# in another folder:
npm init -y
npm i -D artillery
npm i -D loadlens-html --registry http://localhost:4873
npx artillery run your-test.yml                     # with plugins: { html: { scope: "loadlens-" } }
```

Stop Verdaccio afterwards. Its storage is in `~/.local/share/verdaccio` (or `~/.config/verdaccio`), so delete that folder to reset it.

## 4. npm account

1. Create an account at https://www.npmjs.com/signup if you don't have one.
2. Turn on two-factor authentication (Account → Two-Factor Authentication). npm requires it for publishing.
3. Log in from the terminal: `npm login`

## 5. First publish (from your machine)

```bash
npm publish --access public
```

`prepublishOnly` runs the build and the full test suite first, so a broken build can't be published. Check the result at https://www.npmjs.com/package/loadlens-html and try it:

```bash
npx loadlens-html --version
```

Tag the release in git:

```bash
git tag v1.0.0 && git push --tags
```

## 6. Later releases (automated from GitHub)

One-time setup: create an npm **granular access token** with read-and-write permission for this package (npmjs.com → Access Tokens), and add it to the GitHub repository as the secret `NPM_TOKEN` (Settings → Secrets and variables → Actions).

Alternatively, configure npm **Trusted Publishing** for the package (npmjs.com → package → Settings → Trusted publishing → GitHub Actions, workflow `release.yml`). Then no token is needed and you can remove the `NODE_AUTH_TOKEN` line from the workflow.

For each release:

1. Add your changes under `## [Unreleased]` in `CHANGELOG.md` (Added / Changed / Fixed / Removed) and commit them.
2. Bump the version:

   ```bash
   npm run release:patch      # or release:minor / release:major
   ```

   This runs `npm version`, which:
   - runs the tests (`preversion`)
   - bumps `package.json` and `package-lock.json`
   - renames the Unreleased section to `## [x.y.z] - <today>` and updates the compare links (`scripts/release-changelog.mjs`); it stops if the section is empty
   - commits, tags `vX.Y.Z` and pushes the commit and tag (`postversion`)

For a pre-release, use `npm version prerelease --preid beta`, then create a GitHub Release marked as a pre-release. The workflow publishes any version containing `-` under the `next` dist-tag, so it never becomes `latest`.

Then create a GitHub Release from that tag (Releases → Draft a new release → choose the tag → Publish). The `release.yml` workflow checks that the tag matches `package.json`, runs the tests and publishes with npm provenance, so the package page shows a verified link back to the source.

Versioning: patch = fixes, minor = new options or features, major = breaking changes to options, CLI flags or the API.

## 7. Help people find it

The package name doesn't contain "artillery", so search relies on the description, keywords and README:

- The npm description starts with "HTML report generator for Artillery load tests", and the keywords include `artillery`, `artillery-plugin`, `artillery-report`, `artillery-html-report` and `artillery-reporter`. Keep them when editing `package.json`.
- On GitHub, add the same words as repository topics (About → Topics): `artillery`, `artillery-plugin`, `artillery-report`, `load-testing`, `html-report`, `web-vitals`, `playwright`. Set the repo description to the npm description.
- Add a screenshot of a report to the README (GitHub renders it; npm shows it too if you use an absolute image URL).
- Post it in Artillery's GitHub Discussions (Show and tell), and ask to be added to the community integrations list on artillery.io. It also tells them about the project openly.
- Answer issues and keep it compatible with new Artillery releases.

## Name and branding checklist (already applied)

- [x] The package name (`loadlens-html`) doesn't use the Artillery trademark. Users load it with `plugins: { html: { scope: "loadlens-" } }`.
- [x] The package actually is an Artillery plugin (`Plugin` export, loaded via `config.plugins`).
- [x] Generated reports are titled "… — load test report", not "Artillery report".
- [x] Disclaimer in the README (top and bottom), the npm description and the footer of every generated report.
- [x] No Artillery logo, colours or artwork, and no claims of being official.
- [x] "Artillery" is used only descriptively (what the tool works with).
- [x] No Artillery source code is included. The project uses only the public plugin interface and the `report.json` format.
