import { readFileSync } from 'node:fs';

import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { dummyReferenceJson } from '../../src/test-support/dummy-reference';

import { showScene } from './camera-stub';
import { CARD_PIXELS, HEIGHT, WIDTH } from './synthetic-cards';
import type { SceneName } from './synthetic-cards';

// Eckpunkte in der Klickreihenfolge der App: linke Karte (3), dann rechte Karte (4);
// je Karte oben links, oben rechts, unten rechts, unten links.
function cornerOrder(clickOrder: readonly number[]): [number, number][] {
  const corners: [number, number][] = [];
  for (const card of [CARD_PIXELS[3], CARD_PIXELS[4]]) {
    const quad: [number, number][] = [
      [card.x, card.y],
      [card.x + card.w, card.y],
      [card.x + card.w, card.y + card.h],
      [card.x, card.y + card.h],
    ];
    // clickOrder: Indizes der Ecken (0 = oben links, 1 = oben rechts, 2 = unten rechts, 3 = unten links).
    corners.push(
      ...clickOrder.map((index) => quad.at(index)).filter((corner) => corner !== undefined),
    );
  }
  return corners;
}

// Seitenobjekt der App: kapselt Bedienung und Lesen der Oberfläche für die Akzeptanztests.
export class AppPage {
  readonly overlay: Locator;
  readonly scale: Locator;
  readonly details: Locator;

  constructor(readonly page: Page) {
    this.overlay = page.locator('svg.absolute');
    this.scale = page.getByTestId('measure-field');
    this.details = page.getByTestId('measure-details');
  }

  // Fährt über das Messfeld und prüft den Text der Detailanzeige.
  async expectVerdict(text: string | RegExp): Promise<void> {
    await this.scale.hover();
    await expect(this.details).toBeVisible();
    await expect(this.details).toContainText(text);
  }

  get autoDetect(): Locator {
    return this.page.getByLabel('Karten im Livebild automatisch erkennen');
  }

  // Öffnet die App. Die Automatik im Livebild ist aus, damit die Tests selbst entscheiden, wann ein
  // Standbild aufgenommen wird; `autoDetect: true` lässt sie an.
  async open(options: { autoDetect?: boolean } = {}): Promise<void> {
    await this.page.goto('/');
    if (options.autoDetect !== true) {
      await this.autoDetect.uncheck();
    }
  }

  // Schaltet die Automatik nach einem Neuladen wieder aus.
  async disableAutoDetect(): Promise<void> {
    await this.autoDetect.uncheck();
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }

  get cameraSwitch(): Locator {
    return this.page.getByRole('switch', { name: 'Kamera', exact: true });
  }

  // Schaltet die Kamera mit dem Schalter neben den Tabs an und wartet auf das Livebild.
  async startCamera(): Promise<void> {
    await this.cameraSwitch.click();
    await expect(this.cameraSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(this.cameraSwitch).toHaveAttribute('data-status', 'live');
  }

  // Schaltet die Kamera mit dem Schalter wieder aus.
  async stopCamera(): Promise<void> {
    await this.cameraSwitch.click();
    await expect(this.cameraSwitch).toHaveAttribute('aria-checked', 'false');
  }

  // Kamera anschalten und im Tab "Graukarten" auf die Aufnahme warten (Standardweg für Schritt 1).
  async startGrayStage(): Promise<void> {
    await this.startCamera();
    await this.openTab('Graukarten');
    await expect(this.button('Standbild aufnehmen')).toBeEnabled();
  }

  async openTab(name: 'Graukarten' | 'Farbkarten' | 'Vorschau' | 'Export'): Promise<void> {
    await this.page.getByRole('tab', { name, exact: true }).click();
    await expect(this.page.getByRole('tab', { name, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }

  async captureStill(): Promise<void> {
    await this.button(/Standbild aufnehmen/).click();
    await expect(this.button('Zurück zum Livebild')).toBeVisible();
  }

  // Hält andere Karten vor die Kamera (z. B. nach Schritt 1 die Farbkarten).
  async showCards(scene: SceneName): Promise<void> {
    await showScene(this.page, scene);
  }

  // Graukarten komplett: Kamera an, Graukarten aufnehmen, Eckpunkte setzen, weiter zu den Farbkarten.
  async completeStepOne(): Promise<void> {
    await this.open();
    await this.startGrayStage();
    await this.captureStill();
    await this.placeAllCorners();
    await this.expectVerdict('im Normalbereich');
    await this.button('Weiter zu den Farbkarten').click();
    await expect(this.page.getByText('Dieser Tab berechnet die Farbkorrektur')).toBeVisible();
  }

  // Komplett bis zur berechneten Farbkorrektur: Graukarten, Referenzwerte, Farbkarten, Berechnung.
  async computeColorModel(): Promise<void> {
    await this.completeStepOne();
    await this.importReference('referenz.json', dummyReferenceJson());
    await expect(this.page.getByTestId('reference-saved')).toBeVisible();
    await this.closeSettings();
    await this.captureColorCards();
    await expect(this.page.getByTestId('report')).toBeVisible();
  }

  // Klickt einen Knopf, der eine Datei herunterlädt, und liefert Dateiname und Inhalt.
  async download(trigger: Locator): Promise<{ fileName: string; text: string }> {
    const [download] = await Promise.all([this.page.waitForEvent('download'), trigger.click()]);
    return {
      fileName: download.suggestedFilename(),
      text: readFileSync(await download.path(), 'utf8'),
    };
  }

  // Lädt eine Projektdatei über das Zahnrad-Menü (es schließt sich danach von selbst).
  async loadProject(text: string): Promise<void> {
    await this.openSettings();
    await this.page.getByTestId('project-file').setInputFiles({
      name: 'projekt.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
  }

  // Liest einen Pixel (RGB 0..255) der Vorschau; der WebGL-Inhalt wird dazu in ein 2D-Canvas kopiert.
  async previewPixel(x: number, y: number): Promise<[number, number, number]> {
    return this.page.evaluate(
      ([px = 0, py = 0]) => {
        const source = document.querySelector<HTMLCanvasElement>('[data-testid="preview-canvas"]');
        if (source === null) {
          throw new Error('Die Vorschau fehlt.');
        }
        // Die Koordinaten beziehen sich auf das Kamerabild (1280 Pixel breit); die Software-
        // Darstellung zeichnet kleiner und wird entsprechend umgerechnet.
        const scale = source.width / 1280;
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        if (context === null) {
          throw new Error('Kein 2D-Kontext.');
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

  // Womit die Vorschau zeichnet: 'webgl2' (Grafikkarte) oder 'cpu' (Software-Darstellung).
  async previewRenderer(): Promise<string | null> {
    return this.page.getByTestId('preview-renderer').getAttribute('data-renderer');
  }

  // Wartet, bis die Vorschau an der Stelle die erwartete Farbe zeigt; die Meldung nennt bei einem
  // Fehlschlag die tatsächliche Abweichung und die Darstellungsart.
  async expectPreviewColor(
    x: number,
    y: number,
    expected: readonly number[],
    tolerance: number,
  ): Promise<void> {
    let last = 'noch kein Pixel gelesen';
    try {
      await expect
        .poll(async () => {
          const pixel = await this.previewPixel(x, y);
          const deviation = Math.max(
            ...expected.map((value, index) => Math.abs((pixel[index] ?? 0) - value)),
          );
          last = `Pixel ${pixel.join(',')}, erwartet ${expected.join(',')}, Darstellung ${String(await this.previewRenderer())}`;
          return deviation;
        })
        .toBeLessThanOrEqual(tolerance);
    } catch (error) {
      throw new Error(`${(error as Error).message}\n${last}`, { cause: error });
    }
  }

  // Öffnet das Zahnrad-Menü (Referenzwerte, Projekt), falls es noch zu ist.
  async openSettings(): Promise<void> {
    const panel = this.page.getByTestId('settings-panel');
    if (!(await panel.isVisible())) {
      await this.page.getByTestId('settings-button').click();
    }
    await expect(panel).toBeVisible();
  }

  // Schließt das Zahnrad-Menü, damit es nichts verdeckt.
  async closeSettings(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByTestId('settings-panel')).toBeHidden();
  }

  // Speichert das Projekt über das Zahnrad-Menü und liefert Dateiname und Inhalt.
  async saveProject(): Promise<{ fileName: string; text: string }> {
    await this.openSettings();
    return this.download(this.page.getByTestId('project-save'));
  }

  // Importiert eine Referenzdatei über das Dateifeld im Zahnrad-Menü (das Menü bleibt offen).
  async importReference(fileName: string, content: string): Promise<void> {
    await this.openSettings();
    await this.page.getByTestId('reference-file').setInputFiles({
      name: fileName,
      mimeType: fileName.endsWith('.json') ? 'application/json' : 'text/csv',
      buffer: Buffer.from(content),
    });
  }

  // Farbkarten aufnehmen und Eckpunkte setzen (Schritt 2, Kamera läuft bereits).
  async captureColorCards(): Promise<void> {
    await this.showCards('colors');
    await this.captureStill();
    await this.placeAllCorners();
  }

  // Umgebendes Rechteck eines Feldumrisses (z. B. 'G18', 'S4-0') in Bildschirmkoordinaten.
  async shapeBox(key: string): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.page.locator(`polygon[data-shape="${key}"]`).boundingBox();
    if (box === null) {
      throw new Error(`Umriss ${key} ist nicht sichtbar.`);
    }
    return box;
  }

  // Klickt die acht Eckpunkte der beiden Karten auf dem Standbild, je Karte in der gewünschten Reihenfolge.
  async placeAllCorners(clickOrder: readonly number[] = [0, 1, 2, 3]): Promise<void> {
    await this.overlay.scrollIntoViewIfNeeded();
    const box = await this.overlay.boundingBox();
    if (box === null) {
      throw new Error('Das Overlay ist nicht sichtbar.');
    }
    for (const [x, y] of cornerOrder(clickOrder)) {
      await this.page.mouse.click(
        box.x + (x / WIDTH) * box.width,
        box.y + (y / HEIGHT) * box.height,
      );
    }
    await expect(this.page.locator('svg circle')).toHaveCount(8);
  }
}
