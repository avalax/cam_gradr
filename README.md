# cam_gradr

[![CI](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml/badge.svg)](https://github.com/avalax/cam_gradr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**LUT generator for the Datacolor Spyder Checkr Photo.** You hold the cards in front of your webcam, the
app helps you set the room brightness and calculates a 3D LUT from it that corrects the color rendition
of the webcam. You download the LUT as a `.cube` file, for example for a camera monitor or video
software.

**Open the app: <https://avalax.github.io/cam_gradr/>**

Everything runs in your browser. There is no backend: images and measurements never leave your computer.

## What you need

- a webcam and the **Datacolor Spyder Checkr Photo** (the two pairs of cards with the gray patches and
  the 48 color patches)
- a current browser (Chrome or Firefox); the camera only works over HTTPS, and the page above meets that
- even light on the cards, without reflections and without shadows

## How to proceed

1. **Prepare the camera.** Lock auto exposure and auto white balance of the camera in its own software.
   The app cannot do this itself, and automatic adjustments falsify the measurement. Then switch on the
   camera at the top right (green "Start camera", red "Stop camera"). You choose the camera and the
   resolution in the gear menu ⚙.
2. **Gray cards tab: set the light.** Hold both gray cards steady where the subject will be. A frame
   appears around the cards as soon as the app sees them. It finds
   them by itself, takes a still image and switches the camera off. In the measuring field on the right a
   dot shows brightness (vertical) and contrast (horizontal). If it sits in the framed window in the
   middle, the light is right; otherwise the field says what to change (details on hover). Change the
   light or the camera and switch the camera on again until the dot is in the normal range.
3. **Color cards tab: calculate the correction.** Hold both color cards steady where the subject will be. The
   correction is calculated automatically. The wipe slider on the right shows the colors of your camera on
   the left and the corrected ones on the right (drag the line or use the arrow keys). The label below
   gives the mean deviation before and after; hover it to see the result per color patch.
4. **Preview tab: check the result.** Your camera image with the correction: the original on the left, the
   corrected image on the right. The side column shows every color patch as target, camera and corrected
   and names the patches with the largest remaining deviation; a switch changes to the grays. With
   "Capture still" you check the correction on a steady image.
5. **Export tab: download the LUT.** Choose the size (17³, 33³ or 65³) and download the `.cube` file.
   Which size your device accepts is in its manual; larger LUTs are more accurate, but some devices only
   take 17³ or 33³. The correction is always applied in full.

You can open the four tabs freely at any time. Below each tab name is a short result, and for the gray
cards and color cards a small gauge of four bars: empty = nothing yet, green = good (light in the normal
range, or mean deviation after the correction of at most 2), yellow = hint.

### Search again and adjust corner points

- The trash icon in the corner of the image ("Delete corner points") discards the still image and the
  corner points, and the search starts over.
- Starting the camera also starts a new search; if the camera ends without a new still image, the old
  image and its corner points come back. Measuring only ever happens on still images.
- You can drag the corner points on the still image. The cards may also be held rotated by 180°; the app
  recognizes that from the stripe patches.

### Save and load a project

In the Export tab, **Save project** and **Load project** save your work as a JSON file (measurements,
correction model, preview settings). With the checkbox "Include still images" (on by default) the still
images of the tabs and their corner points are in the file as well. When you load it, images and corner
points come back and the camera is switched off. Without still images no corner points are saved either.
The reference values are not in the file, only the name of the selected set.

## Tips for good results

- Hold the cards steady and parallel to the camera; blurred shots are not recognized by the app.
- Light both pairs of cards equally. A lamp from the side or reflections on the cards falsify the colors.
- The brightest gray patches must not burn out and the darkest must not sink into black. If the measuring
  field says "Brightness too high" or "too low", change the brightness first, the contrast second.
- After the gray cards, change neither the light nor the camera settings before you capture the color
  cards.
- The preset resolution of 1280 × 720 is a good start.

## Frequently asked questions

**The camera does not start.** Allow camera access in the browser and close other programs that use it.
Locally it only works over `localhost` or HTTPS.

**The cards are not recognized.** Hold them completely in the image, steady and well lit. The app
searches twice a second and takes the image as soon as it finds the cards twice in a row in the same place.

**The deviation is still high after the correction.** Mostly the shot is the cause: burnt-out or crushed
patches, uneven light or camera automatics. Check the hints in the result first and capture the cards
again in better light.

**Which reference values does the app use?** It ships an unofficial set (see below). You import your own
values in the gear menu.

**Can I change the language?** The app follows the language of your browser (English or German). You can
change it in the gear menu under "Language"; the choice is remembered in your browser.

**Is there a dark appearance?** Yes. In the gear menu under "Appearance" you choose System (follows
your device), Light or Dark; the choice is remembered in your browser. A dark screen throws less light
onto the cards, which can make the measurement steadier.

**Where does my data go?** Only into your browser. Imported reference sets are stored locally in
IndexedDB, nothing is sent anywhere. A project file with still images contains camera images; only pass
it on if that is fine.

## Reference values of the cards

The app ships a reference set with the Lab values of the 48 color patches. It is **not a manufacturer
file**: Datacolor does not publish the values in machine-readable form. The set is an unofficial
transcription from the blog post
[Patch color definitions for Datacolor SpyderCheckr 48](https://www.bartneck.de/2017/10/24/patch-color-definitions-for-datacolor-spydercheckr-48/)
(bartneck.de). The post itself mentions typos for some patches, they are corrected in the file. Whether
the values match your card exactly (batch, aging) is not proven.

In the gear menu ⚙ under "Reference values" you switch the set or import your own file. With
**Download set** you save the active set as a JSON file that can be imported again.

Supported formats (Lab values with white point D50, per patch ID such as `1A` to `6H`; digit = row,
letter = column, card 1 = columns A–D, card 2 = columns E–H):

- **JSON:** `{ "format": "cam_gradr-reference/1", "name": "My set", "illuminant": "D50",
"patches": [{ "id": "1A", "lab": [L, a, b] }, …] }`
- **CSV:** columns `id; L; a; b` (separator semicolon, tab or comma, optional header line, with
  semicolon also a decimal comma).

At least 12 patches are required, at least 4 of them neutral (gray ramps, columns D and E). Stored sets
can be selected and deleted in the app.

## Known limits

- The patch positions in the layout and the thresholds of the brightness assessment come from photos of
  the cards and are not verified on every card.
- The correction model (curves per channel plus a 3×3 matrix) only partly compensates a strongly
  falsifying webcam; a good shot matters more than a stronger model.
- Without WebGL2 the preview draws in a reduced software rendering.

## For developers

Node.js 22 is required (see `.nvmrc`).

```bash
npm ci               # install dependencies
npm run dev          # start the development server
npm run build        # production build
npm run verify       # all checks (lint, typecheck, knip, tests with coverage)
npm run e2e:install  # once: install Firefox for the acceptance tests (Chrome must be present)
npm run e2e          # Playwright acceptance tests (builds the app and starts it)
npm run verify:all   # verify and e2e together
```

### Translations

All texts live in `src/lang/<language>/<area>.json`, separate from the code; English (`src/lang/en`) is the
reference. To add a language, copy the `en` folder, translate the files, and register the language in
`src/lang/locales.ts` and `src/lang/index.ts`. The tests check that every language has the same keys and
placeholders as English.

Workflow, quality requirements, technology and releases are in [CONTRIBUTING.md](CONTRIBUTING.md), the
plan and decisions in [PLAN.md](PLAN.md), the changes in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). The license applies to the source code. The bundled reference set comes from a foreign,
unofficial source (see above) and is not covered by this license.
