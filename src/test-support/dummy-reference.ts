import type { Vec3 } from '../color/lab';

// Made-up reference values for tests. They do not come from the manufacturer and do not resemble its
// data; gray fields are neutral with evenly falling lightness, color fields lie on a circle.
const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = 6;

export function dummyLab(id: string): Vec3 {
  const row = Number(id[0]) - 1;
  const column = COLUMN_LETTERS.indexOf(id[1] ?? '');
  if (id.endsWith('D')) {
    return [92 - row * 13, 0, 0];
  }
  if (id.endsWith('E')) {
    return [96 - row * 15, 0, 0];
  }
  const angle = ((column * 6 + row) / 48) * 2 * Math.PI;
  const radius = 20 + ((column + row) % 3) * 8;
  return [
    38 + ((column * 5 + row * 7) % 7) * 6,
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  ];
}

// Field IDs of all color cards: digit = row (1–6), letter = column (A–H).
export function dummyIds(): string[] {
  return COLUMN_LETTERS.flatMap((letter) =>
    Array.from({ length: ROWS }, (_, row) => `${String(row + 1)}${letter}`),
  );
}

// Reference file in the import format (JSON) with made-up values.
export function dummyReferenceJson(name = 'Test data'): string {
  return JSON.stringify({
    format: 'cam_gradr-reference/1',
    name,
    illuminant: 'D50',
    patches: dummyIds().map((id) => ({ id, lab: dummyLab(id) })),
  });
}

export function dummyReferenceCsv(): string {
  const rows = dummyIds().map((id) => {
    const [l, a, b] = dummyLab(id);
    return `${id};${l.toFixed(2)};${a.toFixed(2)};${b.toFixed(2)}`;
  });
  return ['id;L;a;b', ...rows].join('\n');
}
