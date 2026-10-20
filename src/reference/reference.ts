import type { Vec3 } from '../color/lab';
import { t } from '../lang';

// Reference values of the color fields: Lab (D50) per field ID. Comes from the user, not the repo.
export interface ReferenceSet {
  name: string;
  patches: Readonly<Record<string, Vec3>>;
}

export interface ReferenceRules {
  // Valid field IDs of the color cards.
  knownIds: ReadonlySet<string>;
  // Neutral fields (gray ramps) from which the tone curves are built.
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
    throw new TypeError(t('reference.errors.notNumbers', { where }));
  }
  const lab = [l, a, b] as unknown as Vec3;
  if (
    lab[0] < 0 ||
    lab[0] > 100 ||
    Math.abs(lab[1]) > MAX_ABS_AB ||
    Math.abs(lab[2]) > MAX_ABS_AB
  ) {
    throw new RangeError(t('reference.errors.labRange', { where }));
  }
  return lab;
}

// Checks the collected fields against the layout's rules and builds the data set.
function build(name: string, entries: [string, Vec3][], rules: ReferenceRules): ReferenceSet {
  const patches: Record<string, Vec3> = {};
  for (const [id, lab] of entries) {
    if (!rules.knownIds.has(id)) {
      throw new RangeError(t('reference.errors.unknownId', { id }));
    }
    if (Object.hasOwn(patches, id)) {
      throw new RangeError(t('reference.errors.duplicateId', { id }));
    }
    patches[id] = lab;
  }
  const ids = Object.keys(patches);
  if (ids.length < MIN_PATCHES) {
    throw new RangeError(t('reference.errors.tooFewPatches', { min: String(MIN_PATCHES) }));
  }
  if (ids.filter((id) => rules.neutralIds.has(id)).length < MIN_NEUTRAL) {
    throw new RangeError(t('reference.errors.tooFewNeutral', { min: String(MIN_NEUTRAL) }));
  }
  return { name, patches };
}

export function parseReferenceJson(text: string, rules: ReferenceRules): ReferenceSet {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new SyntaxError(t('reference.errors.invalidJson'), { cause: error });
  }
  if (!isRecord(raw) || raw.format !== FORMAT || !Array.isArray(raw.patches)) {
    throw new TypeError(t('reference.errors.unknownFormat', { format: FORMAT }));
  }
  if (raw.illuminant !== undefined && raw.illuminant !== 'D50') {
    throw new RangeError(t('reference.errors.onlyD50'));
  }
  const entries = (raw.patches as unknown[]).map((patch): [string, Vec3] => {
    if (!isRecord(patch) || typeof patch.id !== 'string' || !Array.isArray(patch.lab)) {
      throw new TypeError(t('reference.errors.patchShape'));
    }
    return [
      patch.id,
      toLab(patch.lab as unknown[], t('reference.errors.patchWhere', { id: patch.id })),
    ];
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

// CSV with columns id, L, a, b (separator semicolon, tab or comma; optional header row).
// With semicolon or tab the decimal comma is also allowed.
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
    throw new RangeError(t('reference.errors.emptyFile'));
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
        throw new TypeError(t('reference.errors.lineShape', { line: String(index + 1) }));
      }
      const where = t('reference.errors.lineWhere', { line: String(index + 1) });
      entries.push([id, toLab(values, where)]);
    }
  }
  return build(fileName.replace(/\.[^.]*$/, '') || 'Import', entries, rules);
}

// Writes a set in the JSON format that can be imported again.
export function serializeReferenceJson(set: ReferenceSet): string {
  const patches = Object.entries(set.patches).map(([id, lab]) => ({ id, lab }));
  return `${JSON.stringify({ format: FORMAT, name: set.name, illuminant: 'D50', patches }, null, 2)}
`;
}

// Chooses the format by file extension or content.
export function parseReferenceFile(
  fileName: string,
  text: string,
  rules: ReferenceRules,
): ReferenceSet {
  const isJson = fileName.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{');
  return isJson ? parseReferenceJson(text, rules) : parseReferenceCsv(text, fileName, rules);
}
