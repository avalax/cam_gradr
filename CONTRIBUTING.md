# Contributing

How to work on cam_gradr. How the app works inside and why it was built that way is in
[PLAN.md](PLAN.md); the changes are in [CHANGELOG.md](CHANGELOG.md).

## Setup

Node.js 22 is required (see `.nvmrc`).

```bash
npm ci               # install dependencies
npm run dev          # development server
npm run build        # production build
npm run verify       # lint, typecheck, knip, unit tests with coverage
npm run e2e:install  # once: Firefox for the acceptance tests (Chrome must be installed)
npm run e2e          # Playwright acceptance tests (builds and starts the app)
npm run verify:all   # verify and e2e together
```

## Workflow

`main` is protected: changes get in only through pull requests, and the checks `verify` and
`acceptance` must be green.

1. Create a branch from the current `main`, for example `git switch -c feat/short-description`.
2. Commit with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat:`,
   `fix:`, `docs:`, `test:`, `chore:` …), lines at most 100 characters. Husky runs the hooks:
   `pre-commit` lints and formats the changed files, `commit-msg` checks the message, `pre-push` runs
   `npm run verify` and blocks pushes to `main`.
3. Push the branch and open a pull request against `main`; the template lists what to check. A
   comment links its preview on GitHub Pages (`https://avalax.github.io/cam_gradr/pr-preview/pr-<number>/`),
   so the change can be tried with a real camera. The preview follows every push a few minutes later
   and is removed when the pull request is closed. It shares the browser storage (reference sets,
   language, appearance) with the app.
4. Merge with **Squash and merge**. The pull request title becomes the commit on `main` and drives the
   changelog and the version, so it must be a Conventional Commit title such as
   `feat(ui): new brightness scale` (the `pr-title` workflow checks it). A merge commit is allowed in
   justified cases, but it adds an extra changelog entry.

## Rules

- **Coverage of 100 %** for statements, branches, functions and lines; below that the run fails. Code
  that no test can reach is removed, not excluded.
- New UI behavior gets a scenario in `e2e/`. The acceptance tests run in Chrome and Firefox against the
  production build with a synthetic camera; `test.only`, `skip` and `fixme` are not allowed.
- Lint and typecheck without warnings: ESLint (strict and type-aware, Vue, accessibility), Prettier,
  Stylelint, markdownlint and knip.
- No manufacturer reference values and no image files in the repo; test data is made up. Own shots and
  project files belong in `local-data/`, which is ignored.
- User-visible texts never live in components or modules but in `src/lang/<language>/<area>.json`
  (English is the reference), used through `t()` or `useI18n()`. Error messages meant only for
  developers stay in English.

## Translations

To add a language, copy `src/lang/en`, translate the files and register the language in
`src/lang/locales.ts` and `src/lang/index.ts`. The tests check that every language has the same keys and
placeholders as English.

## Releases

[release-please](https://github.com/googleapis/release-please) reads the commits on `main`, maintains
`CHANGELOG.md` and keeps a release pull request open. It uses the secret `RELEASE_PLEASE_TOKEN`, so that
the CI also runs on that pull request. Merging it creates the tag and the GitHub release with the build as
a zip; the Pages workflow then publishes the new version on GitHub Pages.
