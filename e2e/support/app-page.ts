import { readFileSync } from 'node:fs';

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { dummyReferenceJson } from '../../src/test-support/dummy-reference';

import { setScene, showScene } from './camera-stub';
import type { SceneName } from './synthetic-cards';

// Page object of the app: wraps operating and reading the interface for the acceptance tests.
export class AppPage {
  readonly overlay: Locator;
  readonly scale: Locator;
  readonly details: Locator;

  constructor(readonly page: Page) {
    this.overlay = page.locator('svg.absolute');
    this.scale = page.getByTestId('measure-field');
    this.details = page.getByTestId('measure-details');
  }

  // Hovers over the measuring field and checks the text of the detail display.
  async expectVerdict(text: string | RegExp): Promise<void> {
    await this.scale.hover();
    await expect(this.details).toBeVisible();
    await expect(this.details).toContainText(text);
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }

  get cameraSwitch(): Locator {
    return this.page.getByTestId('camera-toggle');
  }

  // Turns the camera on with the switch next to the tabs and waits for the live image.
  async startCamera(): Promise<void> {
    await this.cameraSwitch.click();
    await expect(this.cameraSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(this.cameraSwitch).toHaveAttribute('data-status', 'live');
  }

  // Turns the camera off again with the switch.
  async stopCamera(): Promise<void> {
    await this.cameraSwitch.click();
    await expect(this.cameraSwitch).toHaveAttribute('aria-checked', 'false');
  }

  // Turn the camera on and open the "Graukarten" tab; the app detects the cards and captures by
  // itself.
  async startGrayStage(): Promise<void> {
    await this.startCamera();
    await this.openTab('Graukarten');
  }

  async openTab(name: 'Graukarten' | 'Farbkarten' | 'Vorschau' | 'Export'): Promise<void> {
    await this.page.getByRole('tab', { name, exact: true }).click();
    await expect(this.page.getByRole('tab', { name, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }

  // Opens the preview and turns the camera on if it is off, so that there is a live image.
  async openPreviewWithImage(): Promise<void> {
    await this.openTab('Vorschau');
    if ((await this.cameraSwitch.getAttribute('aria-checked')) !== 'true') {
      await this.startCamera();
    }
  }

  // Waits for the still image. In the card tabs the app captures it by itself as soon as it detects
  // the cards; only the preview has the button.
  async captureStill(): Promise<void> {
    const manual = this.button(/Standbild aufnehmen/);
    if ((await manual.count()) > 0) {
      await manual.click();
    }
    // After the capture (automatic or via the button in the preview) the app turns the camera off.
    await expect(this.cameraSwitch).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });
  }

  // Shows the result of the color correction: it appears as a popup when hovering the label in the
  // wipe.
  async showReport(): Promise<void> {
    await this.page.getByTestId('color-wipe-result').hover();
    await expect(this.page.getByTestId('report')).toBeVisible();
  }

  // Moves the mouse away so that the popup disappears and no longer covers anything.
  async hideReport(): Promise<void> {
    await this.page.mouse.move(0, 0);
    await expect(this.page.getByTestId('report')).toBeHidden();
  }

  // Holds other cards in front of the camera (e.g. the color cards after step 1).
  async showCards(scene: SceneName): Promise<void> {
    await showScene(this.page, scene);
  }

  // Gray cards complete: camera on, cards are detected and captured, then on to the color cards.
  async completeStepOne(): Promise<void> {
    await this.open();
    await this.startGrayStage();
    await this.captureStill();
    await this.expectCorners();
    await this.expectVerdict('im Normalbereich');
    await this.openTab('Farbkarten');
    await expect(this.page.getByText('Dieser Tab berechnet die Farbkorrektur')).toBeVisible();
  }

  // All the way to the computed color correction: gray cards, reference values, color cards,
  // calculation.
  async computeColorModel(): Promise<void> {
    await this.completeStepOne();
    await this.importReference('reference.json', dummyReferenceJson());
    await expect(this.page.getByTestId('reference-saved')).toBeVisible();
    await this.closeSettings();
    await this.captureColorCards();
    await expect(this.page.getByTestId('report')).toBeAttached();
  }

  // Clicks a button that downloads a file and returns the file name and content.
  async download(trigger: Locator): Promise<{ fileName: string; text: string }> {
    const [download] = await Promise.all([this.page.waitForEvent('download'), trigger.click()]);
    return {
      fileName: download.suggestedFilename(),
      text: readFileSync(await download.path(), 'utf8'),
    };
  }

  // Loads a project file via the Export tab.
  async loadProject(text: string): Promise<void> {
    await this.openTab('Export');
    await this.page.getByTestId('project-file').setInputFiles({
      name: 'project.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
  }

  // Reads one pixel (RGB 0..255) of the preview; the WebGL content is copied into a 2D canvas for
  // this.
  async previewPixel(x: number, y: number): Promise<[number, number, number]> {
    return this.page.evaluate(
      ([px = 0, py = 0]) => {
        const source = document.querySelector<HTMLCanvasElement>('[data-testid="preview-canvas"]');
        if (source === null) {
          throw new Error('The preview is missing.');
        }
        // The coordinates refer to the camera image (1280 pixels wide); the software rendering
        // draws smaller and is converted accordingly.
        const scale = source.width / 1280;
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        if (context === null) {
          throw new Error('No 2D context.');
        }
        context.drawImage(source, 0, 0);
        const data = context.getImageData(
          Math.round(px * scale),
          Math.round(py * scale),
          1,
          1,
        ).data;
        return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as [number, number, number];
      },
      [x, y],
    );
  }

  // What the preview draws with: 'webgl2' (graphics card) or 'cpu' (software rendering).
  async previewRenderer(): Promise<string | null> {
    return this.page.getByTestId('preview-renderer').getAttribute('data-renderer');
  }

  // Waits until the preview shows the expected color at the position; on failure the message names
  // the actual deviation and the rendering mode.
  async expectPreviewColor(
    x: number,
    y: number,
    expected: readonly number[],
    tolerance: number,
  ): Promise<void> {
    let last = 'no pixel read yet';
    try {
      await expect
        .poll(async () => {
          const pixel = await this.previewPixel(x, y);
          const deviation = Math.max(
            ...expected.map((value, index) => Math.abs((pixel[index] ?? 0) - value)),
          );
          last = `Pixel ${pixel.join(',')}, expected ${expected.join(',')}, renderer ${String(await this.previewRenderer())}`;
          return deviation;
        })
        .toBeLessThanOrEqual(tolerance);
    } catch (error) {
      throw new Error(`${(error as Error).message}\n${last}`, { cause: error });
    }
  }

  // Opens the gear menu if it is still closed. It shows the camera first; with `section` the
  // requested section expands (the sections are an accordion, only one is open at a time).
  async openSettings(section: 'camera' | 'reference' = 'camera'): Promise<void> {
    const panel = this.page.getByTestId('settings-panel');
    if (!(await panel.isVisible())) {
      await this.page.getByTestId('settings-button').click();
    }
    await expect(panel).toBeVisible();
    const header = this.page.getByTestId(`section-${section}`);
    if ((await header.getAttribute('aria-expanded')) !== 'true') {
      await header.click();
    }
    await expect(header).toHaveAttribute('aria-expanded', 'true');
  }

  // Closes the gear menu so that it does not cover anything.
  async closeSettings(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByTestId('settings-panel')).toBeHidden();
  }

  // Saves the project via the Export tab and returns the file name and content. By default the
  // still images are included in the file; `withStills: false` unticks the checkbox.
  async saveProject(
    options: { withStills?: boolean } = {},
  ): Promise<{ fileName: string; text: string }> {
    await this.openTab('Export');
    await this.page.getByTestId('project-stills').setChecked(options.withStills !== false);
    return this.download(this.page.getByTestId('project-save'));
  }

  // Imports a reference file via the file field in the gear menu (the menu stays open).
  async importReference(fileName: string, content: string): Promise<void> {
    await this.openSettings('reference');
    await this.page.getByTestId('reference-file').setInputFiles({
      name: fileName,
      mimeType: fileName.endsWith('.json') ? 'application/json' : 'text/csv',
      buffer: Buffer.from(content),
    });
  }

  // Holds up the color cards and waits for the capture and corner points (step 2, the camera is
  // already running).
  async captureColorCards(): Promise<void> {
    // After the automatic capture the camera is off: choose the scene first, then start, so that
    // the search does not find the old cards.
    await setScene(this.page, 'colors');
    if ((await this.cameraSwitch.getAttribute('aria-checked')) !== 'true') {
      await this.startCamera();
    }
    await this.showCards('colors');
    await this.captureStill();
    await this.expectCorners();
  }

  // Bounding box of a patch outline (e.g. 'G18', 'S4-0') in screen coordinates.
  async shapeBox(key: string): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.page.locator(`polygon[data-shape="${key}"]`).boundingBox();
    if (box === null) {
      throw new Error(`Outline ${key} is not visible.`);
    }
    return box;
  }

  // Waits until the app has set the corner points of both cards (eight in total).
  async expectCorners(): Promise<void> {
    await expect(this.page.locator('svg circle')).toHaveCount(8);
  }
}
