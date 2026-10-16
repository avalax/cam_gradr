import type { CardLayout, ChartLayout, PatchLayout, Rect } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInsideCard(rect: Rect): boolean {
  return (
    rect.w > 0 &&
    rect.h > 0 &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= 1 &&
    rect.y + rect.h <= 1
  );
}

function parseRect(value: unknown, where: string): Rect {
  if (!isRecord(value)) {
    throw new TypeError(`${where}: rect fehlt`);
  }
  const { x, y, w, h } = value;
  if ([x, y, w, h].some((number_) => typeof number_ !== 'number' || !Number.isFinite(number_))) {
    throw new TypeError(`${where}: rect enthält ungültige Zahlen`);
  }
  const rect = { x, y, w, h } as Rect;
  if (!isInsideCard(rect)) {
    throw new RangeError(`${where}: rect liegt nicht innerhalb der Karte (0..1)`);
  }
  return rect;
}

function parsePatch(value: unknown, card: number): PatchLayout {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') {
    throw new TypeError(`Karte ${String(card)}: Feld ohne gültige ID`);
  }
  const { id, role } = value;
  const rect = parseRect(value.rect, `Feld ${id}`);
  return role === 'large' || role === 'strip' ? { id, rect, role } : { id, rect };
}

// Prüft eine Layout-Datei (Format cam_gradr-layout/2) und liefert typisierte Daten.
export function parseLayout(raw: unknown): ChartLayout {
  if (!isRecord(raw) || raw.format !== 'cam_gradr-layout/2' || !Array.isArray(raw.cards)) {
    throw new TypeError('Ungültiges Layout-Format');
  }
  const seen = new Set<string>();
  const cards = (raw.cards as unknown[]).map((card): CardLayout => {
    if (!isRecord(card) || typeof card.card !== 'number' || !Array.isArray(card.patches)) {
      throw new TypeError('Ungültige Karte im Layout');
    }
    const number_ = card.card;
    const patches = (card.patches as unknown[]).map((patch) => {
      const parsed = parsePatch(patch, number_);
      if (seen.has(parsed.id)) {
        throw new Error(`Doppelte Feld-ID: ${parsed.id}`);
      }
      seen.add(parsed.id);
      return parsed;
    });
    return { card: number_, patches };
  });
  return { cards };
}
