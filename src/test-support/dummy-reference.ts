import type { Vec3 } from '../color/lab';

// Erfundene Referenzwerte für Tests. Sie stammen nicht vom Hersteller und ähneln dessen Daten nicht;
// Graufelder sind neutral mit gleichmäßig fallender Helligkeit, Farbfelder liegen auf einem Kreis.
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

// Feld-IDs aller Farbkarten: Ziffer = Reihe (1–6), Buchstabe = Spalte (A–H).
export function dummyIds(): string[] {
  return COLUMN_LETTERS.flatMap((letter) =>
    Array.from({ length: ROWS }, (_, row) => `${String(row + 1)}${letter}`),
  );
}

// Referenzdatei im Importformat (JSON) mit erfundenen Werten.
export function dummyReferenceJson(name = 'Testdaten'): string {
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
