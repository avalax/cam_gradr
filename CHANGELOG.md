# Changelog

## [1.11.1](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.11.0...cam-gradr-v1.11.1) (2026-11-07)


### Bug Fixes

* **ui:** draw the settings gear as a line icon ([#98](https://github.com/avalax/cam_gradr/issues/98)) ([c57c7fb](https://github.com/avalax/cam_gradr/commit/c57c7fb26ee8177fd500cbc54b8a180556e53036))

## [1.11.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.10.0...cam-gradr-v1.11.0) (2026-11-07)


### Features

* **project:** save the imported look LUTs in the project file ([#94](https://github.com/avalax/cam_gradr/issues/94)) ([a2bac52](https://github.com/avalax/cam_gradr/commit/a2bac52eb48f3fcdb8498783f4026c88456d10fd))
* **ui:** switch the look LUT at once with the arrow keys ([#95](https://github.com/avalax/cam_gradr/issues/95)) ([cdf03c6](https://github.com/avalax/cam_gradr/commit/cdf03c625152196f0c59559385246b6bb8cf946b))
* **ui:** switch the preview sides with a click on their labels ([#96](https://github.com/avalax/cam_gradr/issues/96)) ([6d30b92](https://github.com/avalax/cam_gradr/commit/6d30b92534a73419907a94c86b8e6b8022e6cd83))

## [1.10.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.9.0...cam-gradr-v1.10.0) (2026-11-06)


### Features

* **ui:** lay a look LUT over the correction ([#93](https://github.com/avalax/cam_gradr/issues/93)) ([345ef58](https://github.com/avalax/cam_gradr/commit/345ef58113860f62cd59a10bc12edf6ff8ff6712))
* **ui:** take the preview still image from the image corner ([#91](https://github.com/avalax/cam_gradr/issues/91)) ([112a648](https://github.com/avalax/cam_gradr/commit/112a6485fd92a5d9ac54f469d321e3543db25218))

## [1.9.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.8.0...cam-gradr-v1.9.0) (2026-11-04)


### Features

* **ui:** show the version of the app ([#82](https://github.com/avalax/cam_gradr/issues/82)) ([40f5acc](https://github.com/avalax/cam_gradr/commit/40f5accb01b016cd534bf5fff635863b76396fe7))

## [1.8.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.7.1...cam-gradr-v1.8.0) (2026-11-04)


### Features

* **solve:** fine-tune each hue after the matrix ([#78](https://github.com/avalax/cam_gradr/issues/78)) ([368becf](https://github.com/avalax/cam_gradr/commit/368becf8cb1f92c985d44d872c884c717d07a5c6))

## [1.7.1](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.7.0...cam-gradr-v1.7.1) (2026-11-04)


### Bug Fixes

* **preview:** draw an unchanged still image only once ([#71](https://github.com/avalax/cam_gradr/issues/71)) ([a58e5c1](https://github.com/avalax/cam_gradr/commit/a58e5c175c5e1b827ffad6d86de52e25901c27f0))
* **solve:** let the matrix keep more of the saturation ([#72](https://github.com/avalax/cam_gradr/issues/72)) ([bba9662](https://github.com/avalax/cam_gradr/commit/bba9662447dc5c7be693cd1c95f662a93c28fc47))

## [1.7.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.6.0...cam-gradr-v1.7.0) (2026-11-04)


### Features

* always correct contrast and gamma ([#65](https://github.com/avalax/cam_gradr/issues/65)) ([ad9be58](https://github.com/avalax/cam_gradr/commit/ad9be58d8c214e392c39d44681b7aa8093ba105a))
* never cut off different colors at the same value ([#68](https://github.com/avalax/cam_gradr/issues/68)) ([98e500c](https://github.com/avalax/cam_gradr/commit/98e500cdecccd3db196c2935de783d282bc27fc1))

## [1.6.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.5.1...cam-gradr-v1.6.0) (2026-11-03)


### Features

* corner points without numbers ([#59](https://github.com/avalax/cam_gradr/issues/59)) ([1a1c409](https://github.com/avalax/cam_gradr/commit/1a1c4093bae34795414244584bccd895e194bba5))
* saving suggests the project file loaded or saved last ([#60](https://github.com/avalax/cam_gradr/issues/60)) ([439db0d](https://github.com/avalax/cam_gradr/commit/439db0d44bbdbdded42efbda79edd7bf901842ae))

## [1.5.1](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.5.0...cam-gradr-v1.5.1) (2026-11-03)


### Bug Fixes

* correct grays colorimetrically, keep clipped white and check at the shot's exposure ([#53](https://github.com/avalax/cam_gradr/issues/53)) ([1fcd5ad](https://github.com/avalax/cam_gradr/commit/1fcd5ad54292da5089899ed7399822f383d405f8))
* find the card edges at full resolution and measure the layouts on real stills ([#56](https://github.com/avalax/cam_gradr/issues/56)) ([91135d2](https://github.com/avalax/cam_gradr/commit/91135d2b087cd06b5e56c4ef166ff3555e6a58db))
* measure against the color the correction can show and warn only on real clipping ([#55](https://github.com/avalax/cam_gradr/issues/55)) ([29c3dde](https://github.com/avalax/cam_gradr/commit/29c3ddef1e537f69bd48af8a4b5e0e86dfa8794b))

## [1.5.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.4.0...cam-gradr-v1.5.0) (2026-10-23)

The app has a dark appearance, the two wipes are labeled the same way, and wrong cards are shown on the frame around them.

### Features

* **ui:** new dark appearance. In the gear menu under "Appearance" you choose System (follows your device), Light or Dark; the choice is remembered. A dark screen throws less light onto the cards, so the measurement can be steadier. The image lies on its own surface, the brightness field of the gray cards is much dimmer, and the divider and the frame around the cards keep their colors
* **ui:** a header above the preview image and above the color cards' wipe names the two sides, "Kamera" and "Korrigiert", with a grey and a green dot. It follows the divider, and at the edge only one side is shown
* **cards:** the gray cards and color cards tabs have a band above the image ("Livebild" or "Standbild"), so all four tabs are equally high
* **cards:** wrong cards, for example color cards in the gray cards tab, turn the frame red and show a short label on it instead of a line under the image. The label goes away with the cards, and the wrong cards are not captured again and again

## [1.4.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.3.0...cam-gradr-v1.4.0) (2026-10-23)

The color correction looks more natural: shadows and highlights keep their detail, saturated colors no longer glare, and the preview starts with the image of your color measurement.

### Features

* the preview shows the image of the color measurement by default, as long as it is available

### Bug Fixes

* **color:** the tone curve no longer lifts the shadows or clips the highlights, and it is smoother, so details in saturated colors such as a red sweater are kept
* **color:** the color matrix is fine-tuned for the color deviation, and colors outside the sRGB range are desaturated instead of clipped in single channels, so yellows no longer collapse and blues no longer glare
* **cards:** gray cards are recognized again under a strong color cast of the camera (for example a bluish room)

## [1.3.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.2.0...cam-gradr-v1.3.0) (2026-10-22)


The cards no longer have to be held close to the lens: hold them where the subject will be, whatever their size in the image.

### Features

* **cards:** the fixed guide frames are gone. As soon as the app recognizes a card, one frame is drawn around everything found: white with a dark edge and pulsing until the cards are held steady, then a green line draws itself around both while the still image is captured
* **cards:** cards are found down to about 12 % of the image height (before about 20 %)

### Bug Fixes

* the wrong kind of cards is rejected, for example color cards in the gray cards tab or the other way round, with a message and the search continues
* the notes about rotated cards, the captured still image and too small cards are gone; the intro texts no longer mention the fixed frames

## [1.2.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.1.0...cam-gradr-v1.2.0) (2026-10-20)

The color correction can leave contrast and gamma alone, the card detection is more reliable and the wipe sliders are easier to read.

### Features

* **color:** new option "Contrast and gamma" (on by default) in the preview and the export tab, one shared setting. Switched off, the correction only balances the color and keeps the brightness; it applies to the `.cube` export and is saved in the project
* **ui:** the wipe slider has a round handle with a double arrow, and a legend under the preview image says which side is the original and which the corrected one

### Bug Fixes

* the cards are detected more reliably and the exposure of the shot is kept in the correction, so the result looks natural instead of filtered
* the preview no longer turns cyan after toggling the correction, and the original can always be reached again
* the gray tiles in the gray cards tab no longer jump when the correction is toggled
* the tab status scale uses all four bars instead of two states
* the wipe over the color cards is hidden as long as there is no still image, because there is nothing to compare yet

## [1.1.0](https://github.com/avalax/cam_gradr/compare/cam-gradr-v1.0.0...cam-gradr-v1.1.0) (2026-10-20)


The app speaks English and German, and the whole repository is now English.

### Features

* **i18n:** the app follows the browser language (English or German); the gear menu has a new "Language" section whose choice is remembered in the browser, and numbers follow the language
* **i18n:** all texts moved out of the code into `src/lang/<language>/<area>.json`, with English as the reference and tests that keep every language in step; a new language is added by copying the folder
* **docs:** the readme is written for users and links the published app; all documentation, code comments, test titles and e2e scenarios are English, only the German localization stays German

### Changes

* the `.cube` header now reads "Generated by cam_gradr" and project files are named `cam_gradr-project.json`

## 1.0.0 (2026-10-19)

First release. The app turns a webcam image of the Datacolor Spyder Checkr Photo cards into a 3D LUT.

### Features

* **camera:** live view with camera and resolution choice, one on/off switch and a still image averaged over several frames
* **chart:** the cards are found in the live image by themselves; the app takes the still image, sets the corner points and switches the camera off. The corners stay draggable, cards held upside down are recognized and the fields are assigned accordingly. A camera start looks for new cards; without a new still the old image and its corners return. Measuring happens only on stills
* **ui:** measuring field for brightness and contrast on the gray cards, with a hint what to change
* **color:** automatic color correction from the color cards (tone curves per channel plus a 3x3 matrix); the result per patch appears as a popup
* **ui:** wipe over both color cards (camera colors against corrected colors), the same wipe in the preview
* **lut:** 3D LUT, preview with WebGL2 (software fallback) and a side column with color tiles and a gray wedge
* **ui:** folder tabs that show their result with a small gauge, gray placeholders while there is no image, and every tab keeps its own still image
* **export:** `.cube` export (17³, 33³, 65³) with a preview of the LUT and the estimated file size
* **project:** save and load the work as JSON, optionally with the still images and their corner points
* **reference:** bundled unofficial Spyder Checkr 48 reference set and import of own sets (JSON or CSV)
* **ui:** settings menu with fold-out sections for camera and reference values
* scaffold project with tooling, CI and release pipeline
