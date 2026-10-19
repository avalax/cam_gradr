# Changelog

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


### Bug Fixes

* **camera:** wait for the first video frame before capturing a still and never hang on missing frames
* **chart:** find the cards in bright webcam images, fit the guide frames to a real card, sort and number the corner points
* **layout:** measure the fields of the right gray card
* **solve:** pool neutral patches the camera cannot tell apart before building the curves
* **preview:** software fallback when WebGL2 is missing
