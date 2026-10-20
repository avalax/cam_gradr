import type { CardLayout, ChartLayout, PatchLayout, Rect } from './types';

const ROLES = new Set<unknown>(['large', 'strip', 'neutral']);

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
    throw new TypeError(`${where}: rect is missing`);
  }
  const { x, y, w, h } = value;
  if ([x, y, w, h].some((number_) => typeof number_ !== 'number' || !Number.isFinite(number_))) {
    throw new TypeError(`${where}: rect contains invalid numbers`);
  }
  const rect = { x, y, w, h } as Rect;
  if (!isInsideCard(rect)) {
    throw new RangeError(`${where}: rect is not inside the card (0..1)`);
  }
  return rect;
}

function parseNominalLab(value: unknown, id: string): PatchLayout['nominalLab'] {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => !Number.isFinite(n))) {
    throw new TypeError(`Patch ${id}: nominalLab must contain three numbers`);
  }
  return value as unknown as [number, number, number];
}

function parsePatch(value: unknown, card: number): PatchLayout {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') {
    throw new TypeError(`Card ${String(card)}: patch without a valid id`);
  }
  const { id, role } = value;
  const rect = parseRect(value.rect, `Patch ${id}`);
  const nominalLab = parseNominalLab(value.nominalLab, id);
  return {
    id,
    rect,
    ...(ROLES.has(role) && { role: role as NonNullable<PatchLayout['role']> }),
    ...(nominalLab !== undefined && { nominalLab }),
  };
}

// Validates a layout file (format cam_gradr-layout/2) and returns typed data.
export function parseLayout(raw: unknown): ChartLayout {
  if (!isRecord(raw) || raw.format !== 'cam_gradr-layout/2' || !Array.isArray(raw.cards)) {
    throw new TypeError('Invalid layout format');
  }
  const seen = new Set<string>();
  const cards = (raw.cards as unknown[]).map((card): CardLayout => {
    if (!isRecord(card) || typeof card.card !== 'number' || !Array.isArray(card.patches)) {
      throw new TypeError('Invalid card in the layout');
    }
    const number_ = card.card;
    const patches = (card.patches as unknown[]).map((patch) => {
      const parsed = parsePatch(patch, number_);
      if (seen.has(parsed.id)) {
        throw new Error(`Duplicate patch id: ${parsed.id}`);
      }
      seen.add(parsed.id);
      return parsed;
    });
    return { card: number_, patches };
  });
  return { cards };
}
