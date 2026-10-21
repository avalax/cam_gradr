# cam_gradr – LUT generator with the Datacolor Spyder Checkr Photo

## 1. Goal

A single-page web app (purely client-side, no backend) that captures a Datacolor **Spyder Checkr Photo** with the webcam and uses it to calculate a **3D LUT** that corrects the webcam's color rendering. The correction is visible live in the preview and exportable as a LUT.

## 2. Flow (user flow)

**Layout of the UI:** The camera switch (on/off, state via `aria-checked`) sits at the top right of the header next to the gear; it does not change the tab, and errors on start appear next to it. The tabs show their result below the name (`src/ui/tab-status.ts`): Gray cards green when the measuring point is in the normal range, otherwise yellow with the most important hint; Color cards green when the mean deviation after the correction is up to 2 (ΔE2000), yellow above that (above 5 with a shorter scale); without a measurement or calculation, the mini scale is empty. The status shows the result, not the mere editing. At the top right, the gear menu (⚙) opens the camera settings (camera, resolution, note about the camera's automatic functions), the reference values and save/load project. There are four freely selectable tabs without locks, with **Gray cards** open first: **Gray cards** (set corner points and adjust room brightness, step 1), **Color cards** (set corner points, correction with the active reference set, which is recalculated automatically with every change of the corner points or the reference set, with a wipe slider across both cards for camera and corrected colors, step 2), **Preview** and **Export**. Live image and still image live in the card tabs; every tab with a camera image (Gray cards, Color cards, Preview) has its own still image, which is put away when switching and shown again when coming back; starting the camera discards only the still image of the active tab, loading a project discards all of them. The Preview has its own "Capture still" button. The following sections continue to call the two card tabs "step 1" and "step 2".

1. **Choose and start the camera** (`getUserMedia`, device list, resolution, mirroring off); the controls are part of step 1, there is no separate camera step.
2. **Step 1 – gray-scale side (exposure/brightness)**
   - The two gray cards (18% and 50% gray) are held together in front of the camera and are in the image together.
   - Purpose: set the room brightness so that the lighting is ideal for step 2. This step calculates nothing for the LUT.
   - The user sets corner points on a **still image** (averaged over several frames), not on the moving live image; on the still image they can be dragged. With every new still image, a new measurement is made immediately with the existing corner points.
   - Measurements are only taken on still images, never in the live image. For each patch, the measured brightness is compared with the target range.
   - Target range (configurable, stored in the layout/app configuration): white patch not overexposed (channels below approx. 95%), black patch not underexposed (above approx. 3%), the two large gray patches in the target range (18% patch ≈ sRGB 46%, 50% patch ≈ sRGB 74%, each with tolerance, assuming an sRGB curve). The white and black checks use the brightest and darkest stripe patch. The exact tolerances are determined and tested in M2.
   - Display: a measuring field next to the camera image, as tall as the image (vertically the brightness: too high at the top, too low at the bottom; horizontally the contrast: too low on the left, too high on the right; normal range as a framed window in the middle; surface in fine gray levels as in the zone system, without signal colors) with a dot for the current measurement and without edge labels; instead, the most important message sits as a gray label with a dark line, without a decorative dot ("Brightness too low", "Contrast too high" etc.) at the edge towards which the measurement deviates. The text in the popup always names only the next step (without repeating the message at the edge), because brightness and contrast influence each other: first the brightness (judged on the darkest stripe patch and on the large patches), then the contrast ("Shadows underexposed: first raise the brightness …"). On hover (or keyboard focus), the details appear: the next step, the measured brightness of the two large patches including target value, deviations with tolerance, highlights and shadows. This saves space; there is no histogram.
   - Warning to lock auto exposure/auto white balance in the camera software (no constraint control by the app).
   - Result: the room has the ideal brightness (traffic light green, nothing overexposed), then continue to step 2.
3. **Step 2 – color side (color patches)**
   - The two color cards (48 color patches together) are held together in front of the camera; take a photo/still image (averaging over several frames for noise reduction). Capture happens in sequence after step 1: first both gray cards, then both color cards.
   - Patch alignment: set 4 corner points by click/drag (homography), optionally auto-detection later.
   - Patch measurement: median in the inner ~50% of each patch (excluding edges/reflections).
4. **Calculation** of the correction and quality display (ΔE2000 per patch, mean/max, before/after).
5. **Live preview**: camera image with the LUT applied, split view / before-after wipe slider; the correction always applies in full (no strength slider).
6. **Export** as a LUT file.

## 3. Functional requirements

- Webcam access, camera selection, resolution (up to 1080p/4K if available), still image capture.
- The Spyder Checkr Photo consists of 4 cards: 2 gray cards (18% and 50% gray) and 2 color cards with 48 color patches together. The patch layout is therefore described as multi-card in a configuration file (JSON): cards each with their own grid, positions, neutral patches and reference values (Lab/sRGB). Per capture, two cards are always visible (gray pair or color pair); each card gets its own four corner points. The layout is confirmed against photos of an SCK300 (details in section 11 and in `src/data/profiles/`).
  - **Reference values:** Besides the layout, the repo contains a bundled reference set (`src/data/reference/spyder-checkr-48.reference.json`). It is not a manufacturer file but an unofficial transcription from a blog post (bartneck.de, source named in the file, README and UI). In addition, the user can import their own files (JSON or CSV, format `cam_gradr-reference/1`) and download the active set as JSON. The app validates every set (all IDs known, value ranges, white point), stores it only locally in the browser (IndexedDB) and never sends anything anywhere. Without a loaded set, the calculation is locked; step 1 works without. Several sets can be selected. Patches without a reference value are left out of the calculation.
- Linearization of the camera values (sRGB decode as an assumption, correctable via the neutral patches of the color side).
- Correction model (everything from the measurements of the color side from step 2, including its neutral patches):
  1. 1D tone curve per channel including white balance (monotone interpolation, PCHIP, through the neutral patches),
  2. 3×3 color matrix with row sum 1 (least squares, regularization) on all patches; root-polynomial regression as a later extension,
  3. report of ΔE2000 per patch before/after,
  4. error measure ΔE2000 (Lab). References are given in D50, the camera values (sRGB, D65) are adapted to D50 via Bradford; the reference white point is stated in the imported reference data.
- LUT generation: The correction model is evaluated on a regular grid (N³) in sRGB code values. The correction must remain smooth and monotone, output values are clamped to [0, 1]; outside the measured range (near black/white), it is blended gently towards the identity or the extreme values so that no artifacts arise. The strength (0–100%) mixes between the identity LUT and the correction.
- Live preview in real time (≥ 30 fps) on the GPU, with the 3D LUT as a texture.
- LUT export:
  - `.cube` (default, 17/33/65 grid points selectable) – primary,
  - further formats (`.3dl`, Hald PNG) are not planned.
- Save/load project as a JSON file (`cam_gradr-project/1`): corner points, measurements, calculated model and preview settings, so that work can continue without a new capture. On request (checkbox "Include still images", on by default), each tab with a camera image puts its still image in the file (optional field `stills`: RGB with 8 bits per channel, packed with deflate, as Base64; the size does not matter because nothing goes over a wire). Corner points belong to a still image: without still images in the file, no corner points are saved either (and none are taken over when loading). When loading, corner points and still images are restored and the camera is turned off; files without still images load with the placeholder. The manufacturer's reference values are not saved, only the name of the selected set; when loading, the error report is recalculated if a set is available, otherwise the saved model remains usable for preview and export.
- UI language: English and German. The browser language decides, the gear menu can override it (stored in `localStorage`). Texts live in `src/lang/<language>/<area>.json` (vue-i18n, English is the reference, typed keys); a test checks that all languages have the same keys and placeholders.

## 4. Non-functional requirements

- Runs entirely in the browser, data does not leave the computer (HTTPS/localhost required for the camera).
- Target browsers: current Chrome/Edge, Firefox, Safari (WebGL2).
- Responsive, but primarily desktop. The page and the camera image use the full window width.
- Testable color math (unit tests with reference values).
- **Code coverage of at least 99%**, verified continuously (locally, via hook and in the CI), see section 8.
- Automated pipeline on GitHub with changelog and automatic releases, see section 10.
- **Playwright acceptance tests** for the complete user story, extended incrementally with every milestone and held to the same quality requirements as the app, see section 9.
- Notes on limitations: 8-bit webcam, automatic functions of the camera, lighting (flicker, mixed light), reflections on the card.

## 5. Technology stack

| Area                        | Choice                                                                                                                       | Rationale                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Build/dev                   | **Vite** + **TypeScript** (`create-vue`)                                                                                     | fast, statically deployable                 |
| UI                          | **Vue 3** (Composition API, `<script setup>`)                                                                                | components for wizard steps, reactive state |
| State                       | **Pinia**                                                                                                                    | official Vue store, minimal                 |
| Styling                     | **Tailwind CSS**                                                                                                             | quick, consistent UI                        |
| Camera                      | Web APIs: `getUserMedia`, `requestVideoFrameCallback`                                                                        | native                                      |
| Live preview / LUT applying | **WebGL2** (own lean fragment shader, 3D texture, trilinear interpolation)                                                   | real time, no heavy lib needed              |
| Image analysis              | Canvas 2D / `OffscreenCanvas` + own code (homography, median); optionally **OpenCV.js** only for auto-detection (phase 2)    | OpenCV.js is ~8 MB, so not in the MVP       |
| Math                        | **ml-matrix** (least squares / SVD)                                                                                          | small lib for regression                    |
| Color model                 | own modules (sRGB↔XYZ↔Lab, Bradford, ΔE2000), verified against **colorjs.io** in tests                                       | verifiable                                  |
| Charts                      | **uPlot** or SVG (tone curve, ΔE bars)                                                                                       | lightweight                                 |
| Tests                       | **Vitest** + `@vitest/coverage-v8`, `@vue/test-utils`, happy-dom (coverage ≥ 99%)                                            | fits Vite                                   |
| Acceptance tests            | **Playwright** (`@playwright/test`, Chromium, synthetic camera via Y4M video), `eslint-plugin-playwright`                    | real browser, whole user story              |
| Lint/format                 | ESLint 9 (strict, type-aware, Vue, a11y, Unicorn …), Prettier, Stylelint, markdownlint, knip, Husky, lint-staged, commitlint | see section 8                               |
| CI/CD                       | **GitHub Actions**, release-please, GitHub Pages, Dependabot                                                                 | see section 10                              |

## 6. Architecture / module structure

```text
src/
  camera/        camera access, frame capture, averaging
  chart/         patch layout (JSON), homography, patch sampling
  color/         conversions, ΔE2000, linearization
  solve/         white balance, tone curve, matrix/polynomial fit, error report
  lut/           3D LUT generation, .cube export
  gl/            WebGL2 renderer (video → LUT → canvas)
  ui/            wizard steps, overlays, brightness traffic light, export dialog
  data/layouts/  *.layout.json (card geometry without color values)
  data/reference/  bundled reference set (unofficial transcription)
```

Data flow: camera → frame → (step 1) gray measurement → brightness feedback only (traffic light) → (step 2) color measurement → solver → 3D LUT (Float32Array N³×3) → WebGL texture (preview) and export (file).

## 7. Milestones

0. **M0 – Repo & pipeline** (including Playwright setup and job `acceptance`)**:** Git, Conventional Commits, Husky/lint-staged/commitlint, complete lint configuration (ESLint strict, Prettier, Stylelint, markdownlint, knip, TypeScript strict), Vitest with a 99% threshold, CI workflow, release-please, Pages deployment, `CHANGELOG.md`.
1. **M1 – Basic framework:** Vite/Vue/TS, camera live image, camera selection, still image.
2. **M2 – Gray-scale step:** multi-card layout (JSON), corner point alignment per card, patch measurement, brightness traffic light with clipping warning, warning about camera automation.
3. **M3 – Color step & solver:** reference import (validation, local storage), color pair (2 cards, 48 patches), fit, ΔE report, before/after.
4. **M4 – LUT & live preview:** WebGL2 pipeline, split view (the initial strength slider was dropped later).
5. **M5 – Export & project:** `.cube` export (17³/33³/65³, always the full correction), save/load project as JSON.
6. **M6 – Polish:** auto-detection of the card (own detection without a library), README with instructions, finishing touches.

**Status M0 (implemented):** Project skeleton, lint/format configuration, Husky hooks (pre-commit, commit-msg, pre-push), Vitest with the 99% gate, CI, release and CodeQL workflows and Dependabot are in the repo; `npm run verify` runs green locally. TypeScript is pinned to `~6.0` because `typescript-eslint` does not yet support TypeScript 7. Still to do by the user: create the GitHub repo, set `RELEASE_PLEASE_TOKEN` as a secret, set Pages to "GitHub Actions", enable branch protection.

**Status M1 (implemented):** Camera selection, resolution selection, live image, start/stop and still image (averaging over 8 frames) with error messages and a note about the camera's automatic functions. The browser camera sits behind the adapter `CameraApi`; coverage is at 100%. Open for the practical test: behavior with the real webcam and the Portkeys workflow has not yet been checked.

**Status M2 (implemented):** Step 1 contains the camera controls. After the first practical test, setting the corner points was moved from the live image to a still image (not operable on moving images). Corner points of both gray cards are set on the still image by click, are numbered, can be dragged and are sorted automatically regardless of click order (top left, top right, bottom right, bottom left); the homography converts card coordinates into the image, the median in the inner patch area yields the measurements, and the traffic light (too dark / OK / too bright / too high contrast) evaluates the large patches as well as the brightest and darkest stripe patch. The layout is in the format `cam_gradr-layout/2` with patch rectangles relative to the card. **Open:** The rectangles and traffic light thresholds are estimated from photos and must be checked against the real card via overlay and readjusted.

**Status M3 (implemented):** Step 2 "Color cards" with reference import (JSON `cam_gradr-reference/1` or CSV with id, L, a, b; checking of IDs, value ranges, minimum number of patches; local storage in IndexedDB under `avalax.cam_gradr`, selection and deletion of several sets), capture of the color cards on a still image with the same corner point tools as step 1 (shared component `CardStage`), calculation of the correction model and report with ΔE2000 per patch, mean and maximum, as well as color patches target / camera / corrected.

Implemented correction model (deviation from the original plan): White balance and tone curve are combined into **one monotone tone curve per channel** (PCHIP through the twelve neutral patches, anchor points at 0 and 1), followed by a **3×3 matrix whose rows sum to 1** (neutral stays neutral), with weak regularization towards the identity matrix. The target is linear sRGB (D65); the references (Lab, D50) are converted via Bradford. The color math (Lab, ΔE2000) is tested against **colorjs.io**. A root-polynomial regression remains a possible later extension.

**Status M4 (implemented):** New tab "Preview". A 3D LUT is calculated from the correction model (33 grid points, cube format with R fastest; `src/lut`) and applied by a thin WebGL2 adapter (`src/gl`) via a 16-bit floating-point 3D texture with trilinear interpolation to the live image (or the still image). The Preview has (since the rework without a strength slider; the correction always applies in full) a movable dividing line (original on the left, corrected on the right), which is dragged directly in the image as a wipe slider or moved with the arrow keys (the same component as in step 2; the former slider for the dividing line is dropped). Next to the image is a narrow column as tall as the image with a toggle "Colors | Grayscale" (colors first). The color view shows the 36 colored patches in two grids (one per card, each patch in three stripes: target, camera, corrected) and names the three patches with the largest remaining deviation; the gray view shows a gray wedge from the twelve measured neutral patches (target, camera, corrected; a neutral gray must look neutral, a color cast stands out in the middle column), below it for each tonal range (shadows 0.1–0.3, midtones 0.4–0.6, highlights 0.7–0.9) the mean brightening and the channels that the correction shifts by at least 1.5 points relative to the others, and at the bottom the mean deviation before and after. The tone curves as a diagram were discarded: with small corrections they lay almost on the straight line and showed hardly anything. Without a calculated color correction or without an image source, the tab shows a hint; if WebGL2 is missing, an error message.

The shader math is additionally secured by a TypeScript reference implementation (`sampleLut`); the WebGL adapter is tested with a dummy. The acceptance tests check real pixels of the preview in Chrome and Firefox (software rendering, so that they also run on CI machines without a graphics card).

**Status M5 (implemented):** New tab "Export" with the size 17³, 33³ (default) or 65³. The LUT is calculated from the model, the full correction is applied (formerly there was a strength from the preview) and the file is downloaded as `cam_gradr-<size>.cube` (format with decimal point and line break `\n`, values 0..1, red fastest; the export is read back in tests and checked against the model). The Export tab fills the height of the other tabs (the app remembers their height) and has two cards: "LUT for monitor or software" (size as a toggle, four slices through the LUT as a preview, file with estimated size and download; grayed out without a color correction with a link to the Color cards, so you can see what you would get) and "Back up project" with a list of what is in the file (corner points, patches, correction, reference), and "Save project" and "Load project" (usable even without a color correction; messages about them appear above the content): The project file is JSON, is strictly validated on loading (format, cards, patches, value ranges, model) and changes nothing about the previous state if the file is faulty.

**Status M6 (in progress):** The live image has no fixed frames: the cards are held where the subject will be, whatever their size. As soon as the search recognizes a card, one frame is drawn around everything found (`detectOutlines`): amber and pulsing until both cards are held steady, then green, drawing itself around both while the still image is captured. There are no texts in the live image. The search finds cards down to about 12 % of the image height (measured on a webcam photo, see `MIN_DARK_SHARE`), the measurement quality at that size is not checked yet. The cards are searched for automatically (`src/chart/detect.ts`, pure TypeScript without a library): dark areas in the downscaled gray image that do not touch the image edge and are in portrait orientation count as cards, their corners are the outermost points along the diagonals. Several brightness thresholds are tried until exactly the expected number of cards is found, otherwise the search continues in the live image. A first approach via edges failed on a photo with a busy background; the current one finds both cards on this photo. Further photos with different light and background have not been checked.

**Rotated cards:** If the cards are held rotated by 180° (dark stripe patch at the bottom instead of the top, the left card in the image is then the right one of the layout), the app recognizes this when measuring: it measures in both orientations and takes the one in which the stripe patches (gray cards) or the gray ladder (color cards) run from dark to bright; in a tie, the previous orientation stays. The rotation is stored in the project (`rotated`, older files lack the field) and is shown in the card tab.

**Contrast in the measuring field:** The contrast is the horizontal axis of the measuring field. It compares the distance between the 50% and the 18% patch with the target distance (0.74 − 0.46 = 0.28 in sRGB code values); normal range ±0.05, full deflection ±0.25. The brightness (vertical axis, ±0.06 normal, ±0.3 full) shifts both patches equally and does not change the distance, the contrast spreads them; this way the two controls of a camera can be adjusted separately. The contrast is only a display, the tone curve compensates for it in part.

**Automatic capture and corner determination:** In the live image, the app searches for the cards every second (always on, without an option; a manual mode and a button for still image capture no longer exist in the card tabs, the corner points can only be dragged; the trash can symbol "Delete corners" in the corner of the image discards corner points and still image and turns the camera back on; starting the camera also begins a new search: the previous state (still image, corner points, measurements) is held and the corner points disappear so that a new still image can be created; if the camera ends without new corner points, the previous state returns (`beginSearch`/`endSearch` in the chart store, `held` in the camera store); with the camera off, Gray cards and Color cards show a gray placeholder like the Preview). If the cards are in the same place in two consecutive search runs (at most 2% of the image width deviation), the still image is captured, the corners are determined again on it and the camera is turned off; if the corners in the still image do not match the live image (movement during averaging), it is discarded and the search continues. The corners are intersections of four straight lines fitted to the straight sides of the dark card area (only the end pieces of each side, so that tabs and rounded corners do not interfere). If a side is not straight (blurred) or the two cards do not match in size (more than 25% difference), nothing counts as detected.

**Evaluation of the error:** The report additionally gives the mean error separately for the neutral patches (gray ladder from which the tone curves arise) and the colored patches; this shows whether the residual error lies in the tone curve or in the 3×3 matrix (a root-polynomial regression would then be the next step). It also checks the correction with the large gray patches from step 1 (G50, G18, nominal values from the reflectance, not part of the calculation) and warns from ΔE2000 3 after the correction that light or the camera's automatic functions may have changed between the captures. Neutral patches that the camera no longer tells apart (slope of the characteristic curve below 0.1, for example with compressed highlights) are combined into blocks that all three channels share before the tone curves are built; otherwise the channels sort them differently and the curves produce a color cast. The report names such patches and advises turning off the camera's automatic functions. The gray cards deliberately do not enter the model: there are no measured target values for them, and they are captured in a different capture.

**Software fallback of the preview:** If WebGL2 is not available, the preview calculates the LUT on the CPU (downscaled to at most 480 pixels width) and shows the rendering mode. The graphics card's LUT texture uses 8 bits per channel (RGBA8), because that also runs everywhere with software GL.

**Reference values and menu:** A gear menu at the top right bundles camera settings and reference values as an accordion (always one section open, when collapsed a short summary on the right such as "Default camera · 1280 × 720"; the resolution is chosen with chips, the note about the camera's automatic functions is a gray info box) (saving and loading the project has been located there since the rework of the Export tab; it closes with Escape, a click outside or the gear). The bundled set (unofficial transcription, source linked) is always loaded at startup and preselected, but cannot be deleted; an own set of the same name takes precedence. The menu also offers file import and `Download set` (JSON `cam_gradr-reference/1`); the Color cards tab shows only the active set. Fetching from an internet address was deliberately not implemented.

## 8. Quality assurance (code coverage ≥ 99%)

- **Vitest** with `@vitest/coverage-v8`; thresholds in `vitest.config.ts`: `statements`, `branches`, `functions`, `lines` each **99%**. Falling below makes the test run fail.
- The coverage is verified continuously during development, not only at the end:
  - every milestone only counts as done when `npm run test:coverage` holds the 99%,
  - a local hook (Husky) runs lint, typecheck and coverage check before `git push`,
  - CI (see section 10) checks the same on every push and pull request.
- Types of tests: unit tests for color math, solver, LUT generation and exporter (reference values, edge cases); component tests with **@vue/test-utils** and **happy-dom**; test images are generated synthetically in the test, no photos are checked into the repo (image files are excluded in `.gitignore`); camera, WebGL and canvas are mocked behind thin adapters so that the logic stays testable.
- Exclusions from the coverage are narrowly scoped (e.g. the pure entry file `main.ts`, type declarations) and justified in the config; exclusions are not used to reach the threshold.
- Borderline case WebGL/camera: The adapters stay as thin as possible and are tested with fake objects so that they are included in the 99% measurement. Pure shader source (GLSL) does not count as code; its math is additionally tested as a TypeScript reference implementation that computes the same interpolation.
- The coverage report (lcov + text) is stored in the CI as an artifact; a badge in the README shows the state.

### Linting & static analysis (best practices)

All checks run locally (`npm run lint`, Husky `pre-commit` via **lint-staged**), before the push and in the CI. Warnings count as errors (`--max-warnings 0`).

- **ESLint 9 (flat config)** with:
  - `typescript-eslint` in the mode `strictTypeChecked` + `stylisticTypeChecked` (type-aware rules, e.g. `no-floating-promises`, `no-unsafe-*`, `strict-boolean-expressions`),
  - `eslint-plugin-vue` with `flat/recommended` (Vue 3) plus rules for `<script setup>`, type-based props/emits and template accessibility,
  - `eslint-plugin-vuejs-accessibility` (a11y in the template),
  - `eslint-plugin-import-x` (import order, no cycles, no duplicate imports),
  - `eslint-plugin-unicorn` (code quality) and the ESLint core rule `complexity` (complexity limit),
  - `@vitest/eslint-plugin` (test rules, no focused/skipped tests),
  - `eslint-plugin-regexp` and `eslint-plugin-promise`,
  - `eslint-plugin-security` for security-relevant patterns,
  - `eslint-config-prettier`, so that formatting does not collide with ESLint.
- **TypeScript:** `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`; typecheck with `vue-tsc --noEmit`.
- **Prettier** for formatting (incl. Vue, JSON, Markdown, YAML), CI checks with `prettier --check`.
- **Further linters:** `stylelint` (Tailwind/CSS rules), `markdownlint-cli2` (README, plan, changelog), `actionlint` (GitHub workflows), `commitlint` (commit messages), `knip` (unused files, exports and dependencies), `import-x/no-cycle` and `import-x/no-restricted-paths` (architecture rules, e.g. `color/` must not depend on `ui/`).
- **Security & dependencies:** `npm audit --omit=dev --audit-level=high` in the CI (production dependencies only; known advisories in pure dev tools such as markdownlint-cli2 are picked up via Dependabot), Dependabot, CodeQL workflow for JavaScript/TypeScript.
- **Editor consistency:** `.editorconfig`, recommended VS Code extensions and settings (`.vscode/`), `.gitattributes` for uniform line endings.

## 9. Acceptance tests (Playwright)

The complete user story is tested end to end in a real browser with **Playwright**. The tests grow **incrementally with the milestones**: with every milestone, the scenarios of the new steps are added, existing scenarios stay and must remain green. A milestone only counts as done when its scenarios are green.

- **Subject:** the production build of the app (`vite preview`), operated like a user (clicks, displays, texts), without knowledge of the internals.
- **Browsers:** Every scenario runs in **Chrome and Firefox** (two Playwright projects `chrome` and `firefox`). Safari/WebKit is not part of the pipeline.
- **Synthetic camera:** Per test, an init script replaces `getUserMedia` and `enumerateDevices` with a canvas stream (`canvas.captureStream`) onto which the cards from the layout are drawn (`e2e/support/synthetic-cards.ts`, `camera-stub.ts`). This way the same scenarios work in both browsers, also because Firefox does not know a video file as a camera. No photos or video files are needed. There are lighting variants (`ok`, `dark`, `bright`), chosen per scenario. Later milestones add color cards with a known distortion and dummy reference values.
- **Structure:** `e2e/support/` (page object `AppPage`, fixtures, camera dummy, scene description), `e2e/*.spec.ts` (one file per section of the story, scenarios written in English; they assert the German interface because the default browser locale is `de-DE`, and `language.spec.ts` covers the language switch including an English-browser scenario), `playwright.config.ts`.
- **Status M2:** `step-1-room-brightness.spec.ts` with 10 scenarios in both browsers, i.e. 20 runs (room is fine, live image measurement, reset, corner points only on the still image, too dark, too bright, order of corner points irrelevant, layout sits correctly on both cards).
- **Status M3:** `step-2-color-correction.spec.ts` with 8 scenarios (no calculating without reference values, import as JSON and as CSV, faulty file, reference values remain after reloading, deleting, calculation clearly improves the colors, arbitrary corner point order). For this, the camera dummy shows color cards with made-up reference values and a known distortion (color mixing, gain, gamma) that the calculation must undo.
- **Status M4:** `preview.spec.ts` with 6 scenarios (hint without color correction, original on the left and corrected on the right based on real pixels, movable dividing line, preview with still image when the camera is off, hint without an image source).
- **Status M5:** `export-and-project.spec.ts` with 9 scenarios (hint without color correction, downloaded `.cube` file corrects the colors, size selection, save project and load it after reloading, project without a reference set, faulty file, project without color correction, preview after loading).
- **Planned:** at the end, a continuous scenario "from camera start to the LUT file".
- **Quality requirements as for the app:** same lint rules (ESLint strict plus `eslint-plugin-playwright`), Prettier, strict TypeScript checking (`e2e/` is part of `vue-tsc`), knip, commit conventions and hooks. In the CI, a separate job `acceptance` (required check for `main`) runs with installation of Chrome and Firefox and a report artifact on failures.
- **Coverage requirement:** The 99% code coverage applies to the unit tests. For the acceptance tests, the sensible equivalent is the **coverage of the user story**: every step and every error case of the story has at least one scenario, and a scenario may only be skipped with justification (`test.fixme`/`skip` are forbidden, `forbidOnly` is active in the CI). A measurable browser code coverage of the E2E runs is not planned.
- **Locally:** `npm run e2e:install` (once, installs Firefox; Google Chrome must be installed locally, the CI installs both), `npm run e2e`; `npm run verify:all` runs unit and acceptance tests together. The pre-push hook runs only `verify`, so that pushes stay fast; the acceptance tests run bindingly in the CI.

## 10. CI/CD & releases (GitHub)

- **Repository:** GitHub, default branch `main`. The local Git history already exists (plan, layout files); afterwards the user creates the GitHub repo and pushes.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:` …), checked by **commitlint** (locally via Husky and in the CI for pull requests).
- **CI workflow** (`.github/workflows/ci.yml`, on push and pull request): install (`npm ci`, cache) → ESLint (`--max-warnings 0`) → Stylelint → markdownlint → actionlint → Prettier check → `vue-tsc` typecheck → knip → `npm audit` → Vitest with coverage threshold 99% → production build. In parallel, the job `acceptance` runs with the Playwright acceptance tests (section 9). Node LTS version pinned.
- **Changelog & releases:** **release-please** (GitHub Action) reads the Conventional Commits, maintains `CHANGELOG.md` and opens a release PR with a version bump (SemVer). On merge, a Git tag and GitHub release with a changelog entry and an attached build artifact (zip of `dist/`) are created automatically.
  - Note: Pull requests created with the default `GITHUB_TOKEN` do not trigger further workflows. So that the CI also runs on the release PR, release-please needs its own token (personal access token or GitHub App), which the user stores as a repo secret.
- **Deployment:** After a release, automatic publication on **GitHub Pages** (static build, HTTPS is required for the camera). The deploy job runs in the same workflow as release-please (condition: a release was created), because a release created with the `GITHUB_TOKEN` does not start a separate workflow.
- **Pull request requirement:** `main` is protected by a ruleset (changes only via pull request, required checks `verify` and `acceptance`). Work happens on branches, merging happens via squash merge with a Conventional Commit title (the `pr-title` workflow checks it; a merge commit is allowed in justified cases but creates an additional entry in release-please's changelog). The template is in `.github/pull_request_template.md`, the `pre-push` hook prevents direct pushes to `main`. Described in `CONTRIBUTING.md`.
- **Additionally:** Dependabot for npm and GitHub Actions; branch protection on `main` (CI must be green) is enabled by the user when creating the repo.

## 11. Decisions (settled)

- **Reference values:** The bundled set is an unofficial transcription from a blog post (bartneck.de) and not a manufacturer file; the source is named in the UI, in the README and in the file itself. Official manufacturer data is not shipped. Tests continue to use synthetic dummy references; the bundled set is only checked for validity. Own files live locally in `local-data/` (in `.gitignore`).
- **Purpose:** The LUT is generated for the webcam or the Portkeys camera monitor and uploaded there manually. The app only generates the LUT file, there is no device integration. Primary format `.cube`; which size the monitor accepts is tested by the user. Export optionally 17³/33³/65³, default 33³.
- **Webcam automation:** Warning only. The user locks auto exposure/auto white balance in the camera software, the app sets no constraints.
- **Color space:** sRGB / Rec.709 for input and output.
- **License:** MIT, Copyright (c) 2026 Avalax. The license applies to the source code; the bundled reference set comes from a third-party, unofficial source and is not covered by it.
- **Application identifier:** `avalax.cam_gradr` (vendor and app name, the owner is the user). It is the constant `APP_ID` in `src/ui/app-info.ts`, is shown in the app and serves as a prefix for local storage keys (e.g. the IndexedDB name for the reference imports) and for project files.
- **Card capture:** Always both gray cards or both color cards are visible at the same time, capture happens in sequence (gray, then color); each card gets its own corner points.
- **Traffic light values step 1:** White below approx. 95%, black above approx. 3%, mid-gray in the target range; values are stored in the configuration and later adjustable in the app.

## 12. Risks

- **Dynamic range:** 8-bit video and camera tone mapping limit the accuracy; the LUT only corrects the locked camera state (recalibrate when lighting/settings change).
- **Reference accuracy:** The quality of the LUT depends on the imported reference values; unofficial or typed-up sources can contain errors, and deviations from the real card (batch, aging) are possible. The app validates only format and value ranges, not correctness.
- **Gray cards:** The assignment 18% / 50% rests only on the brightness difference (no label is visible on the cards); there are no reference values for the 12 stripe patches, the large patches are calculated nominally from the reflectance. The assignment can be reversed via configuration.
- **Copyright:** The bundled set is an unofficial transcription with a named source; the decision to put it in the repo was made by the owner. The note in the UI makes clear that it is not a manufacturer file.

**Tone correction switch:** A checkbox "Contrast and gamma" (preview and export tab show the same box, one setting in the solve store, saved in the project file as `tone`) decides whether the model contains the fitted tone curve. Switched off, each channel only gets one white-balance factor that brings its mid tones to the exposure of the shot (a straight line through the origin), and the matrix still corrects the colors. The model is recomputed from the last measurements, so the report, the preview and the `.cube` export always agree. A model loaded from a project without chart measurements cannot be recomputed, so the box is disabled then.
