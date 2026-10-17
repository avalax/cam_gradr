import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

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
    this.scale = page.getByTestId('brightness-scale');
    this.details = page.getByTestId('scale-details');
  }

  // Fährt über die Helligkeitsskala und prüft den Text der Detailanzeige.
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

  // Wechselt in den Tab "Kamera", schaltet die Kamera an und wartet auf das Livebild.
  async startCamera(): Promise<void> {
    await this.openTab('Kamera');
    await this.button('Kamera an').click();
    await expect(this.page.getByText('Aktive Auflösung')).toBeVisible();
    await expect(this.button('Standbild aufnehmen')).toBeEnabled();
  }

  // Kamera anschalten und in den Tab "Graukarten" wechseln (Standardweg für Schritt 1).
  async startGrayStage(): Promise<void> {
    await this.startCamera();
    await this.openTab('Graukarten');
    await expect(this.button('Standbild aufnehmen')).toBeEnabled();
  }

  async openTab(name: 'Kamera' | 'Graukarten' | 'Farbkarten' | 'Vorschau'): Promise<void> {
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
    await this.expectVerdict('Die Raumhelligkeit passt');
    await this.button('Weiter zu den Farbkarten').click();
    await expect(this.page.getByText('Dieser Tab berechnet die Farbkorrektur')).toBeVisible();
  }

  // Liest einen Pixel (RGB 0..255) der Vorschau; der WebGL-Inhalt wird dazu in ein 2D-Canvas kopiert.
  async previewPixel(x: number, y: number): Promise<[number, number, number]> {
    return this.page.evaluate(
      ([px = 0, py = 0]) => {
        const source = document.querySelector<HTMLCanvasElement>('[data-testid="preview-canvas"]');
        if (source === null) {
          throw new Error('Die Vorschau fehlt.');
        }
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        if (context === null) {
          throw new Error('Kein 2D-Kontext.');
        }
        context.drawImage(source, 0, 0);
        const data = context.getImageData(Math.round(px), Math.round(py), 1, 1).data;
        return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0] as [number, number, number];
      },
      [x, y],
    );
  }

  // Importiert eine Referenzdatei über das Dateifeld in Schritt 2.
  async importReference(fileName: string, content: string): Promise<void> {
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
