import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadFile } from './download';

describe('downloadFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('erzeugt einen Link mit Dateiname und löst den Download aus', async () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });

    downloadFile('lut.cube', 'inhalt', 'text/plain');

    expect(clicked).toEqual([{ href: 'blob:test', download: 'lut.cube' }]);
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('inhalt');
    expect(revoke).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
