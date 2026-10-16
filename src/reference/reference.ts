import type { Vec3 } from '../color/lab';

// Referenzwerte der Farbfelder: Lab (D50) je Feld-ID. Kommt vom Nutzer, nicht aus dem Repo.
export interface ReferenceSet {
  name: string;
  patches: Readonly<Record<string, Vec3>>;
}

export interface ReferenceRules {
  // Gültige Feld-IDs der Farbkarten.
  knownIds: ReadonlySet<string>;
  // Neutralfelder (Grauleitern), aus denen die Tonkurven entstehen.
  neutralIds: ReadonlySet<string>;
}

const FORMAT = 'cam_gradr-reference/1';
const MIN_PATCHES = 12;
const MIN_NEUTRAL = 4;
const MAX_ABS_AB = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toLab(values: readonly unknown[], where: string): Vec3 {
  const [l, a, b] = values;
  if ([l, a, b].some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError(`${where}: Lab-Werte sind keine Zahlen`);
  }
  const lab = [l, a, b] as unknown as Vec3;
  if (
    lab[0] < 0 ||
    lab[0] > 100 ||
    Math.abs(lab[1]) > MAX_ABS_AB ||
    Math.abs(lab[2]) > MAX_ABS_AB
  ) {
    throw new RangeError(`${where}: Lab-Wert außerhalb des gültigen Bereichs`);
  }
  return lab;
}

// Prüft die gesammelten Felder gegen Regeln des Layouts und bildet den Datensatz.
function build(name: string, entries: [string, Vec3][], rules: ReferenceRules): ReferenceSet {
  const patches: Record<string, Vec3> = {};
  for (const [id, lab] of entries) {
    if (!rules.knownIds.has(id)) {
      throw new RangeError(`Unbekannte Feld-ID: ${id}`);
    }
    if (Object.hasOwn(patches, id)) {
      throw new RangeError(`Doppelte Feld-ID: ${id}`);
    }
    patches[id] = lab;
  }
  const ids = Object.keys(patches);
  if (ids.length < MIN_PATCHES) {
    throw new RangeError(`Zu wenige Felder: mindestens ${String(MIN_PATCHES)} nötig`);
  }
  if (ids.filter((id) => rules.neutralIds.has(id)).length < MIN_NEUTRAL) {
    throw new RangeError(
      `Zu wenige Neutralfelder (Grauleitern): mindestens ${String(MIN_NEUTRAL)} nötig`,
    );
  }
  return { name, patches };
}

export function parseReferenceJson(text: string, rules: ReferenceRules): ReferenceSet {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError('Die Datei ist kein gültiges JSON', { cause: error });
  }
  if (!isRecord(raw) || raw.format !== FORMAT || !Array.isArray(raw.patches)) {
    throw new TypeError(`Unbekanntes Format, erwartet wird "${FORMAT}"`);
  }
  if (raw.illuminant !== undefined && raw.illuminant !== 'D50') {
    throw new RangeError('Es werden nur Lab-Werte mit Weißpunkt D50 unterstützt');
  }
  const entries = (raw.patches as unknown[]).map((patch): [string, Vec3] => {
    if (!isRecord(patch) || typeof patch.id !== 'string' || !Array.isArray(patch.lab)) {
      throw new TypeError('Ein Feld braucht "id" und "lab"');
    }
    return [patch.id, toLab(patch.lab as unknown[], `Feld ${patch.id}`)];
  });
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : 'Import';
  return build(name, entries, rules);
}

function detectDelimiter(line: string): string {
  for (const candidate of [';', '\t']) {
    if (line.includes(candidate)) {
      return candidate;
    }
  }
  return ',';
}

// CSV mit Spalten id, L, a, b (Trennzeichen Semikolon, Tab oder Komma; optionale Kopfzeile).
// Bei Semikolon oder Tab ist auch das Dezimalkomma erlaubt.
export function parseReferenceCsv(
  text: string,
  fileName: string,
  rules: ReferenceRules,
): ReferenceSet {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  const first = lines[0];
  if (first === undefined) {
    throw new RangeError('Die Datei ist leer');
  }
  const delimiter = detectDelimiter(first);
  const entries: [string, Vec3][] = [];
  for (const [index, line] of lines.entries()) {
    const cells = line.split(delimiter).map((cell) => cell.trim());
    const [id = '', ...numbers] = cells;
    const values = numbers
      .slice(0, 3)
      .map((cell) => Number(delimiter === ',' ? cell : cell.replace(',', '.')));
    const isHeader = index === 0 && values.some((value) => Number.isNaN(value));
    if (!isHeader) {
      if (values.length < 3) {
        throw new TypeError(`Zeile ${String(index + 1)}: erwartet id, L, a, b`);
      }
      entries.push([id, toLab(values, `Zeile ${String(index + 1)}`)]);
    }
  }
  return build(fileName.replace(/\.[^.]*$/, '') || 'Import', entries, rules);
}

// Wählt das Format nach Dateiendung bzw. Inhalt.
export function parseReferenceFile(
  fileName: string,
  text: string,
  rules: ReferenceRules,
): ReferenceSet {
  const isJson = fileName.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{');
  return isJson ? parseReferenceJson(text, rules) : parseReferenceCsv(text, fileName, rules);
}
