import type { Lut } from '../lut/lut';

// Liest eine .cube-Datei wieder ein (nur für Tests: Rundreise zur Prüfung des Exports).
export interface ParsedCube {
  title: string;
  lut: Lut;
  domainMin: number[];
  domainMax: number[];
}

export function parseCube(text: string): ParsedCube {
  let title = '';
  let size = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  const values: number[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('TITLE')) {
      title = line.slice('TITLE'.length).trim().replaceAll('"', '');
    } else if (line.startsWith('LUT_3D_SIZE')) {
      size = Number(line.split(' ', 2)[1]);
    } else if (line.startsWith('DOMAIN_MIN')) {
      domainMin = line.split(' ').slice(1).map(Number);
    } else if (line.startsWith('DOMAIN_MAX')) {
      domainMax = line.split(' ').slice(1).map(Number);
    } else {
      values.push(...line.split(' ').map(Number));
    }
  }
  return { title, lut: { size, data: Float32Array.from(values) }, domainMin, domainMax };
}
