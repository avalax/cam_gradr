# Contributing and workflow

The `main` branch is protected: changes get in **only through pull requests**, and both CI checks
`verify` and `acceptance` must be green.

## Workflow for a change

1. Get the latest state and create a branch, for example:

   ```bash
   git switch main
   git pull
   git switch -c feat/short-description
   ```

2. Make your changes and commit them. Commit messages follow
   [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (`feat:`, `fix:`, `docs:`,
   `test:`, `chore:` …); the lines of the message are at most 100 characters long. The hooks check
   format, lint and tests.
3. Push the branch and open a pull request against `main`:

   ```bash
   git push -u origin feat/short-description
   ```

   GitHub prints a link in the output for creating the pull request.

4. Wait until the CI is green (`verify` and `acceptance`).
5. Merge with **"Squash and merge"**. The **title of the pull request** becomes the commit message
   on `main` and controls changelog and version (release-please). It must therefore be a valid
   Conventional Commit title, for example `feat(ui): new brightness scale`; the `pr-title` workflow
   checks this. A normal merge commit is allowed in justified cases, for example when several commits
   should each have their own entry in the changelog. It does create an additional entry there, though
   (the merge commit carries the title of the pull request in addition to the commits of the
   branch); that is why squash is the normal case.

## Running the checks locally

```bash
npm run verify      # lint, typecheck, knip, unit tests with coverage (at least 99%)
npm run verify:all  # additionally the Playwright acceptance tests (Chrome and Firefox)
```

The `pre-push` hook runs `npm run verify` and prevents direct pushes to `main`.

## Quality requirements

- New logic needs unit tests; the coverage threshold of 99% applies to all metrics.
- New UI behavior needs an acceptance scenario in `e2e/`.
- Lint and type checking run without warnings.
- The reference values of the cards (manufacturer data) never belong in the repo. Test data is made up.
- Image files are not checked in.

## Quality assurance in detail

- **Tests:** Vitest with at least **99% coverage** (statements, branches, functions, lines). If the
  coverage drops below that, the run fails.
- **Acceptance tests:** Playwright checks the complete user story in Chrome and Firefox with a
  synthetic camera (see `e2e/`). They run in the CI as their own job `acceptance`.
- **Linting:** ESLint (strict, type-aware, Vue, accessibility), Prettier, Stylelint, markdownlint and
  knip. Warnings count as errors.
- **Git hooks (Husky):** `pre-commit` checks the changed files, `commit-msg` checks the format of the
  commit message, `pre-push` runs `npm run verify`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for example
  `feat: ...` or `fix: ...`.

## Technology

Vue 3, Pinia, TypeScript (strict), Vite and Tailwind CSS. The color math and the card evaluation
(homography, patch measurement, brightness assessment) live as pure, tested modules in `src/color` and
`src/chart`. The browser camera is wrapped behind a thin adapter in `src/camera`. The plan and the
decisions are in [PLAN.md](PLAN.md).

User-visible texts never belong in components or modules: add them to `src/lang/en/<area>.json` and
`src/lang/de/<area>.json` and use `t()` / `useI18n()`. Error messages meant only for developers stay in
English and are not translated.

## Releases

Releases happen automatically: [release-please](https://github.com/googleapis/release-please) reads
the Conventional Commits, maintains `CHANGELOG.md` and opens a release pull request. Merging it creates
the tag and the GitHub release with a build artifact, and the app is published on GitHub Pages.
