import { expect, test } from './support/fixtures';

// Acceptance tests of the layout: sizes and positions only a real browser computes. What the tabs,
// the camera switch and the gear menu do is covered by the component tests.

// The column next to the image on the tabs with a camera image.
const SIDE_COLUMNS = {
  Graukarten: 'measure-field',
  Farbkarten: 'color-wipe',
  Vorschau: 'preview-side',
} as const;

test.describe('Layout', () => {
  test('Image, side column and content area have the same size on all tabs', async ({ app }) => {
    await app.open();
    const boxes: unknown[] = [];
    const heights: number[] = [];
    for (const [tab, column] of Object.entries(SIDE_COLUMNS)) {
      await app.openTab(tab as keyof typeof SIDE_COLUMNS);
      heights.push(await app.panelHeight());
      boxes.push(
        await app.page.getByTestId('image-block').first().boundingBox(),
        await app.page.getByTestId(column).boundingBox(),
      );
    }
    await app.openTab('Export');
    heights.push(await app.panelHeight());
    expect(boxes[0]).not.toBeNull();
    for (const [index, box] of boxes.entries()) {
      expect(box).toEqual(boxes[index % 2]);
    }
    expect(heights[0]).toBeGreaterThan(0);
    for (const height of heights) {
      expect(Math.abs(height - (heights[0] ?? 0))).toBeLessThanOrEqual(1);
    }

    // The export follows the window as the image does, also when the window changes while the export
    // is open: on a wide, low window the height limits the image.
    await app.page.setViewportSize({ width: 1920, height: 720 });
    const exportHeight = await app.panelHeight();
    expect(exportHeight).not.toBe(heights[0]);
    await app.openTab('Graukarten');
    expect(Math.abs((await app.panelHeight()) - exportHeight)).toBeLessThanOrEqual(1);
    // There the image is narrower than its track: the column beside it keeps its place on every tab,
    // where the export has its project card.
    const grayColumn = await app.page.getByTestId('measure-field').boundingBox();
    await app.openTab('Vorschau');
    expect(await app.page.getByTestId('preview-side').boundingBox()).toEqual(grayColumn);
    await app.openTab('Export');
    const projectCard = await app.page
      .getByRole('article', { name: 'Projekt speichern' })
      .boundingBox();
    expect(Math.abs((projectCard?.x ?? 0) - (grayColumn?.x ?? -1))).toBeLessThanOrEqual(1);
  });

  test('The image keeps its size while the camera starts and captures, and fits on one screen', async ({
    app,
  }) => {
    await app.open();
    // Remembers every size of the image that occurs during the start and the capture.
    const watcher = await app.page.evaluateHandle(() => {
      const sizes: string[] = [];
      const tick = (): void => {
        const box = document.querySelector('[data-testid="stage-image"]')?.getBoundingClientRect();
        const size =
          box === undefined
            ? 'missing'
            : `${String(Math.round(box.width))}x${String(Math.round(box.height))}`;
        if (sizes.at(-1) !== size) {
          sizes.push(size);
        }
        requestAnimationFrame(tick);
      };
      tick();
      return sizes;
    });
    await app.startGrayStage();
    await app.captureStill();
    await app.expectCorners();

    // Nothing flickers.
    const sizes = await watcher.jsonValue();
    expect(sizes).toHaveLength(1);
    expect(sizes[0]).toMatch(/^[1-9]\d*x[1-9]\d*$/);

    // On a tall window the image uses the width: window width minus margins, frame around the
    // content, control column (21 rem) and measuring field.
    for (const [width, height, minImageWidth] of [
      [1280, 720, 0],
      [1366, 768, 0],
      [1600, 700, 0],
      [1920, 900, 0],
      [1600, 1200, 950],
    ] as const) {
      await app.page.setViewportSize({ width, height });
      await expect(
        async () => {
          const image = await app.image.boundingBox();
          expect(image?.y).toBeGreaterThan(0);
          expect((image?.y ?? 0) + (image?.height ?? 0)).toBeLessThanOrEqual(height);
          expect(await app.pageOverflow()).toBeLessThanOrEqual(0);
          expect(image?.width).toBeGreaterThan(minImageWidth);
        },
        `${String(width)}×${String(height)}`,
      ).toPass();
    }
  });
});
