import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { CARD_PIXELS, HEIGHT, WIDTH } from './synthetic-cards';

// Eckpunkte in der Klickreihenfolge der App: linke Karte (3), dann rechte Karte (4);
// je Karte oben links, oben rechts, unten rechts, unten links.
function cornerOrder(): [number, number][] {
  const corners: [number, number][] = [];
  for (const card of [CARD_PIXELS[3], CARD_PIXELS[4]]) {
    corners.push(
      [card.x, card.y],
      [card.x + card.w, card.y],
      [card.x + card.w, card.y + card.h],
      [card.x, card.y + card.h],
    );
  }
  return corners;
}

// Seitenobjekt der App: kapselt Bedienung und Lesen der Oberfläche für die Akzeptanztests.
export class AppPage {
  readonly overlay: Locator;
  readonly badge: Locator;

  constructor(readonly page: Page) {
    this.overlay = page.locator('svg.absolute');
    this.badge = page.getByTestId('badge');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }

  async startCamera(): Promise<void> {
    await this.button('Kamera starten').click();
    await expect(this.page.getByText('Aktive Auflösung')).toBeVisible();
    await expect(this.button('Standbild aufnehmen')).toBeEnabled();
  }

  async captureStill(): Promise<void> {
    await this.button(/Standbild aufnehmen/).click();
    await expect(this.button('Zurück zum Livebild')).toBeVisible();
  }

  // Klickt die acht Eckpunkte der beiden Karten auf dem Standbild.
  async placeAllCorners(): Promise<void> {
    const box = await this.overlay.boundingBox();
    if (box === null) {
      throw new Error('Das Overlay ist nicht sichtbar.');
    }
    for (const [x, y] of cornerOrder()) {
      await this.page.mouse.click(
        box.x + (x / WIDTH) * box.width,
        box.y + (y / HEIGHT) * box.height,
      );
    }
    await expect(this.page.locator('svg circle')).toHaveCount(8);
  }
}
