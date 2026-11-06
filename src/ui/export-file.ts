import { lookSlug } from '../look/look';

import { APP_NAME } from './app-info';

// The look LUT the export lays over the correction: its name and strength in percent.
export interface ExportLook {
  name: string;
  strength: number;
}

// File name of the LUT; with a look it names the look and its strength.
export function exportFileName(size: number, look: ExportLook | null): string {
  const base = `${APP_NAME}-${String(size)}`;
  if (look === null) {
    return `${base}.cube`;
  }
  const slug = lookSlug(look.name);
  return `${base}-${slug === '' ? 'look' : slug}-${String(look.strength)}.cube`;
}

// TITLE line of the .cube file.
export function exportTitle(look: ExportLook | null): string {
  return look === null ? APP_NAME : `${APP_NAME} + ${look.name} ${String(look.strength)} %`;
}

// Comment lines of the .cube file, written in English like the rest of the file.
export function exportNotes(look: ExportLook | null): string[] {
  return look === null ? [] : [`Look LUT: ${look.name}.cube, strength ${String(look.strength)} %`];
}
