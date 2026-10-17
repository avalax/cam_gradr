import type { Lut } from './lut';

// Zulässige Größen im Export; 33 ist ein guter Standard, 17 und 65 sind bei manchen Geräten üblich.
export const CUBE_SIZES = [17, 33, 65] as const;

const DECIMALS = 6;

function format(value: number): string {
  return value.toFixed(DECIMALS);
}

// Schreibt die LUT im Adobe/Resolve-.cube-Format (3D, Wertebereich 0..1, R am schnellsten).
// Dezimalpunkt und Zeilenumbruch sind unabhängig von Sprach- und Systemeinstellungen.
export function formatCube(lut: Lut, title: string): string {
  const lines = [
    '# Erzeugt von cam_gradr',
    // Anführungszeichen im Titel würden die Zeile ungültig machen.
    `TITLE "${title.replaceAll('"', "'")}"`,
    `LUT_3D_SIZE ${String(lut.size)}`,
    `DOMAIN_MIN ${format(0)} ${format(0)} ${format(0)}`,
    `DOMAIN_MAX ${format(1)} ${format(1)} ${format(1)}`,
  ];
  for (let offset = 0; offset < lut.data.length; offset += 3) {
    lines.push(
      `${format(Number(lut.data[offset]))} ${format(Number(lut.data[offset + 1]))} ${format(Number(lut.data[offset + 2]))}`,
    );
  }
  return `${lines.join('\n')}\n`;
}
