import { expect, test } from './support/fixtures';

// Acceptance test of the user story (tab "Graukarten"):
// "As a user I adjust the room brightness with the gray cards until the traffic light is green."
// The verdicts for too dark and too bright rooms, the search hint and holding the state while the
// camera runs are covered by the unit and component tests; here the real camera stream, the
// detection in the browser and the hover and focus styles count.
// The browser locale is de-DE by default, so the assertions check the German interface.

test.describe('Gray cards', () => {
  test('The app captures the cards by itself and rates the room, "Eckpunkte löschen" searches again', async ({
    app,
  }) => {
    await app.open();
    await app.startGrayStage();
    // No click: as soon as the cards are in the image, the app captures the still and turns the
    // camera off.
    await app.captureStill();
    await app.expectCorners();
    await expect(app.page.locator('canvas').first()).toBeVisible();
    await expect(app.page.getByTestId('measure-marker')).toBeVisible();

    // The details of the measuring field appear only on hover or keyboard focus.
    await expect(app.details).toBeHidden();
    await app.expectVerdict('im Normalbereich');
    await expect(app.details).toContainText('Lichter');
    await app.page.mouse.move(0, 0);
    await expect(app.details).toBeHidden();
    await app.scale.focus();
    await expect(app.details).toBeVisible();

    // Without cards in the image the new search keeps running, so its state can be checked; the
    // synthetic camera would otherwise find the cards again within about a second.
    await app.chooseCards('empty');
    await app.button('Eckpunkte löschen').click();
    await expect(app.page.locator('svg circle')).toHaveCount(0);

    await app.chooseCards('gray');
    await app.captureStill();
    await app.expectCorners();
    await app.expectVerdict('im Normalbereich');
  });
});
