# cam_gradr

**Correct the colors of your webcam with the Datacolor Spyder Checkr Photo.** Hold the cards in front of
the camera: the app helps you set the light, measures the colors and calculates a 3D LUT that corrects
them. You download the LUT as a `.cube` file for a camera monitor or video software.

**Open the app: <https://avalax.github.io/cam_gradr/>**

Everything runs in your browser. Images and measurements never leave your computer.

## What you need

- a webcam and the **Datacolor Spyder Checkr Photo** (two gray cards and two color cards with 48 patches)
- a current Chrome, Edge or Firefox
- even light on the cards, without reflections and shadows

## How it works

1. **Prepare the camera.** Lock auto exposure and auto white balance in the camera's own software; the
   app cannot do that, and automatic adjustments falsify the measurement. Choose the camera and the
   resolution in the gear menu ⚙ (1280 × 720 is a good start) and switch the camera on at the top right.
2. **Gray cards: set the light.** Hold both gray cards steady where the subject will be. The app finds
   them, takes a still image and switches the camera off. A dot in the measuring field next to the image
   shows brightness (vertical) and contrast (horizontal). Change the light or the camera and start the
   camera again until the dot sits in the framed window in the middle; hover the field for details.
3. **Color cards: calculate the correction.** Without changing the light or the camera, hold both color
   cards in the same place. The correction is calculated by itself. A wipe slider compares the camera
   colors with the corrected ones, and the label below gives the mean deviation before and after (hover
   it for each patch).
4. **Preview: check the result.** The camera image with the original left and the corrected image right
   of a divider that you drag or move with the arrow keys; with the camera off it shows the still image
   of the color cards. The side column shows each colored patch as target, camera and corrected and
   names the largest deviations; switched to the grays it shows the gray ramp and how shadows, midtones
   and highlights change. "Take still image" checks the correction on a steady image.
5. **Export: download the LUT.** Choose 17³, 33³ or 65³ and download the `.cube` file. Larger LUTs are
   more accurate, but some devices only accept 17³ or 33³ (see their manual).

You can switch between the tabs at any time. Below each name is a short result with four bars: green
means good (light in the normal range, or a mean deviation of at most 2 after the correction), yellow
means check the hint.

**Corner points:** You can drag them on the still image. The trash icon in the corner of the image
deletes them and starts a new search. Starting the camera searches again too; if it stops without a new
still image, the old one comes back. Cards held upside down are recognized.

**Projects:** In the Export tab, "Save project" and "Load project" keep your work as a JSON file, with
the still images if "Include still images" stays checked. Saving suggests the file you loaded last. The
file holds only the name of the reference set, not its values.

## Tips

- Hold the cards steady, completely in the image and parallel to the camera. Blurred shots are not
  recognized.
- Light both cards evenly. Light from the side and reflections falsify the colors.
- The brightest gray patches must not burn out and the darkest must not sink into black. Fix the
  brightness first, then the contrast.
- After the gray cards, change neither the light nor the camera settings.
- The dark appearance (⚙ → Appearance) throws less light from the screen onto the cards.

## Questions

**The camera does not start.** Allow camera access in the browser and close other programs that use the
camera.

**The cards are not recognized.** Hold them completely in the image, steady and well lit. The app takes
the still image as soon as it finds the cards twice in a row in the same place.

**The deviation stays high.** Usually the shot is the cause: burnt-out or black patches, uneven light or
camera automatics. Read the hints in the result and capture the cards again.

**Can I change the language?** The app follows your browser (English or German). You can change it in
⚙ → Language.

**Which version do I have?** The line at the bottom of the page names it, and so does the first line of
every `.cube` file. A preview of a pull request adds its number.

**Where does my data go?** Nowhere. Imported reference sets stay in your browser. A project file with
still images contains camera images; only pass it on if that is fine.

## Reference values

The app ships the Lab values of the 48 color patches. They are **not from Datacolor**, who does not
publish them in machine-readable form, but an unofficial transcription from the blog post
[Patch color definitions for Datacolor SpyderCheckr 48](https://www.bartneck.de/2017/10/24/patch-color-definitions-for-datacolor-spydercheckr-48/)
(bartneck.de), with the typos the post mentions corrected. Whether they match your card exactly (batch,
aging) is not proven.

In ⚙ → Reference values you switch the set, import your own file or download the active set. A file
holds Lab values (white point D50) per patch ID `1A` to `6H` (digit = row, letter = column; card 1 =
columns A–D, card 2 = E–H), at least 12 patches with at least 4 neutral ones (columns D and E):

- **JSON:** `{ "format": "cam_gradr-reference/1", "name": "My set", "illuminant": "D50",
"patches": [{ "id": "1A", "lab": [L, a, b] }, …] }`
- **CSV:** columns `id; L; a; b` (separated by semicolon, tab or comma, optional header line; with
  semicolons also a decimal comma)

## Known limits

- The correction (a tone curve per channel, a 3×3 matrix and a fine adjustment per hue) only partly
  makes up for a webcam that distorts colors strongly. A good shot matters more.
- The LUT works in sRGB / Rec.709, the color space of webcams and HDMI video. The cyan 1F and the yellow
  3F lie outside it; the app measures them against the nearest color sRGB can show.
- The correction never cuts colors off. Where it would push the most saturated colors out of sRGB or
  bright tones above white, it compresses them in proportion, so colors right at the edge of sRGB come
  out slightly less saturated than the reference.
- The LUT is calculated from the image as the browser decodes it. If the device that applies the LUT
  decodes the signal differently (BT.601 instead of BT.709, limited instead of full range), the LUT does
  not fit exactly; check the result there.
- The patch positions are measured on one SCK300 card with three webcams; other batches are not
  verified.
- Without WebGL2 the preview uses a slower, downscaled rendering.

## License

[MIT](LICENSE) for the source code. The bundled reference set comes from an unofficial third-party source
and is not covered by it.
