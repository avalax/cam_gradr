import { describe, expect, it } from 'vitest';

import { exportFileName, exportNotes, exportTitle } from './export-file';

const look = { name: '05 MH Teal And Orange FILMIC', strength: 70 };

describe('export file', () => {
  it('names the size, and with a look also the look and its strength', () => {
    expect(exportFileName(33, null)).toBe('cam_gradr-33.cube');
    expect(exportFileName(65, look)).toBe('cam_gradr-65-05-mh-teal-and-orange-filmic-70.cube');
    expect(exportFileName(17, { name: '***', strength: 100 })).toBe('cam_gradr-17-look-100.cube');
  });

  it('writes title and comment line of the look', () => {
    expect(exportTitle(null)).toBe('cam_gradr');
    expect(exportTitle(look)).toBe('cam_gradr + 05 MH Teal And Orange FILMIC 70 %');
    expect(exportNotes(null)).toEqual([]);
    expect(exportNotes(look)).toEqual([
      'Look LUT: 05 MH Teal And Orange FILMIC.cube, strength 70 %',
    ]);
  });
});
